import { describe, expect, it, vi } from 'vitest';
import {
  adjustmentCreateSchema,
  serialListQuerySchema,
  stockListQuerySchema,
} from '@hello-shop/validation';
import { InventoryService } from '../modules/inventory/inventory.service.js';
import {
  stockStatus,
  type InventoryRepositoryContract,
  type MovementInput,
} from '../modules/inventory/inventory.types.js';
const movement: MovementInput = {
  warehouseId: 'warehouse-a',
  productId: 'product-a',
  type: 'ADJUSTMENT_OUT',
  quantity: '2',
};
function repository(
  overrides: Partial<InventoryRepositoryContract> = {},
): InventoryRepositoryContract {
  return {
    context: vi
      .fn()
      .mockResolvedValue({
        product: { id: 'product-a', allowNegativeStock: false, trackStock: true },
        warehouse: { id: 'warehouse-a' },
      }),
    balance: vi.fn().mockResolvedValue(5),
    applyAtomic: vi.fn().mockResolvedValue({ movement: {}, quantity: 3 }),
    applyWithTransaction: vi.fn().mockResolvedValue({ movement: {}, quantity: 3 }),
    createAdjustmentAtomic: vi.fn().mockResolvedValue({ id: 'adjustment-a' }),
    listStock: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    listMovements: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    listAdjustments: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    findAdjustment: vi.fn().mockResolvedValue(null),
    listWarehouses: vi.fn().mockResolvedValue([]),
    listSerials: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    findSerial: vi.fn().mockResolvedValue(null),
    findSerialByNumber: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}
describe('inventory validation and calculations', () => {
  it('rejects negative and zero adjustment quantities', () => {
    const base = {
      warehouseId: 'cm12345678901234567890123',
      reason: 'PHYSICAL_COUNT',
      lines: [
        { productId: 'cm12345678901234567890124', direction: 'ADJUSTMENT_IN', quantity: '-1' },
      ],
    };
    expect(adjustmentCreateSchema.safeParse(base).success).toBe(false);
    expect(
      adjustmentCreateSchema.safeParse({ ...base, lines: [{ ...base.lines[0], quantity: '0' }] })
        .success,
    ).toBe(false);
  });
  it('bounds stock and serial pagination', () => {
    expect(stockListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(serialListQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });
  it('derives low, out, and negative statuses', () => {
    expect(stockStatus(3, 5)).toBe('LOW_STOCK');
    expect(stockStatus(0, 5)).toBe('OUT_OF_STOCK');
    expect(stockStatus(-1, 5)).toBe('NEGATIVE_STOCK');
  });
});
describe('InventoryService boundaries', () => {
  it('propagates only server tenant context and applies movement/balance atomically through one contract', async () => {
    const applyAtomic = vi.fn().mockResolvedValue({ movement: {}, quantity: 3 });
    await new InventoryService(repository({ applyAtomic })).applyMovement(
      'business-a',
      'user-a',
      movement,
    );
    expect(applyAtomic).toHaveBeenCalledWith('business-a', 'user-a', movement, -2);
  });
  it('rejects cross-tenant product or warehouse context', async () => {
    const service = new InventoryService(repository({ context: vi.fn().mockResolvedValue(null) }));
    await expect(service.applyMovement('business-a', 'user-a', movement)).rejects.toMatchObject({
      statusCode: 404,
      code: 'INVENTORY_CONTEXT_NOT_FOUND',
    });
  });
  it('denies negative stock when product policy is false', async () => {
    const service = new InventoryService(repository({ balance: vi.fn().mockResolvedValue(1) }));
    await expect(service.applyMovement('business-a', 'user-a', movement)).rejects.toMatchObject({
      code: 'NEGATIVE_STOCK_DENIED',
    });
  });
  it('allows deliberate negative stock when product policy is true', async () => {
    const applyAtomic = vi.fn().mockResolvedValue({ movement: {}, quantity: -1 });
    const context = vi
      .fn()
      .mockResolvedValue({
        product: { id: 'product-a', allowNegativeStock: true, trackStock: true },
        warehouse: { id: 'warehouse-a' },
      });
    await expect(
      new InventoryService(
        repository({ context, balance: vi.fn().mockResolvedValue(1), applyAtomic }),
      ).applyMovement('business-a', 'user-a', movement),
    ).resolves.toMatchObject({ quantity: -1 });
  });
  it('maps adjustment direction into movement validation and delegates one atomic adjustment', async () => {
    const createAdjustmentAtomic = vi.fn().mockResolvedValue({ id: 'adjustment-a' });
    const input = {
      warehouseId: 'warehouse-a',
      reason: 'PHYSICAL_COUNT' as const,
      lines: [{ productId: 'product-a', direction: 'ADJUSTMENT_IN' as const, quantity: '2' }],
    };
    await new InventoryService(repository({ createAdjustmentAtomic })).createAdjustment(
      'business-a',
      'user-a',
      input,
    );
    expect(createAdjustmentAtomic).toHaveBeenCalledWith('business-a', 'user-a', input);
  });
  it('hides cross-tenant serial identifiers with not-found semantics', async () => {
    await expect(
      new InventoryService(repository()).findSerial('business-a', 'serial-from-b'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'SERIAL_NOT_FOUND' });
  });
});
