import argon2 from 'argon2';
import pino from 'pino';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { AuthService } from '../modules/auth/auth.service.js';
import type {
  AuthRepository,
  MembershipRecord,
  SessionRecord,
  UserRecord,
} from '../modules/auth/auth.types.js';

class TestRepository implements AuthRepository {
  user: UserRecord | null = null;
  membership: MembershipRecord | null = null;
  sessions = new Map<string, SessionRecord>();
  audits: string[] = [];
  async createBusinessOwner(): Promise<void> {
    throw new Error('Not used by foundation unit tests');
  }
  async findUserByEmail(email: string) {
    return this.user?.email === email ? this.user : null;
  }
  async findFirstActiveMembership(userId: string) {
    return this.user?.id === userId ? this.membership : null;
  }
  async createSession(input: Parameters<AuthRepository['createSession']>[0]) {
    if (!this.user) throw new Error('test user missing');
    this.sessions.set(input.id, {
      id: input.id,
      userId: input.userId,
      businessId: input.businessId,
      membershipId: input.membershipId,
      refreshTokenHash: input.refreshTokenHash,
      previousRefreshTokenHash: null,
      expiresAt: input.expiresAt,
      revokedAt: null,
      user: { id: this.user.id, email: this.user.email, isActive: this.user.isActive },
    });
  }
  async findSession(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async rotateSession(id: string, currentHash: string, nextHash: string, expiresAt: Date) {
    const session = this.sessions.get(id);
    if (!session || session.refreshTokenHash !== currentHash || session.revokedAt) return false;
    session.previousRefreshTokenHash = currentHash;
    session.refreshTokenHash = nextHash;
    session.expiresAt = expiresAt;
    return true;
  }
  async revokeSession(id: string, reason: string) {
    const session = this.sessions.get(id);
    if (session) session.revokedAt = new Date();
    void reason;
  }
  async revokeAllSessions(userId: string, reason: string) {
    for (const session of this.sessions.values())
      if (session.userId === userId) session.revokedAt = new Date();
    void reason;
  }
  async resolveMembership(sessionId: string, userId: string) {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    )
      return null;
    if (
      !this.membership ||
      session.membershipId !== this.membership.id ||
      session.businessId !== this.membership.businessId
    )
      return null;
    return this.membership;
  }
  async createAudit(input: Parameters<AuthRepository['createAudit']>[0]) {
    this.audits.push(input.action);
  }
}

const repository = new TestRepository();
const service = new AuthService(repository, {
  secret: 'test-secret-that-is-longer-than-thirty-two-characters',
  accessTtlSeconds: 900,
  refreshTtlDays: 30,
});
const app = createApp({
  authService: service,
  authRepository: repository,
  logger: pino({ enabled: false }),
  corsOrigins: ['http://localhost:3000'],
  cookieSecure: false,
  readinessCheck: async () => ({ database: true, redis: true }),
});

beforeAll(async () => {
  repository.user = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    passwordHash: await argon2.hash('correct-password'),
    isActive: true,
  };
  repository.membership = {
    id: 'membership-1',
    businessId: 'business-a',
    businessName: 'Hello shop',
    businessActive: true,
    status: 'ACTIVE',
    permissions: ['dashboard.read'],
  };
});

async function login() {
  return request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@example.com', password: 'correct-password' });
}

describe('health', () => {
  it('reports liveness', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
  it('reports dependency readiness', async () => {
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });
});

describe('authentication and authorization foundation', () => {
  it('authenticates and creates a secure refresh cookie', async () => {
    const response = await login();
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Strict');
    expect(repository.audits).toContain('auth.login');
  });
  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'wrong-password' });
    expect(response.status).toBe(401);
  });
  it('rejects unauthenticated protected access', async () => {
    const response = await request(app).get('/api/v1/dashboard/context');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
  it('resolves the tenant from the session and ignores client business IDs', async () => {
    const auth = await login();
    const token = auth.body.data.accessToken as string;
    const response = await request(app)
      .get('/api/v1/dashboard/context?businessId=business-b')
      .set('authorization', 'Bearer ' + token)
      .set('x-business-id', 'business-b')
      .send({ businessId: 'business-b' });
    expect(response.status).toBe(200);
    expect(response.body.data.businessId).toBe('business-a');
  });
  it('denies an invalid membership', async () => {
    const auth = await login();
    repository.membership = { ...repository.membership!, status: 'SUSPENDED' };
    const response = await request(app)
      .get('/api/v1/dashboard/context')
      .set('authorization', 'Bearer ' + String(auth.body.data.accessToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('INVALID_MEMBERSHIP');
    repository.membership = { ...repository.membership, status: 'ACTIVE' };
  });
  it('denies a missing permission', async () => {
    const auth = await login();
    repository.membership = { ...repository.membership!, permissions: [] };
    const response = await request(app)
      .get('/api/v1/dashboard/context')
      .set('authorization', 'Bearer ' + String(auth.body.data.accessToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
    repository.membership = { ...repository.membership, permissions: ['dashboard.read'] };
  });
  it('denies Customer access without the persisted API permission', async () => {
    const auth = await login();
    const response = await request(app)
      .get('/api/v1/customers')
      .set('authorization', 'Bearer ' + String(auth.body.data.accessToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });
  it('denies inventory access without the persisted API permission', async () => {
    const auth = await login();
    const response = await request(app)
      .get('/api/v1/inventory/stock')
      .set('authorization', 'Bearer ' + String(auth.body.data.accessToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });
  it('denies Purchase access without the persisted API permission', async () => {
    const auth = await login();
    const response = await request(app)
      .get('/api/v1/purchases')
      .set('authorization', 'Bearer ' + String(auth.body.data.accessToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });
});
