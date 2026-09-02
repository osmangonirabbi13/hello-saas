import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  tx: {
    role: { findFirst: vi.fn() },
    businessMembership: { findFirst: vi.fn(), upsert: vi.fn() },
    teamInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@hello-shop/database', () => ({
  prisma: {
    $transaction: vi.fn((operation: (tx: typeof state.tx) => unknown) => operation(state.tx)),
  },
}));

import { TeamRepository } from '../modules/team-security/team.repository.js';
import { tokenHash } from '../modules/team-security/security-utils.js';

const invitation = {
  id: 'invite_1',
  businessId: 'business_1',
  email: 'person@example.local',
  roleId: 'role_1',
  status: 'PENDING',
  tokenHash: tokenHash('x'.repeat(43)),
  jobTitle: 'Cashier',
  employeeCode: 'E-1',
  expiresAt: new Date(Date.now() + 60_000),
  role: { id: 'role_1', name: 'CASHIER' },
};

describe('STEP 11 invitation behavior without database infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.tx.role.findFirst.mockResolvedValue({ id: 'role_1', name: 'CASHIER' });
    state.tx.businessMembership.findFirst.mockResolvedValue(null);
    state.tx.teamInvitation.findFirst.mockResolvedValue(null);
    state.tx.teamInvitation.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...invitation,
        ...data,
      }),
    );
    state.tx.auditLog.create.mockResolvedValue({});
  });

  it('creates an audited invitation, persists only a hash, and returns the raw token once', async () => {
    const repository = new TeamRepository();
    const result = await repository.invite('business_1', 'owner_1', {
      email: invitation.email,
      roleId: 'role_1',
      jobTitle: null,
      employeeCode: null,
      expiresInHours: 72,
    });
    const persisted = state.tx.teamInvitation.create.mock.calls[0]?.[0].data as {
      tokenHash: string;
    };
    expect(result.inviteToken).toHaveLength(43);
    expect(persisted.tokenHash).toHaveLength(64);
    expect(persisted).not.toHaveProperty('inviteToken');
    expect(state.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'team.invitation.created' }),
      }),
    );
  });

  it('rejects an existing active member and a duplicate pending invitation', async () => {
    const repository = new TeamRepository();
    state.tx.businessMembership.findFirst.mockResolvedValueOnce({ id: 'membership_1' });
    await expect(
      repository.invite('business_1', 'owner_1', {
        email: invitation.email,
        roleId: 'role_1',
        expiresInHours: 72,
      }),
    ).rejects.toMatchObject({ code: 'MEMBER_EXISTS' });
    state.tx.businessMembership.findFirst.mockResolvedValueOnce(null);
    state.tx.teamInvitation.findFirst.mockResolvedValueOnce(invitation);
    await expect(
      repository.invite('business_1', 'owner_1', {
        email: invitation.email,
        roleId: 'role_1',
        expiresInHours: 72,
      }),
    ).rejects.toMatchObject({ code: 'INVITATION_PENDING' });
  });

  it('accepts once and derives business and role exclusively from the persisted invitation', async () => {
    const repository = new TeamRepository();
    state.tx.teamInvitation.findUnique.mockResolvedValueOnce(invitation);
    state.tx.user.findUnique.mockResolvedValueOnce({
      id: 'user_1',
      email: invitation.email,
    });
    state.tx.businessMembership.upsert.mockResolvedValueOnce({ id: 'membership_1' });
    state.tx.teamInvitation.update.mockResolvedValueOnce({ ...invitation, status: 'ACCEPTED' });
    const result = await repository.acceptInvitation('user_1', 'x'.repeat(43));
    expect(result).toEqual({ id: 'membership_1' });
    expect(state.tx.businessMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          businessId: 'business_1',
          roleId: 'role_1',
          userId: 'user_1',
        }),
      }),
    );
    expect(state.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'team.invitation.accepted' }),
      }),
    );

    state.tx.teamInvitation.findUnique.mockResolvedValueOnce({
      ...invitation,
      status: 'ACCEPTED',
    });
    state.tx.user.findUnique.mockResolvedValueOnce({
      id: 'user_1',
      email: invitation.email,
    });
    await expect(repository.acceptInvitation('user_1', 'x'.repeat(43))).rejects.toMatchObject({
      code: 'INVITATION_INVALID',
    });
  });

  it('rejects expired, revoked, wrong-email, and unknown invitations', async () => {
    const repository = new TeamRepository();
    const cases = [
      { ...invitation, expiresAt: new Date(Date.now() - 60_000) },
      { ...invitation, status: 'REVOKED' },
      invitation,
      null,
    ];
    for (const [index, value] of cases.entries()) {
      state.tx.teamInvitation.findUnique.mockResolvedValueOnce(value);
      state.tx.user.findUnique.mockResolvedValueOnce(
        index === 2 ? { id: 'user_1', email: 'other@example.local' } : { id: 'user_1', email: invitation.email },
      );
      await expect(repository.acceptInvitation('user_1', 'x'.repeat(43))).rejects.toMatchObject({
        code: index === 0 ? 'INVITATION_EXPIRED' : 'INVITATION_INVALID',
      });
    }
  });
});
