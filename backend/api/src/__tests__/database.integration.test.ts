import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, assertLocalDatabaseUrl } from '@hello-shop/database';
import { createApp } from '../app.js';
import { PrismaAuthRepository } from '../modules/auth/auth.repository.js';
import { AuthService } from '../modules/auth/auth.service.js';

const enabled = process.env.RUN_DATABASE_INTEGRATION === 'true';
const suite = enabled ? describe.sequential : describe.skip;
const suffix = Date.now().toString(36);
const password = 'LocalIntegrationOnly!42';
const primaryEmail = 'owner-' + suffix + '@integration.local';
const secondEmail = 'other-' + suffix + '@integration.local';
const repository = new PrismaAuthRepository();
const service = new AuthService(repository, {
  secret: 'integration-secret-longer-than-thirty-two-characters',
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
const createdBusinessIds: string[] = [];
const createdUserIds: string[] = [];

function bearer(token: string) {
  return { authorization: 'Bearer ' + token };
}
function refreshCookie(response: request.Response): string {
  const header = response.headers['set-cookie'] as string | string[] | undefined;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error('Refresh cookie missing');
  return value.split(';')[0]!;
}
async function login(email = primaryEmail) {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

suite('real PostgreSQL authentication and tenancy', () => {
  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.');
    const parsed = assertLocalDatabaseUrl(databaseUrl);
    if (!parsed.pathname.endsWith('_test'))
      throw new Error('Integration tests require a dedicated local database ending in _test.');
    for (const [email, businessName, businessSlug] of [
      [primaryEmail, 'Primary ' + suffix, 'primary-' + suffix],
      [secondEmail, 'Other ' + suffix, 'other-' + suffix],
    ] as const) {
      await service.register({
        email,
        password,
        displayName: 'Integration Owner',
        businessName,
        businessSlug,
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { memberships: true },
      });
      createdUserIds.push(user.id);
      createdBusinessIds.push(user.memberships[0]!.businessId);
    }
  });

  afterAll(async () => {
    if (!enabled || !createdBusinessIds.length) return;
    await prisma.loginSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.auditLog.deleteMany({ where: { businessId: { in: createdBusinessIds } } });
    await prisma.businessMembership.deleteMany({
      where: { businessId: { in: createdBusinessIds } },
    });
    await prisma.role.deleteMany({ where: { businessId: { in: createdBusinessIds } } });
    await prisma.business.deleteMany({ where: { id: { in: createdBusinessIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('logs in successfully and rejects an invalid password', async () => {
    const accepted = await login();
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.permissions).toContain('dashboard.read');
    const rejected = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: primaryEmail, password: 'InvalidPassword!42' });
    expect(rejected.status).toBe(401);
  });
  it('resolves persisted membership and ignores every client tenant hint', async () => {
    const auth = await login();
    const response = await request(app)
      .get('/api/v1/dashboard/context?businessId=' + createdBusinessIds[1])
      .set(bearer(String(auth.body.data.accessToken)))
      .set('x-business-id', createdBusinessIds[1]!)
      .send({ businessId: createdBusinessIds[1] });
    expect(response.status).toBe(200);
    expect(response.body.data.businessId).toBe(createdBusinessIds[0]);
  });
  it('denies a suspended persisted membership', async () => {
    const auth = await login();
    const userId = createdUserIds[0]!;
    const businessId = createdBusinessIds[0]!;
    await prisma.businessMembership.update({
      where: { businessId_userId: { businessId, userId } },
      data: { status: 'SUSPENDED' },
    });
    const response = await request(app)
      .get('/api/v1/dashboard/context')
      .set(bearer(String(auth.body.data.accessToken)));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('INVALID_MEMBERSHIP');
    await prisma.businessMembership.update({
      where: { businessId_userId: { businessId, userId } },
      data: { status: 'ACTIVE' },
    });
  });
  it('enforces persisted permission grants', async () => {
    const businessId = createdBusinessIds[0]!;
    const userId = createdUserIds[0]!;
    const cashier = await prisma.role.findUniqueOrThrow({
      where: { businessId_name: { businessId, name: 'CASHIER' } },
    });
    const membership = await prisma.businessMembership.update({
      where: { businessId_userId: { businessId, userId } },
      data: { roleId: cashier.id },
    });
    const dashboardPermission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'dashboard.read' },
    });
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: cashier.id, permissionId: dashboardPermission.id } },
    });
    const auth = await login();
    const response = await request(app)
      .get('/api/v1/dashboard/context')
      .set(bearer(String(auth.body.data.accessToken)));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
    const owner = await prisma.role.findUniqueOrThrow({
      where: { businessId_name: { businessId, name: 'OWNER' } },
    });
    await prisma.businessMembership.update({
      where: { id: membership.id },
      data: { roleId: owner.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: cashier.id, permissionId: dashboardPermission.id },
    });
  });
  it('denies a persisted cross-tenant session mismatch', async () => {
    const auth = await login();
    const claims = await service.verifyAccessToken(String(auth.body.data.accessToken));
    await prisma.loginSession.update({
      where: { id: claims.sessionId },
      data: { businessId: createdBusinessIds[1]! },
    });
    const response = await request(app)
      .get('/api/v1/dashboard/context')
      .set(bearer(String(auth.body.data.accessToken)));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('INVALID_MEMBERSHIP');
  });
  it('rotates refresh tokens and revokes all sessions on reuse', async () => {
    const first = await login();
    const originalCookie = refreshCookie(first);
    const rotated = await request(app).post('/api/v1/auth/refresh').set('cookie', originalCookie);
    expect(rotated.status).toBe(200);
    const rotatedCookie = refreshCookie(rotated);
    expect(rotatedCookie).not.toBe(originalCookie);
    const reuse = await request(app).post('/api/v1/auth/refresh').set('cookie', originalCookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    const revoked = await request(app).post('/api/v1/auth/refresh').set('cookie', rotatedCookie);
    expect(revoked.status).toBe(401);
  });
  it('revokes the session on logout and rejects it afterward', async () => {
    const auth = await login();
    const token = String(auth.body.data.accessToken);
    const cookie = refreshCookie(auth);
    const logout = await request(app).post('/api/v1/auth/logout').set(bearer(token));
    expect(logout.status).toBe(200);
    const refresh = await request(app).post('/api/v1/auth/refresh').set('cookie', cookie);
    expect(refresh.status).toBe(401);
    const context = await request(app).get('/api/v1/dashboard/context').set(bearer(token));
    expect(context.status).toBe(403);
  });
});
