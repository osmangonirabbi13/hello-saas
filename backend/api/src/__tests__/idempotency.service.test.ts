import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
}));

vi.mock('@hello-shop/database', () => {
  const keyOf = (where: Record<string, unknown>) => {
    const key = where.businessId_operationId_operationScope as Record<string, string>;
    return `${key.businessId}::${key.operationId}::${key.operationScope}`;
  };
  const tx = {
    mutationIdempotency: {
      findUnique: vi.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(state.records.get(keyOf(where)) ?? null),
      ),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const key = `${String(data.businessId)}::${String(data.operationId)}::${String(data.operationScope)}`;
        state.records.set(key, { ...data });
        return Promise.resolve(data);
      }),
      update: vi.fn(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const key = keyOf(where);
        const value = { ...state.records.get(key), ...data };
        state.records.set(key, value);
        return Promise.resolve(value);
      }),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => {
        const snapshot = new Map(state.records);
        try {
          return await run(tx);
        } catch (error) {
          state.records = snapshot;
          throw error;
        }
      }),
    },
  };
});

import { executeIdempotent } from '../modules/sync/mutation-idempotency.js';

const identity = {
  operationId: 'op_123e4567-e89b-12d3-a456-426614174000',
  operationScope: 'PRODUCT_CREATE',
};

describe('durable idempotency orchestration', () => {
  beforeEach(() => state.records.clear());

  it('executes the first create once and returns the stored result for an exact retry', async () => {
    const execute = vi.fn().mockResolvedValue({ id: 'product-1', name: 'Mouse' });
    const input = { businessId: 'business-a', userId: 'user-a', identity, payload: { name: 'Mouse' }, execute };
    expect(await executeIdempotent(input)).toEqual({ id: 'product-1', name: 'Mouse' });
    expect(await executeIdempotent(input)).toEqual({ id: 'product-1', name: 'Mouse' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed payload and separates tenant and operation scopes', async () => {
    const execute = vi.fn().mockResolvedValue({ id: 'one' });
    await executeIdempotent({ businessId: 'business-a', userId: 'user-a', identity, payload: { name: 'A' }, execute });
    await expect(executeIdempotent({ businessId: 'business-a', userId: 'user-a', identity, payload: { name: 'B' }, execute })).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
    await executeIdempotent({ businessId: 'business-b', userId: 'user-b', identity, payload: { name: 'B' }, execute });
    await executeIdempotent({ businessId: 'business-a', userId: 'user-a', identity: { ...identity, operationScope: 'CUSTOMER_CREATE' }, payload: { name: 'B' }, execute });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('rolls back a failed claim so no false success is retained', async () => {
    await expect(executeIdempotent({
      businessId: 'business-a',
      userId: 'user-a',
      identity,
      payload: { name: 'A' },
      execute: vi.fn().mockRejectedValue(new Error('create failed')),
    })).rejects.toThrow('create failed');
    expect(state.records).toHaveLength(0);
  });
});
