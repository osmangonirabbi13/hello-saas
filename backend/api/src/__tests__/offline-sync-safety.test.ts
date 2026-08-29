import { describe, expect, it } from 'vitest';
import { AppError } from '../common/errors/app-error.js';
import {
  expectedVersion,
  mutationIdentity,
  requestHash,
} from '../modules/sync/mutation-idempotency.js';

describe('offline mutation contracts', () => {
  it('hashes equivalent payloads deterministically and distinguishes changed data', () => {
    expect(requestHash({ name: 'Mouse', sku: 'M-1' })).toBe(
      requestHash({ sku: 'M-1', name: 'Mouse' }),
    );
    expect(requestHash({ name: 'Mouse' })).not.toBe(requestHash({ name: 'Keyboard' }));
  });

  it('validates operation IDs without accepting tenant identity', () => {
    const identity = mutationIdentity(
      'op_123e4567-e89b-12d3-a456-426614174000',
      'PRODUCT_CREATE',
    );
    expect(identity).toEqual({
      operationId: 'op_123e4567-e89b-12d3-a456-426614174000',
      operationScope: 'PRODUCT_CREATE',
    });
    expect(() => mutationIdentity('business-victim', 'PRODUCT_CREATE')).toThrow(AppError);
  });

  it('accepts only positive integer optimistic versions', () => {
    expect(expectedVersion('2')).toBe(2);
    expect(() => expectedVersion('0')).toThrow(/positive version/);
  });
});
