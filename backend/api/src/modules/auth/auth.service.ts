import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { jwtVerify, SignJWT } from 'jose';
import { AppError } from '../../common/errors/app-error.js';
import { RegistrationConflictError, type AuthRepository } from './auth.types.js';

type AuthConfig = { secret: string; accessTtlSeconds: number; refreshTtlDays: number };

export class AuthService {
  private readonly key: Uint8Array;
  constructor(
    private readonly repository: AuthRepository,
    private readonly config: AuthConfig,
  ) {
    this.key = new TextEncoder().encode(config.secret);
  }

  async login(input: { email: string; password: string; userAgent?: string; ipAddress?: string }) {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const membership = await this.repository.findFirstActiveMembership(user.id);
    if (!membership || !membership.businessActive)
      throw new AppError(
        403,
        'NO_ACTIVE_MEMBERSHIP',
        'No active business membership is available.',
      );
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const refreshToken = `${sessionId}.${secret}`;
    const expiresAt = this.refreshExpiry();
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      businessId: membership.businessId,
      membershipId: membership.id,
      refreshTokenHash: this.hash(refreshToken),
      expiresAt,
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    });
    await this.repository.createAudit({
      businessId: membership.businessId,
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'LoginSession',
      entityId: sessionId,
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    });
    return {
      accessToken: await this.signAccessToken(user.id, sessionId),
      refreshToken,
      expiresAt,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      business: { id: membership.businessId, name: membership.businessName },
      permissions: membership.permissions,
    };
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    businessName: string;
    businessSlug: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      await this.repository.createBusinessOwner({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        businessName: input.businessName,
        businessSlug: input.businessSlug,
      });
    } catch (error) {
      if (error instanceof RegistrationConflictError)
        throw new AppError(409, 'REGISTRATION_CONFLICT', error.message);
      throw error;
    }
    return this.login({
      email: input.email,
      password: input.password,
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    });
  }

  async refresh(refreshToken: string) {
    const [sessionId] = refreshToken.split('.', 1);
    if (!sessionId || !refreshToken.includes('.'))
      throw new AppError(401, 'INVALID_SESSION', 'Session is invalid.');
    const session = await this.repository.findSession(sessionId);
    const suppliedHash = this.hash(refreshToken);
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive)
      throw new AppError(401, 'INVALID_SESSION', 'Session is invalid.');
    if (
      session.previousRefreshTokenHash &&
      this.safeEqual(suppliedHash, session.previousRefreshTokenHash)
    ) {
      await this.repository.revokeAllSessions(session.userId, 'refresh_token_reuse');
      throw new AppError(401, 'TOKEN_REUSE_DETECTED', 'Session security violation detected.');
    }
    if (!this.safeEqual(suppliedHash, session.refreshTokenHash))
      throw new AppError(401, 'INVALID_SESSION', 'Session is invalid.');
    const nextToken = `${session.id}.${randomBytes(32).toString('base64url')}`;
    const expiresAt = this.refreshExpiry();
    const rotated = await this.repository.rotateSession(
      session.id,
      suppliedHash,
      this.hash(nextToken),
      expiresAt,
    );
    if (!rotated) throw new AppError(401, 'INVALID_SESSION', 'Session is invalid.');
    return {
      accessToken: await this.signAccessToken(session.userId, session.id),
      refreshToken: nextToken,
      expiresAt,
    };
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: 'hello-shop-api',
        audience: 'hello-shop-dashboard',
      });
      if (!payload.sub || typeof payload.sid !== 'string') throw new Error('invalid claims');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    const membership = await this.repository.resolveMembership(sessionId, userId);
    await this.repository.revokeSession(sessionId, 'user_logout');
    if (membership)
      await this.repository.createAudit({
        businessId: membership.businessId,
        actorUserId: userId,
        action: 'auth.logout',
        entityType: 'LoginSession',
        entityId: sessionId,
      });
  }

  private signAccessToken(userId: string, sessionId: string): Promise<string> {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('hello-shop-api')
      .setAudience('hello-shop-dashboard')
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTtlSeconds}s`)
      .sign(this.key);
  }
  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.refreshTtlDays * 86_400_000);
  }
  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
