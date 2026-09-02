import { Prisma } from '@hello-shop/database';
import { describe, expect, it, vi } from 'vitest';
import { AccountingService } from '../modules/accounting/accounting.service.js';
import { TeamSecurityService } from '../modules/team-security/team-security.service.js';

const request = {
  id: 'apr_1',
  approvalNumber: 'APR-000001',
  actionType: 'MANUAL_JOURNAL_POST',
};
const journal = {
  id: 'journal_1',
  journalNumber: 'JRN-000001',
  status: 'DRAFT',
  version: 1,
  date: new Date('2026-09-01T00:00:00.000Z'),
  memo: 'Capital',
  fiscalPeriodId: 'period_1',
  lines: [
    {
      accountId: 'cash',
      debit: new Prisma.Decimal(10000),
      credit: new Prisma.Decimal(0),
      description: 'Cash',
    },
    {
      accountId: 'capital',
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(10000),
      description: 'Capital',
    },
  ],
};

describe('STEP 11 authoritative accounting approval integration', () => {
  it('posts normally when policy does not require approval', async () => {
    const repository = {
      findJournal: vi.fn().mockResolvedValue(journal),
      postJournal: vi.fn().mockResolvedValue({ status: 'POSTED' }),
    };
    const approvals = { evaluateAndRequest: vi.fn().mockResolvedValue({ approvalRequired: false }) };
    const service = new AccountingService(repository as never, approvals as never);
    await expect(service.postJournal('business_1', journal.id, 'user_1')).resolves.toEqual({
      status: 'POSTED',
    });
    expect(repository.postJournal).toHaveBeenCalledOnce();
  });

  it('keeps a journal draft and returns a persisted APR when approval is required', async () => {
    const repository = {
      findJournal: vi.fn().mockResolvedValue(journal),
      postJournal: vi.fn(),
    };
    const approvals = {
      evaluateAndRequest: vi.fn().mockResolvedValue({ approvalRequired: true, request }),
    };
    const service = new AccountingService(repository as never, approvals as never);
    await expect(service.postJournal('business_1', journal.id, 'user_1')).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
      details: { approvalId: 'apr_1', approvalNumber: 'APR-000001' },
    });
    expect(repository.postJournal).not.toHaveBeenCalled();
  });

  it('executes approved posting through the existing repository with version/hash inputs', async () => {
    const repository = {
      findJournal: vi.fn().mockResolvedValue(journal),
      postJournal: vi.fn().mockResolvedValue({ status: 'POSTED' }),
    };
    const approvals = {
      evaluateAndRequest: vi
        .fn()
        .mockResolvedValue({ approvalRequired: false, approvedRequest: request }),
      execute: vi.fn(
        async (
          _business: string,
          _id: string,
          _version: number,
          _payload: unknown,
          _actor: string,
          action: () => Promise<unknown>,
        ) => action(),
      ),
    };
    const service = new AccountingService(repository as never, approvals as never);
    await service.postJournal('business_1', journal.id, 'user_1');
    expect(approvals.execute).toHaveBeenCalledWith(
      'business_1',
      'apr_1',
      1,
      expect.objectContaining({ journalNumber: 'JRN-000001', status: 'DRAFT' }),
      'user_1',
      expect.any(Function),
    );
    expect(repository.postJournal).toHaveBeenCalledOnce();
  });

  it('does not create a reversal before approval', async () => {
    const posted = { ...journal, status: 'POSTED' };
    const repository = {
      findJournal: vi.fn().mockResolvedValue(posted),
      reverseJournal: vi.fn(),
    };
    const approvals = {
      evaluateAndRequest: vi.fn().mockResolvedValue({
        approvalRequired: true,
        request: { ...request, actionType: 'JOURNAL_REVERSE' },
      }),
    };
    const service = new AccountingService(repository as never, approvals as never);
    await expect(service.reverseJournal('business_1', journal.id, 'user_1')).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    expect(repository.reverseJournal).not.toHaveBeenCalled();
  });

  it('re-runs Fiscal Period close validation inside approved execution', async () => {
    const period = {
      id: 'period_1',
      name: 'FY 2026',
      status: 'OPEN',
      version: 2,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    };
    const blocker = Object.assign(new Error('Draft journal exists.'), {
      code: 'FISCAL_PERIOD_HAS_DRAFTS',
    });
    const repository = {
      findPeriod: vi.fn().mockResolvedValue(period),
      setPeriodStatus: vi.fn().mockRejectedValue(blocker),
    };
    const approvals = {
      evaluateAndRequest: vi
        .fn()
        .mockResolvedValue({ approvalRequired: false, approvedRequest: request }),
      execute: vi.fn(
        async (
          _business: string,
          _id: string,
          _version: number,
          _payload: unknown,
          _actor: string,
          action: () => Promise<unknown>,
        ) => action(),
      ),
    };
    const service = new AccountingService(repository as never, approvals as never);
    await expect(service.closePeriod('business_1', period.id, 'user_1')).rejects.toBe(blocker);
    expect(repository.setPeriodStatus).toHaveBeenCalledWith('business_1', period.id, 'CLOSED');
  });
});

describe('STEP 11 authoritative Team approval integration', () => {
  const member = {
    id: 'membership_1',
    roleId: 'manager_role',
    version: 4,
    status: 'ACTIVE',
    user: { displayName: 'Team Member' },
    role: { id: 'manager_role', name: 'MANAGER' },
  };
  const admin = {
    id: 'admin_role',
    name: 'ADMIN',
    permissions: [{ permission: { key: 'role.manage' } }],
  };

  it('does not change a role while approval is pending', async () => {
    const team = {
      find: vi.fn().mockResolvedValue(member),
      findRole: vi.fn().mockResolvedValue(admin),
      changeRole: vi.fn(),
    };
    const approvals = {
      evaluateAndRequest: vi.fn().mockResolvedValue({
        approvalRequired: true,
        request: { ...request, actionType: 'TEAM_ROLE_CHANGE' },
      }),
    };
    const service = new TeamSecurityService(team as never, approvals as never);
    await expect(
      service.changeRole('business_1', member.id, 'user_1', admin.id),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    expect(team.changeRole).not.toHaveBeenCalled();
  });

  it('executes an approved role change through last-owner/privilege authority', async () => {
    const protectedFailure = Object.assign(new Error('Last owner.'), { code: 'LAST_OWNER' });
    const team = {
      find: vi.fn().mockResolvedValue(member),
      findRole: vi.fn().mockResolvedValue(admin),
      changeRole: vi.fn().mockRejectedValue(protectedFailure),
    };
    const approvals = {
      evaluateAndRequest: vi
        .fn()
        .mockResolvedValue({ approvalRequired: false, approvedRequest: request }),
      execute: vi.fn(
        async (
          _business: string,
          _id: string,
          _version: number,
          _payload: unknown,
          _actor: string,
          action: () => Promise<unknown>,
        ) => action(),
      ),
    };
    const service = new TeamSecurityService(team as never, approvals as never);
    await expect(
      service.changeRole('business_1', member.id, 'user_1', admin.id),
    ).rejects.toBe(protectedFailure);
    expect(team.changeRole).toHaveBeenCalledOnce();
  });

  it('leaves an active member and sessions unchanged while suspension awaits approval', async () => {
    const team = {
      find: vi.fn().mockResolvedValue(member),
      setStatus: vi.fn(),
    };
    const approvals = {
      evaluateAndRequest: vi.fn().mockResolvedValue({
        approvalRequired: true,
        request: { ...request, actionType: 'TEAM_SUSPEND' },
      }),
    };
    const service = new TeamSecurityService(team as never, approvals as never);
    await expect(service.suspend('business_1', member.id, 'user_1')).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    expect(team.setStatus).not.toHaveBeenCalled();
  });
});
