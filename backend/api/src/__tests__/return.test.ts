import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { purchaseReturnSchema, saleReturnSchema } from '@hello-shop/validation';
import { ReturnService } from '../modules/return/return.service.js';
import type { ReturnRepository } from '../modules/return/return.repository.js';
const repository = readFileSync(
  new URL('../modules/return/return.repository.ts', import.meta.url),
  'utf8',
);
const routes = readFileSync(new URL('../modules/return/return.routes.ts', import.meta.url), 'utf8');
const service = readFileSync(
  new URL('../modules/return/return.service.ts', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL(
    '../../../../packages/database/prisma/migrations/20260903000000_purchase_sale_returns/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const id = 'cm12345678901234567890123';
describe('Purchase and Sale Return authority boundaries', () => {
  it('validates positive unique source lines and duplicate serials', () => {
    const base = {
      sourceId: id,
      returnDate: '2026-09-03',
      reason: 'OTHER',
      lines: [{ sourceLineId: id, quantity: '1', serialNumbers: ['A', 'a'] }],
    };
    expect(purchaseReturnSchema.safeParse(base).success).toBe(false);
    expect(
      saleReturnSchema.safeParse({
        ...base,
        reason: 'CUSTOMER_RETURN',
        lines: [{ sourceLineId: id, quantity: '0', serialNumbers: [] }],
      }).success,
    ).toBe(false);
  });
  it('uses BusinessSequence PRT/SRT numbering rather than count plus one', () => {
    expect(repository).toContain("sequence(tx, businessId, 'PRT')");
    expect(repository).toContain("sequence(tx, businessId, 'SRT')");
    expect(repository).not.toMatch(/\.count\([^)]*\)\s*\+\s*1/);
  });
  it('rechecks posted source, remaining quantity, and serial status in serializable posting', () => {
    expect(repository).toContain("status: 'POSTED'");
    expect(repository).toContain("isolationLevel: 'Serializable'");
    expect(repository).toContain('RETURN_QUANTITY_EXCEEDED');
    expect(repository).toContain("status: 'IN_STOCK'");
    expect(repository).toContain("status: 'SOLD'");
  });
  it('routes all inventory effects through InventoryService and never mutates stock directly', () => {
    expect(service).toContain('applyMovementInTransaction');
    expect(repository).not.toContain('stockBalance.');
    expect(repository).not.toContain('stockMovement.create');
    expect(repository).toContain("type: 'PURCHASE_RETURN'");
    expect(repository).toContain("type: 'SALE_RETURN'");
  });
  it('preserves append-only serial history and transitions statuses', () => {
    expect(repository).toContain('serialHistory.create');
    expect(repository).toContain("status: 'RETURNED_TO_SUPPLIER'");
    expect(repository).toContain("status: 'IN_STOCK'");
    expect(repository).not.toContain('serialItem.delete');
  });
  it('has tenant-scoped granular permission middleware for every mutation', () => {
    for (const permission of ['read', 'create', 'update', 'post', 'delete_draft'])
      expect(routes).toMatch(new RegExp(`prefix\\s*\\+\\s*['"]\\.${permission}['"]`));
    expect(repository).toMatch(/where:\s*\{\s*id,\s*businessId/g);
  });
  it('migration defines independent return documents and does not alter posted sources', () => {
    expect(migration).toContain('CREATE TABLE "PurchaseReturn"');
    expect(migration).toContain('CREATE TABLE "SaleReturn"');
    expect(migration).not.toContain('UPDATE "Purchase"');
    expect(migration).not.toContain('UPDATE "Sale"');
  });
});

describe('ReturnService lifecycle delegation', () => {
  it('derives tenant and actor for Purchase Return draft, post, and delete', async () => {
    const mock = {
      createPurchase: vi.fn().mockResolvedValue({ status: 'DRAFT' }),
      postPurchase: vi.fn().mockResolvedValue({ status: 'POSTED' }),
      deletePurchase: vi.fn().mockResolvedValue({ deleted: true }),
    };
    const returnService = new ReturnService(mock as unknown as ReturnRepository);
    const input = {
      sourceId: id,
      returnDate: new Date('2026-09-03'),
      reason: 'OTHER' as const,
      note: null,
      lines: [{ sourceLineId: id, quantity: '1', serialNumbers: [] }],
    };
    await returnService.createPurchase('business-a', 'user-a', input);
    await returnService.postPurchase('business-a', 'return-a', 'user-a');
    await returnService.deletePurchase('business-a', 'return-a', 'user-a');
    expect(mock.createPurchase).toHaveBeenCalledWith('business-a', 'user-a', input);
    expect(mock.postPurchase).toHaveBeenCalledWith(
      'business-a',
      'return-a',
      'user-a',
      expect.any(Function),
    );
    expect(mock.deletePurchase).toHaveBeenCalledWith('business-a', 'return-a', 'user-a');
  });
  it('supports Walk-in, VAT, and POS through the shared Sale Return repository', async () => {
    const mock = {
      createSale: vi.fn().mockResolvedValue({ customerId: null }),
      saleReturnable: vi.fn().mockResolvedValue({ type: 'VAT' }),
      postSale: vi.fn().mockResolvedValue({ type: 'POS', status: 'POSTED' }),
    };
    const returnService = new ReturnService(mock as unknown as ReturnRepository);
    const input = {
      sourceId: id,
      returnDate: new Date('2026-09-03'),
      reason: 'CUSTOMER_RETURN' as const,
      note: null,
      lines: [{ sourceLineId: id, quantity: '1', serialNumbers: [] }],
    };
    expect(await returnService.createSale('business-a', 'user-a', input)).toMatchObject({
      customerId: null,
    });
    expect(await returnService.saleReturnable('business-a', 'sale-a')).toMatchObject({
      type: 'VAT',
    });
    expect(await returnService.postSale('business-a', 'return-a', 'user-a')).toMatchObject({
      type: 'POS',
      status: 'POSTED',
    });
  });
});
