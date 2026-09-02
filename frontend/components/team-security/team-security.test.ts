import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const team = read('./team-workspace.tsx');
const member = read('./member-workspaces.tsx');
const roles = read('./roles-workspace.tsx');
const approvals = read('./approval-workspaces.tsx');
const api = read('../../lib/api/team-security.ts');
const navigation = read('../../lib/navigation.ts');
const notice = read('./approval-required-notice.tsx');

describe('STEP 11 authenticated workspaces', () => {
  it('provides Team directory, invitation, member security, and session revocation UX', () => {
    for (const text of ['Team', 'Manage Roles', 'Invite Member', 'Employee Code', 'Job Title'])
      expect(team).toContain(text);
    for (const text of [
      'No password is created by an administrator',
      'Job title',
      'Employee code',
      'Revoke sessions',
      'Assigned role',
    ])
      expect(member).toContain(text);
  });
  it('groups canonical permissions instead of rendering a flat string matrix', () => {
    expect(roles).toContain('permissions.reduce<Map<string, Permission[]>>');
    expect(roles).toContain('Select module');
    expect(roles).toContain('Clear module');
    expect(roles).toContain('System');
    expect(roles).toContain('Protected');
  });
  it('provides approval tabs, human-readable detail, policies, and read-only audit tables', () => {
    for (const text of [
      'PENDING',
      'APPROVED',
      'EXECUTED',
      'Impact summary',
      'Reviewer note',
      'Approval policies',
      'Audit log',
      'Append-only',
      'Pending My Review',
      'My Requests',
      'Completed',
      'From date',
      'To date',
      'Audit event detail',
      'Changes',
    ])
      expect(approvals).toContain(text);
    expect(approvals).not.toContain('JSON.stringify(row.payloadSnapshot');
    expect(approvals).not.toContain('Clear Audit History');
    expect(notice).toContain('/approvals/${error.approvalId}');
    expect(notice).toContain('View Approval Request');
  });
  it('keeps tenant, permission, and approver identity out of frontend authority', () => {
    expect(api).not.toContain('body: JSON.stringify({ businessId');
    expect(api).not.toContain('reviewerId');
    expect(api).not.toContain('body: JSON.stringify({ permissions');
  });
  it('exposes permission-aware Team, Roles, Approvals, Policies, and Audit navigation', () => {
    for (const path of [
      '/settings/team',
      '/settings/roles',
      '/settings/approval-policies',
      '/settings/audit-log',
      '/approvals',
    ])
      expect(navigation).toContain(path);
  });
});
