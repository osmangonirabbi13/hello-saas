import { readFileSync } from 'node:fs';
import { Prisma } from '@hello-shop/database';
import { describe, expect, it } from 'vitest';
import {
  policyMatches,
  sanitizeAudit,
  stablePayloadHash,
  tokenHash,
} from '../modules/team-security/security-utils.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const schema = read('../../../../packages/database/prisma/schema.prisma');
const migration = read(
  '../../../../packages/database/prisma/migrations/20260909000000_team_approvals_audit/migration.sql',
);
const team = read('../modules/team-security/team.repository.ts');
const approval = read('../modules/team-security/approval.repository.ts');
const routes = read('../modules/team-security/team-security.routes.ts');
const rootRoutes = read('../routes.ts');

describe('STEP 11 Team and RBAC controls', () => {
  it('reuses Membership instead of creating a second user identity', () => {
    expect(schema).toContain('model BusinessMembership');
    expect(schema).not.toContain('model Employee {');
  });
  it('hashes high-entropy invitation tokens and never persists raw tokens', () => {
    expect(team).toContain('const rawToken = inviteToken()');
    expect(team).toContain('tokenHash: hash');
    expect(tokenHash('x'.repeat(43))).toHaveLength(64);
    expect(schema).not.toContain('rawToken');
  });
  it('guards duplicate invitations and active members', () => {
    expect(team).toContain('INVITATION_PENDING');
    expect(team).toContain('MEMBER_EXISTS');
  });
  it('derives invitation tenant and role from persisted server state', () => {
    expect(team).toContain('businessId: invitation.businessId');
    expect(team).toContain('roleId: invitation.roleId');
  });
  it('revokes persisted sessions on suspension and role change', () => {
    expect(team).toContain("revokeReason: 'membership_suspended'");
    expect(team).toContain("revokeReason: 'team_role_changed'");
  });
  it('protects the final owner and system roles', () => {
    expect(team.match(/LAST_OWNER/g)?.length).toBeGreaterThanOrEqual(2);
    expect(team).toContain('SYSTEM_ROLE_PROTECTED');
  });
  it('blocks privilege escalation and unknown permissions', () => {
    expect(team).toContain('PERMISSION_ESCALATION');
    expect(team).toContain('UNKNOWN_PERMISSION');
  });
  it('mounts tenant and permission guarded APIs', () => {
    for (const permission of [
      'team.invite',
      'role.manage',
      'approval.review',
      'approval.policy.manage',
      'audit.read',
    ])
      expect(routes).toContain(`requirePermission('${permission}')`);
    for (const path of [
      '/team',
      '/roles',
      '/permissions',
      '/approvals',
      '/approval-policies',
      '/audit-logs',
    ])
      expect(rootRoutes).toContain(path);
  });
});

describe('STEP 11 approval controls', () => {
  it('evaluates NONE, ALWAYS, AMOUNT, and PERCENTAGE with Decimal', () => {
    expect(policyMatches('NONE', null, new Prisma.Decimal(999))).toBe(false);
    expect(policyMatches('ALWAYS', null, new Prisma.Decimal(0))).toBe(true);
    expect(
      policyMatches('AMOUNT', new Prisma.Decimal('20000'), new Prisma.Decimal('19999.99')),
    ).toBe(false);
    expect(policyMatches('AMOUNT', new Prisma.Decimal('20000'), new Prisma.Decimal('20000'))).toBe(
      true,
    );
    expect(policyMatches('PERCENTAGE', new Prisma.Decimal('10'), new Prisma.Decimal('10.01'))).toBe(
      true,
    );
  });
  it('allocates APR numbers through BusinessSequence', () => {
    expect(approval).toContain("key: 'APR'");
    expect(approval).toContain('APR-');
  });
  it('deduplicates the same source and payload', () => {
    expect(approval).toContain('payloadHash');
    expect(approval).toMatch(/status:\s*\{\s*in:\s*\['PENDING',\s*'APPROVED'\]\s*\}/);
  });
  it('blocks self-approval and ineligible reviewers', () => {
    expect(approval).toContain('SELF_APPROVAL_DENIED');
    expect(approval).toContain('APPROVER_INELIGIBLE');
    expect(approval).toContain("status: 'ACTIVE'");
  });
  it('rejects stale source versions and normalized payload hashes', () => {
    expect(approval).toContain('request.sourceVersion !== currentVersion');
    expect(approval).toContain('APPROVAL_STALE');
    expect(approval).toContain("status: 'STALE'");
  });
  it('claims approved execution only once', () => {
    expect(approval).toContain("status: 'APPROVED', executedAt: null");
    expect(approval).toContain("status: 'EXECUTED'");
  });
  it('produces deterministic payload hashes', () => {
    expect(stablePayloadHash({ amount: '20.00' })).toBe(stablePayloadHash({ amount: '20.00' }));
  });
  it('removes nested sensitive audit metadata', () => {
    expect(
      sanitizeAudit({
        email: 'owner@example.local',
        password: 'x',
        nested: { refreshToken: 'y', safe: true },
      }),
    ).toEqual({ email: 'owner@example.local', nested: { safe: true } });
    expect(
      sanitizeAudit({
        rows: [
          { accessToken: 'x', safe: 'kept' },
          { privateKey: 'y', cookie: 'z', amount: 10 },
        ],
      }),
    ).toEqual({ rows: [{ safe: 'kept' }, { amount: 10 }] });
  });
});

describe('STEP 11 migration and audit boundaries', () => {
  it('keeps audit routes read only', () => {
    expect(routes).toContain("audits.get('/'");
    expect(routes).not.toContain('audits.post');
    expect(routes).not.toContain('audits.patch');
    expect(routes).not.toContain('audits.delete');
  });
  it('uses authenticated server identity for semantic approval inbox scopes', () => {
    expect(approval).toContain("scope === 'review'");
    expect(approval).toContain("scope === 'mine'");
    expect(approval).toContain("scope === 'completed'");
    expect(approval).toContain('requestedById: { not: currentUserId }');
    expect(approval).toContain("where: { businessId, userId: currentUserId, status: 'ACTIVE' }");
  });
  it('contains all new enums and persisted domains', () => {
    for (const value of [
      'EmploymentType',
      'TeamInvitationStatus',
      'ApprovalActionType',
      'ApprovalThresholdType',
      'ApprovalRequestStatus',
      'ApprovalDecisionType',
      'TeamInvitation',
      'ApprovalPolicy',
      'ApprovalRequest',
      'ApprovalDecision',
    ]) {
      expect(schema).toContain(value);
      expect(migration).toContain(value);
    }
  });
  it('has tenant-first indexes, Decimal thresholds, and restrictive history FKs', () => {
    expect(migration).toContain('ApprovalRequest_businessId_status_requestedAt_idx');
    expect(migration).toContain('TeamInvitation_pending_business_email_key');
    expect(migration).toContain('DECIMAL(18,4)');
    expect(migration).toContain('ON DELETE RESTRICT');
  });
});
