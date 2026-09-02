import type { RequestHandler } from 'express';
import type {
  ApprovalPolicyInput,
  InvitationCreateInput,
  MemberUpdateInput,
  RoleInput,
} from '@hello-shop/validation';
import type { ApprovalActionType } from '@hello-shop/database';
import { success } from '../../lib/response.js';
import { TeamSecurityService } from './team-security.service.js';

export function teamSecurityController(service = new TeamSecurityService()) {
  const run =
    (fn: (q: Parameters<RequestHandler>[0]) => unknown, status = 200): RequestHandler =>
    (q, r, n) => {
      Promise.resolve(fn(q))
        .then((data) => success(r, data, status))
        .catch(n);
    };
  return {
    teamList: run((q) => service.teamList(q.tenant!.businessId, q.query)),
    member: run((q) => service.member(q.tenant!.businessId, String(q.params.id))),
    updateMember: run((q) =>
      service.updateMember(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        q.body as MemberUpdateInput,
      ),
    ),
    changeRole: run((q) =>
      service.changeRole(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        String((q.body as { roleId: string }).roleId),
      ),
    ),
    suspend: run((q) => service.suspend(q.tenant!.businessId, String(q.params.id), q.auth!.id)),
    reactivate: run((q) =>
      service.reactivate(q.tenant!.businessId, String(q.params.id), q.auth!.id),
    ),
    revokeSessions: run((q) =>
      service.revokeSessions(q.tenant!.businessId, String(q.params.id), q.auth!.id),
    ),
    invite: run(
      (q) => service.invite(q.tenant!.businessId, q.auth!.id, q.body as InvitationCreateInput),
      201,
    ),
    invitations: run((q) => service.invitations(q.tenant!.businessId)),
    revokeInvite: run((q) =>
      service.revokeInvite(q.tenant!.businessId, String(q.params.id), q.auth!.id),
    ),
    acceptInvite: run((q) =>
      service.acceptInvite(q.auth!.id, String((q.body as { token: string }).token)),
    ),
    registerInvite: run(
      (q) =>
        service.registerInvite(
          q.body as { token: string; email: string; displayName: string; password: string },
        ),
      201,
    ),
    roles: run((q) => service.roles(q.tenant!.businessId)),
    role: run((q) => service.role(q.tenant!.businessId, String(q.params.id))),
    createRole: run(
      (q) => service.saveRole(q.tenant!.businessId, q.auth!.id, q.body as RoleInput),
      201,
    ),
    updateRole: run((q) =>
      service.saveRole(q.tenant!.businessId, q.auth!.id, q.body as RoleInput, String(q.params.id)),
    ),
    permissions: run(() => service.permissions()),
    policies: run((q) => service.policies(q.tenant!.businessId)),
    savePolicy: run((q) =>
      service.savePolicy(
        q.tenant!.businessId,
        String(q.params.actionType) as ApprovalActionType,
        q.auth!.id,
        q.body as ApprovalPolicyInput,
      ),
    ),
    approvalList: run((q) => service.approvalList(q.tenant!.businessId, q.auth!.id, q.query)),
    approval: run((q) => service.approval(q.tenant!.businessId, String(q.params.id))),
    approve: run((q) =>
      service.approve(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        (q.body as { note?: string }).note,
      ),
    ),
    reject: run((q) =>
      service.reject(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        (q.body as { note?: string }).note,
      ),
    ),
    cancel: run((q) => service.cancel(q.tenant!.businessId, String(q.params.id), q.auth!.id)),
    auditList: run((q) => service.auditList(q.tenant!.businessId, q.query)),
    audit: run((q) => service.audit(q.tenant!.businessId, String(q.params.id))),
  };
}
