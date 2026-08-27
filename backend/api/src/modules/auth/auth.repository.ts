import { Prisma, prisma, provisionBusinessAccess } from '@hello-shop/database';
import {
  RegistrationConflictError,
  type AuthRepository,
  type MembershipRecord,
  type SessionRecord,
} from './auth.types.js';

export class PrismaAuthRepository implements AuthRepository {
  async createBusinessOwner(
    input: Parameters<AuthRepository['createBusinessOwner']>[0],
  ): Promise<void> {
    try {
      await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
          },
        });
        const business = await transaction.business.create({
          data: { name: input.businessName, slug: input.businessSlug },
        });
        const access = await provisionBusinessAccess(transaction, business.id);
        const ownerRoleId = access.roles.get('OWNER');
        if (!ownerRoleId) throw new Error('OWNER provisioning failed.');
        const membership = await transaction.businessMembership.create({
          data: { businessId: business.id, userId: user.id, roleId: ownerRoleId },
        });
        await transaction.auditLog.create({
          data: {
            businessId: business.id,
            actorUserId: user.id,
            action: 'business.registered',
            entityType: 'Business',
            entityId: business.id,
            metadata: { membershipId: membership.id },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new RegistrationConflictError('Email or business slug already exists.');
      throw error;
    }
  }
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findFirstActiveMembership(userId: string): Promise<MembershipRecord | null> {
    const membership = await prisma.businessMembership.findFirst({
      where: { userId, status: 'ACTIVE', business: { isActive: true } },
      orderBy: { createdAt: 'asc' },
      include: {
        business: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    return membership ? this.mapMembership(membership) : null;
  }

  async createSession(input: Parameters<AuthRepository['createSession']>[0]): Promise<void> {
    await prisma.loginSession.create({ data: input });
  }

  async findSession(id: string): Promise<SessionRecord | null> {
    return prisma.loginSession.findUnique({ where: { id }, include: { user: true } });
  }

  async rotateSession(
    id: string,
    currentHash: string,
    nextHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await prisma.loginSession.updateMany({
      where: { id, refreshTokenHash: currentHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: {
        previousRefreshTokenHash: currentHash,
        refreshTokenHash: nextHash,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });
    return result.count === 1;
  }

  async revokeSession(id: string, reason: string): Promise<void> {
    await prisma.loginSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAllSessions(userId: string, reason: string): Promise<void> {
    await prisma.loginSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async resolveMembership(sessionId: string, userId: string): Promise<MembershipRecord | null> {
    const session = await prisma.loginSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: {
        membership: {
          include: {
            business: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    const membership = session?.membership;
    if (!membership || membership.userId !== userId || membership.businessId !== session.businessId)
      return null;
    return this.mapMembership(membership);
  }

  async createAudit(input: Parameters<AuthRepository['createAudit']>[0]): Promise<void> {
    await prisma.auditLog.create({ data: input });
  }

  private mapMembership(membership: {
    id: string;
    businessId: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
    business: { name: string; isActive: boolean };
    role: { permissions: { permission: { key: string } }[] };
  }): MembershipRecord {
    return {
      id: membership.id,
      businessId: membership.businessId,
      businessName: membership.business.name,
      businessActive: membership.business.isActive,
      status: membership.status,
      permissions: membership.role.permissions.map((item) => item.permission.key),
    };
  }
}
