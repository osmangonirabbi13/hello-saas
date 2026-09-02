import { PERMISSION_REGISTRY, Prisma, type ApprovalActionType } from '@hello-shop/database';
import type {
  ApprovalPolicyInput,
  InvitationCreateInput,
  MemberUpdateInput,
  RoleInput,
} from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { ApprovalRepository } from './approval.repository.js';
import { approvalRequiredError } from './approval-error.js';
import { sanitizeAudit } from './security-utils.js';
import { AuditRepository } from './audit.repository.js';
import { TeamRepository } from './team.repository.js';

export class TeamSecurityService {
  constructor(
    private team = new TeamRepository(),
    private approvals = new ApprovalRepository(),
    private audits = new AuditRepository(),
  ) {}
  teamList(b: string, q: Record<string, unknown>) {
    return this.team.list(b, q);
  }
  async member(b: string, id: string) {
    const row = await this.team.find(b, id);
    if (!row) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member was not found.');
    return row;
  }
  updateMember(b: string, id: string, u: string, input: MemberUpdateInput) {
    return this.team.updateProfile(b, id, u, input);
  }
  async changeRole(b: string, id: string, u: string, roleId: string) {
    const [member, role] = await Promise.all([this.member(b, id), this.role(b, roleId)]);
    const payload: Prisma.InputJsonObject = {
      currentRoleId: member.roleId,
      currentRoleName: member.role.name,
      targetRoleId: role.id,
      targetRoleName: role.name,
      targetPermissionKeys: role.permissions.map((item) => item.permission.key).sort(),
    };
    const gate = await this.approvals.evaluateAndRequest(b, u, {
      actionType: 'TEAM_ROLE_CHANGE',
      sourceType: 'BusinessMembership',
      sourceId: member.id,
      sourceVersion: member.version,
      value: new Prisma.Decimal(0),
      reason: `Change ${member.user.displayName}'s role from ${member.role.name} to ${role.name}.`,
      payload,
    });
    if (gate.approvalRequired) throw approvalRequiredError(gate.request);
    const execute = () => this.team.changeRole(b, id, roleId, u);
    return 'approvedRequest' in gate
      ? this.approvals.execute(b, gate.approvedRequest.id, member.version, payload, u, execute)
      : execute();
  }
  async suspend(b: string, id: string, u: string) {
    const member = await this.member(b, id);
    const payload: Prisma.InputJsonObject = {
      status: member.status,
      roleId: member.roleId,
      roleName: member.role.name,
    };
    const gate = await this.approvals.evaluateAndRequest(b, u, {
      actionType: 'TEAM_SUSPEND',
      sourceType: 'BusinessMembership',
      sourceId: member.id,
      sourceVersion: member.version,
      value: new Prisma.Decimal(0),
      reason: `Suspend ${member.user.displayName}.`,
      payload,
    });
    if (gate.approvalRequired) throw approvalRequiredError(gate.request);
    const execute = () => this.team.setStatus(b, id, 'SUSPENDED', u);
    return 'approvedRequest' in gate
      ? this.approvals.execute(b, gate.approvedRequest.id, member.version, payload, u, execute)
      : execute();
  }
  reactivate(b: string, id: string, u: string) {
    return this.team.setStatus(b, id, 'ACTIVE', u);
  }
  revokeSessions(b: string, id: string, u: string) {
    return this.team.revokeSessions(b, id, u);
  }
  invite(b: string, u: string, input: InvitationCreateInput) {
    return this.team.invite(b, u, input);
  }
  invitations(b: string) {
    return this.team.listInvitations(b);
  }
  revokeInvite(b: string, id: string, u: string) {
    return this.team.revokeInvitation(b, id, u);
  }
  acceptInvite(u: string, token: string) {
    return this.team.acceptInvitation(u, token);
  }
  registerInvite(input: { token: string; email: string; displayName: string; password: string }) {
    return this.team.registerInvitation(input);
  }
  roles(b: string) {
    return this.team.listRoles(b);
  }
  async role(b: string, id: string) {
    const row = await this.team.findRole(b, id);
    if (!row) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role was not found.');
    return row;
  }
  saveRole(b: string, u: string, input: RoleInput, id?: string) {
    return this.team.saveRole(b, u, input, id);
  }
  permissions() {
    return PERMISSION_REGISTRY;
  }
  policies(b: string) {
    return this.approvals.listPolicies(b);
  }
  savePolicy(b: string, action: ApprovalActionType, u: string, input: ApprovalPolicyInput) {
    return this.approvals.savePolicy(b, action, u, input);
  }
  async approvalList(b: string, u: string, q: Record<string, unknown>) {
    return (await this.approvals.list(b, u, q)).map(presentApproval);
  }
  async approval(b: string, id: string) {
    const row = await this.approvals.find(b, id);
    if (!row) throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval request was not found.');
    return presentApproval(row);
  }
  approve(b: string, id: string, u: string, note?: string) {
    return this.approvals.decide(b, id, u, 'APPROVED', note);
  }
  reject(b: string, id: string, u: string, note?: string) {
    return this.approvals.decide(b, id, u, 'REJECTED', note);
  }
  cancel(b: string, id: string, u: string) {
    return this.approvals.cancel(b, id, u);
  }
  async auditList(b: string, q: Record<string, unknown>) {
    return (await this.audits.list(b, q)).map(presentAudit);
  }
  async audit(b: string, id: string) {
    const row = await this.audits.find(b, id);
    if (!row) throw new AppError(404, 'AUDIT_NOT_FOUND', 'Audit event was not found.');
    return presentAudit(row);
  }
}

function presentApproval<T extends { payloadSnapshot: unknown; reason: string }>(row: T) {
  const snapshot =
    row.payloadSnapshot &&
    typeof row.payloadSnapshot === 'object' &&
    !Array.isArray(row.payloadSnapshot)
      ? (row.payloadSnapshot as Record<string, unknown>)
      : {};
  const currentSourceState = typeof snapshot.status === 'string' ? snapshot.status : 'Recorded';
  return {
    ...row,
    payloadSnapshot: undefined,
    impactSummary: row.reason,
    currentSourceState,
  };
}

function presentAudit<T extends { metadata: unknown }>(row: T) {
  return { ...row, metadata: sanitizeAudit(row.metadata) };
}
