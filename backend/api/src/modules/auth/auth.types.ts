export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
};
export type MembershipRecord = {
  id: string;
  businessId: string;
  businessName: string;
  businessActive: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  permissions: string[];
};
export type SessionRecord = {
  id: string;
  userId: string;
  businessId: string;
  membershipId: string;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  user: { id: string; email: string; isActive: boolean };
};

export class RegistrationConflictError extends Error {
  override name = 'RegistrationConflictError';
}

export interface AuthRepository {
  createBusinessOwner(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    businessName: string;
    businessSlug: string;
  }): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findFirstActiveMembership(userId: string): Promise<MembershipRecord | null>;
  createSession(input: {
    id: string;
    userId: string;
    businessId: string;
    membershipId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void>;
  findSession(id: string): Promise<SessionRecord | null>;
  rotateSession(
    id: string,
    currentHash: string,
    nextHash: string,
    expiresAt: Date,
  ): Promise<boolean>;
  revokeSession(id: string, reason: string): Promise<void>;
  revokeAllSessions(userId: string, reason: string): Promise<void>;
  resolveMembership(sessionId: string, userId: string): Promise<MembershipRecord | null>;
  createAudit(input: {
    businessId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId?: string;
    requestId?: string;
    ipAddress?: string;
  }): Promise<void>;
}
