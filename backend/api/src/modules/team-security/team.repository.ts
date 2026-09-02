import { prisma } from '@hello-shop/database';
import type { Prisma } from '@hello-shop/database';
import type { InvitationCreateInput, MemberUpdateInput, RoleInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { inviteToken, sanitizeAudit, tokenHash } from './security-utils.js';
import argon2 from 'argon2';

const memberInclude = {
  user: {
    select: {
      id: true,
      displayName: true,
      email: true,
      sessions: {
        where: { revokedAt: null },
        orderBy: { lastUsedAt: 'desc' as const },
        take: 1,
        select: { lastUsedAt: true },
      },
    },
  },
  role: { include: { permissions: { include: { permission: true } } } },
};

export class TeamRepository {
  list(businessId: string, query: Record<string, unknown>) {
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const status = typeof query.status === 'string' ? query.status : undefined;
    const roleId = typeof query.roleId === 'string' ? query.roleId : undefined;
    return prisma.businessMembership.findMany({
      where: {
        businessId,
        ...(status ? { status: status as 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' } : {}),
        ...(roleId ? { roleId } : {}),
        ...(search
          ? {
              OR: [
                { user: { displayName: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { employeeCode: { contains: search, mode: 'insensitive' } },
                { jobTitle: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: memberInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }
  find(businessId: string, id: string) {
    return prisma.businessMembership.findFirst({
      where: { businessId, id },
      include: memberInclude,
    });
  }
  async updateProfile(
    businessId: string,
    id: string,
    actorUserId: string,
    input: MemberUpdateInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const before = await tx.businessMembership.findFirst({ where: { businessId, id } });
      if (!before) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member was not found.');
      const member = await tx.businessMembership.update({
        where: { id },
        data: {
          employeeCode: input.employeeCode ?? null,
          jobTitle: input.jobTitle ?? null,
          phone: input.phone ?? null,
          employmentType: input.employmentType ?? null,
          joinedAt: input.joinedAt ?? null,
          notes: input.notes ?? null,
          version: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'team.member.updated',
          entityType: 'BusinessMembership',
          entityId: id,
          summary: 'Team profile updated.',
          metadata: sanitizeAudit({
            before: { employeeCode: before.employeeCode, jobTitle: before.jobTitle },
            after: input,
          }),
        },
      });
      return member;
    });
  }
  async activeOwnerCount(tx: Prisma.TransactionClient, businessId: string) {
    return tx.businessMembership.count({
      where: { businessId, status: 'ACTIVE', role: { name: 'OWNER' } },
    });
  }
  async changeRole(businessId: string, id: string, roleId: string, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const member = await tx.businessMembership.findFirst({
        where: { businessId, id },
        include: { role: true },
      });
      const role = await tx.role.findFirst({
        where: { businessId, id: roleId, isActive: true },
        include: { permissions: { include: { permission: true } } },
      });
      const actor = await tx.businessMembership.findFirst({
        where: { businessId, userId: actorUserId, status: 'ACTIVE' },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!member || !role || !actor)
        throw new AppError(404, 'MEMBER_OR_ROLE_NOT_FOUND', 'Team member or role was not found.');
      const actorPermissions = new Set(actor.role.permissions.map((item) => item.permission.key));
      if (
        actor.role.name !== 'OWNER' &&
        role.permissions.some((item) => !actorPermissions.has(item.permission.key))
      )
        throw new AppError(
          403,
          'PERMISSION_ESCALATION',
          'You cannot assign a role containing permissions you do not hold.',
        );
      if (
        member.role.name === 'OWNER' &&
        role.name !== 'OWNER' &&
        (await this.activeOwnerCount(tx, businessId)) <= 1
      )
        throw new AppError(409, 'LAST_OWNER', 'The last active owner cannot be demoted.');
      const updated = await tx.businessMembership.update({
        where: { id },
        data: { roleId, version: { increment: 1 } },
      });
      await tx.loginSession.updateMany({
        where: { membershipId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'team_role_changed' },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'team.role.changed',
          entityType: 'BusinessMembership',
          entityId: id,
          summary: `Role changed from ${member.role.name} to ${role.name}.`,
          metadata: { fromRole: member.role.name, toRole: role.name },
        },
      });
      return updated;
    });
  }
  async setStatus(
    businessId: string,
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
    actorUserId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const member = await tx.businessMembership.findFirst({
        where: { businessId, id },
        include: { role: true },
      });
      if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member was not found.');
      if (
        status === 'SUSPENDED' &&
        member.role.name === 'OWNER' &&
        member.status === 'ACTIVE' &&
        (await this.activeOwnerCount(tx, businessId)) <= 1
      )
        throw new AppError(409, 'LAST_OWNER', 'The last active owner cannot be suspended.');
      const updated = await tx.businessMembership.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
      if (status !== 'ACTIVE')
        await tx.loginSession.updateMany({
          where: { membershipId: id, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'membership_suspended' },
        });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: status === 'ACTIVE' ? 'team.member.reactivated' : 'team.member.suspended',
          entityType: 'BusinessMembership',
          entityId: id,
          summary: status === 'ACTIVE' ? 'Team member reactivated.' : 'Team member suspended.',
          metadata: { fromStatus: member.status, toStatus: status },
        },
      });
      return updated;
    });
  }
  async revokeSessions(businessId: string, id: string, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const member = await tx.businessMembership.findFirst({ where: { businessId, id } });
      if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member was not found.');
      const result = await tx.loginSession.updateMany({
        where: { businessId, membershipId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'admin_revocation' },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'team.sessions.revoked',
          entityType: 'BusinessMembership',
          entityId: id,
          summary: `${result.count} active session(s) revoked.`,
          metadata: { revokedCount: result.count },
        },
      });
      return { revokedCount: result.count };
    });
  }
  async invite(businessId: string, actorUserId: string, input: InvitationCreateInput) {
    const rawToken = inviteToken();
    const hash = tokenHash(rawToken);
    const now = new Date();
    const invitation = await prisma.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: { businessId, id: input.roleId, isActive: true },
      });
      if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role was not found.');
      const active = await tx.businessMembership.findFirst({
        where: { businessId, user: { email: input.email }, status: 'ACTIVE' },
      });
      if (active)
        throw new AppError(409, 'MEMBER_EXISTS', 'This user is already an active team member.');
      const duplicate = await tx.teamInvitation.findFirst({
        where: { businessId, email: input.email, status: 'PENDING', expiresAt: { gt: now } },
      });
      if (duplicate)
        throw new AppError(
          409,
          'INVITATION_PENDING',
          'A valid invitation is already pending for this email.',
        );
      const row = await tx.teamInvitation.create({
        data: {
          businessId,
          invitedById: actorUserId,
          roleId: role.id,
          email: input.email,
          tokenHash: hash,
          jobTitle: input.jobTitle ?? null,
          employeeCode: input.employeeCode ?? null,
          expiresAt: new Date(now.getTime() + input.expiresInHours * 3600000),
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'team.invitation.created',
          entityType: 'TeamInvitation',
          entityId: row.id,
          summary: `Invitation created for ${input.email}.`,
          metadata: { email: input.email, role: role.name, expiresAt: row.expiresAt.toISOString() },
        },
      });
      return row;
    });
    return {
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.roleId,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviteToken: rawToken,
    };
  }
  listInvitations(businessId: string) {
    return prisma.teamInvitation.findMany({
      where: { businessId },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        role: true,
        invitedBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async revokeInvitation(businessId: string, id: string, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.findFirst({
        where: { businessId, id, status: 'PENDING' },
      });
      if (!invitation)
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'Pending invitation was not found.');
      const row = await tx.teamInvitation.update({
        where: { id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'team.invitation.revoked',
          entityType: 'TeamInvitation',
          entityId: id,
          summary: 'Team invitation revoked.',
          metadata: { email: invitation.email },
        },
      });
      return row;
    });
  }
  async acceptInvitation(userId: string, rawToken: string) {
    const hash = tokenHash(rawToken);
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.findUnique({
        where: { tokenHash: hash },
        include: { role: true },
      });
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (
        !invitation ||
        !user ||
        invitation.email !== user.email ||
        invitation.status !== 'PENDING'
      )
        throw new AppError(
          404,
          'INVITATION_INVALID',
          'Invitation is invalid or no longer available.',
        );
      if (invitation.expiresAt <= now) {
        await tx.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        throw new AppError(410, 'INVITATION_EXPIRED', 'Invitation has expired.');
      }
      const membership = await tx.businessMembership.upsert({
        where: { businessId_userId: { businessId: invitation.businessId, userId } },
        create: {
          businessId: invitation.businessId,
          userId,
          roleId: invitation.roleId,
          status: 'ACTIVE',
          jobTitle: invitation.jobTitle,
          employeeCode: invitation.employeeCode,
          joinedAt: now,
        },
        update: {
          roleId: invitation.roleId,
          status: 'ACTIVE',
          jobTitle: invitation.jobTitle,
          employeeCode: invitation.employeeCode,
          joinedAt: now,
        },
      });
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: now },
      });
      await tx.auditLog.create({
        data: {
          businessId: invitation.businessId,
          actorUserId: userId,
          action: 'team.invitation.accepted',
          entityType: 'BusinessMembership',
          entityId: membership.id,
          summary: 'Team invitation accepted.',
          metadata: { role: invitation.role.name },
        },
      });
      return membership;
    });
  }
  async registerInvitation(input: {
    token: string;
    email: string;
    displayName: string;
    password: string;
  }) {
    const hash = tokenHash(input.token);
    const now = new Date();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.findUnique({
        where: { tokenHash: hash },
        include: { role: true },
      });
      if (!invitation || invitation.email !== input.email || invitation.status !== 'PENDING')
        throw new AppError(
          404,
          'INVITATION_INVALID',
          'Invitation is invalid or no longer available.',
        );
      if (invitation.expiresAt <= now) {
        await tx.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        throw new AppError(410, 'INVITATION_EXPIRED', 'Invitation has expired.');
      }
      if (await tx.user.findUnique({ where: { email: input.email } }))
        throw new AppError(
          409,
          'USER_EXISTS',
          'An account already exists. Sign in before accepting this invitation.',
        );
      const user = await tx.user.create({
        data: { email: input.email, displayName: input.displayName, passwordHash },
      });
      const membership = await tx.businessMembership.create({
        data: {
          businessId: invitation.businessId,
          userId: user.id,
          roleId: invitation.roleId,
          status: 'ACTIVE',
          jobTitle: invitation.jobTitle,
          employeeCode: invitation.employeeCode,
          joinedAt: now,
        },
      });
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: now },
      });
      await tx.auditLog.create({
        data: {
          businessId: invitation.businessId,
          actorUserId: user.id,
          action: 'team.invitation.accepted',
          entityType: 'BusinessMembership',
          entityId: membership.id,
          summary: 'New user registered through a team invitation.',
          metadata: { role: invitation.role.name },
        },
      });
      return { userId: user.id, businessId: invitation.businessId, membershipId: membership.id };
    });
  }
  listRoles(businessId: string) {
    return prisma.role.findMany({
      where: { businessId },
      include: {
        _count: { select: { memberships: true } },
        permissions: { include: { permission: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }
  findRole(businessId: string, id: string) {
    return prisma.role.findFirst({
      where: { businessId, id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { memberships: true } },
      },
    });
  }
  async saveRole(businessId: string, actorUserId: string, input: RoleInput, id?: string) {
    return prisma.$transaction(async (tx) => {
      const actor = await tx.businessMembership.findFirst({
        where: { businessId, userId: actorUserId, status: 'ACTIVE' },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!actor) throw new AppError(403, 'INVALID_MEMBERSHIP', 'Active membership is required.');
      const actorKeys = new Set(actor.role.permissions.map((x) => x.permission.key));
      if (actor.role.name !== 'OWNER' && input.permissions.some((key) => !actorKeys.has(key)))
        throw new AppError(
          403,
          'PERMISSION_ESCALATION',
          'You cannot grant permissions you do not hold.',
        );
      const permissions = await tx.permission.findMany({
        where: { key: { in: input.permissions } },
      });
      if (permissions.length !== new Set(input.permissions).size)
        throw new AppError(
          422,
          'UNKNOWN_PERMISSION',
          'One or more permission keys are not registered.',
        );
      const existing = id ? await tx.role.findFirst({ where: { businessId, id } }) : null;
      if (id && !existing) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role was not found.');
      if (existing?.isSystem)
        throw new AppError(
          409,
          'SYSTEM_ROLE_PROTECTED',
          'System roles cannot be edited through custom role management.',
        );
      const role = id
        ? await tx.role.update({
            where: { id },
            data: {
              name: input.name,
              description: input.description ?? null,
              isActive: input.isActive,
            },
          })
        : await tx.role.create({
            data: {
              businessId,
              name: input.name,
              description: input.description ?? null,
              isActive: input.isActive,
              createdById: actorUserId,
            },
          });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: existing ? 'role.updated' : 'role.created',
          entityType: 'Role',
          entityId: role.id,
          summary: existing
            ? `Custom role ${role.name} updated.`
            : `Custom role ${role.name} created.`,
          metadata: { permissions: input.permissions },
        },
      });
      return role;
    });
  }
}
