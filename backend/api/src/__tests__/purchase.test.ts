import { readFileSync } from 'node:fs';
import type { Prisma } from '@hello-shop/database';
import { describe, expect, it, vi } from 'vitest';
import { purchaseCreateSchema, purchaseListQuerySchema } from '@hello-shop/validation';
import { InventoryService } from '../modules/inventory/inventory.service.js';
import type { InventoryRepositoryContract } from '../modules/inventory/inventory.types.js';
import { calculatePurchase, PurchaseService } from '../modules/purchase/purchase.service.js';
import type {
  PurchaseInput,
  PurchaseRepositoryContract,
  PostingPurchase,
} from '../modules/purchase/purchase.types.js';
const input: PurchaseInput = {
  supplierId: 'cm12345678901234567890123',
  warehouseId: 'cm12345678901234567890124',
  purchaseDate: new Date('2026-08-27'),
  discountAmount: '5.00',
  additionalCost: '10.00',
  taxAmount: '2.00',
  paidAmount: '50.00',
  lines: [
    {
      productId: 'cm12345678901234567890125',
      quantity: '2',
      unitCost: '30.00',
      discountAmount: '1.00',
      taxAmount: '3.00',
      serialNumbers: [],
    },
  ],
};
const products = [
  {
    id: input.lines[0]!.productId,
    serialized: false,
    isActive: true,
    unit: { decimalAllowed: false },
  },
];
function purchaseRepo(
  overrides: Partial<PurchaseRepositoryContract> = {},
): PurchaseRepositoryContract {
  return {
    validateMasters: vi.fn().mockResolvedValue({ supplier: true, warehouse: true, products }),
    serialConflicts: vi.fn().mockResolvedValue([]),
    createDraft: vi.fn().mockResolvedValue({ id: 'purchase-a' }),
    updateDraft: vi.fn().mockResolvedValue({ id: 'purchase-a' }),
    find: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    postAtomic: vi.fn().mockResolvedValue({ status: 'POSTED' }),
    deleteDraft: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}
function inventoryRepo(
  overrides: Partial<InventoryRepositoryContract> = {},
): InventoryRepositoryContract {
  return {
    context: vi.fn().mockResolvedValue(null),
    balance: vi.fn().mockResolvedValue(0),
    applyAtomic: vi.fn().mockResolvedValue({ movement: {}, quantity: 0 }),
    applyWithTransaction: vi.fn().mockResolvedValue({ movement: {}, quantity: 1 }),
    createAdjustmentAtomic: vi.fn().mockResolvedValue({}),
    listStock: vi.fn().mockResolvedValue({}),
    listMovements: vi.fn().mockResolvedValue({}),
    listAdjustments: vi.fn().mockResolvedValue({}),
    findAdjustment: vi.fn().mockResolvedValue(null),
    listWarehouses: vi.fn().mockResolvedValue([]),
    listSerials: vi.fn().mockResolvedValue({}),
    findSerial: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}
describe('Purchase validation and arithmetic', () => {
  it('rejects negative quantity and unit cost', () => {
    expect(
      purchaseCreateSchema.safeParse({ ...input, lines: [{ ...input.lines[0]!, quantity: '-1' }] })
        .success,
    ).toBe(false);
    expect(
      purchaseCreateSchema.safeParse({ ...input, lines: [{ ...input.lines[0]!, unitCost: '-1' }] })
        .success,
    ).toBe(false);
  });
  it('rejects duplicate product and request serials', () => {
    const serialized = { ...input.lines[0]!, serialNumbers: ['SN-1'] };
    expect(
      purchaseCreateSchema.safeParse({ ...input, lines: [serialized, serialized] }).success,
    ).toBe(false);
  });
  it('bounds pagination and filters', () =>
    expect(purchaseListQuerySchema.safeParse({ limit: 101 }).success).toBe(false));
  it('recalculates totals using integer minor units', () =>
    expect(calculatePurchase(input)).toMatchObject({
      subtotal: '62.00',
      grandTotal: '69.00',
      paidAmount: '50.00',
      dueAmount: '19.00',
    }));
  it('rejects paid amount above authoritative grand total', () =>
    expect(() => calculatePurchase({ ...input, paidAmount: '70.00' })).toThrow(
      'Paid amount cannot exceed grand total.',
    ));
  it('uses BusinessSequence rather than count plus one', () => {
    const source = readFileSync(
      new URL('../modules/purchase/purchase.repository.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('businessSequence.upsert');
    expect(source).not.toMatch(/purchase\.count\([^)]*\)\s*\+\s*1/);
  });
});
describe('PurchaseService rules', () => {
  it('derives tenant only from service context and draft creation does not affect inventory', async () => {
    const createDraft = vi.fn().mockResolvedValue({ id: 'purchase-a' }),
      applyWithTransaction = vi.fn();
    await new PurchaseService(
      purchaseRepo({ createDraft }),
      new InventoryService(inventoryRepo({ applyWithTransaction })),
    ).create('business-a', 'user-a', input);
    expect(createDraft).toHaveBeenCalledWith(
      'business-a',
      'user-a',
      input,
      expect.objectContaining({ grandTotal: '69.00' }),
    );
    expect(applyWithTransaction).not.toHaveBeenCalled();
  });
  it.each([
    ['supplier', { supplier: false, warehouse: true, products }],
    ['warehouse', { supplier: true, warehouse: false, products }],
    ['product', { supplier: true, warehouse: true, products: [] }],
  ] as const)('rejects cross-tenant or inactive %s', async (_name, masters) => {
    await expect(
      new PurchaseService(
        purchaseRepo({ validateMasters: vi.fn().mockResolvedValue(masters) }),
        new InventoryService(inventoryRepo()),
      ).create('business-a', 'user-a', input),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('requires exact serial count and rejects serials on ordinary products', async () => {
    const serializedProducts = [{ ...products[0]!, serialized: true }];
    await expect(
      new PurchaseService(
        purchaseRepo({
          validateMasters: vi
            .fn()
            .mockResolvedValue({ supplier: true, warehouse: true, products: serializedProducts }),
        }),
        new InventoryService(inventoryRepo()),
      ).create('business-a', 'user-a', {
        ...input,
        lines: [{ ...input.lines[0]!, quantity: '2', serialNumbers: ['ONE'] }],
      }),
    ).rejects.toMatchObject({ code: 'SERIAL_COUNT_MISMATCH' });
    await expect(
      new PurchaseService(purchaseRepo(), new InventoryService(inventoryRepo())).create(
        'business-a',
        'user-a',
        { ...input, lines: [{ ...input.lines[0]!, serialNumbers: ['UNEXPECTED'] }] },
      ),
    ).rejects.toMatchObject({ code: 'UNEXPECTED_SERIALS' });
  });
  it('rejects an existing tenant serial', async () => {
    const serializedProducts = [{ ...products[0]!, serialized: true }];
    await expect(
      new PurchaseService(
        purchaseRepo({
          validateMasters: vi.fn().mockResolvedValue({
            supplier: true,
            warehouse: true,
            products: serializedProducts,
          }),
          serialConflicts: vi.fn().mockResolvedValue(['SN-1']),
        }),
        new InventoryService(inventoryRepo()),
      ).create('business-a', 'user-a', {
        ...input,
        lines: [{ ...input.lines[0]!, quantity: '1', serialNumbers: ['SN-1'] }],
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_SERIAL' });
  });
  it('posts through InventoryService contract and repeated posted requests do not repost', async () => {
    const applyWithTransaction = vi.fn().mockResolvedValue({ movement: {}, quantity: 1 });
    const draft = {
      id: 'purchase-a',
      status: 'DRAFT',
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      purchaseNumber: 'PUR-000001',
      lines: [{ ...input.lines[0]!, lineTotal: '60.00', product: products[0]! }],
    } as PostingPurchase;
    const postAtomic = vi.fn<PurchaseRepositoryContract['postAtomic']>(
      async (businessId, _id, userId, poster) => {
        await poster({} as Prisma.TransactionClient, businessId, userId, {
          warehouseId: draft.warehouseId,
          productId: draft.lines[0]!.productId,
          type: 'PURCHASE',
          quantity: draft.lines[0]!.quantity,
          referenceType: 'PURCHASE',
          referenceId: draft.id,
          unitCost: draft.lines[0]!.unitCost,
        });
        return { status: 'POSTED' };
      },
    );
    const service = new PurchaseService(
      purchaseRepo({ find: vi.fn().mockResolvedValue(draft), postAtomic }),
      new InventoryService(inventoryRepo({ applyWithTransaction })),
    );
    await service.post('business-a', 'purchase-a', 'user-a');
    expect(postAtomic).toHaveBeenCalledTimes(1);
    expect(applyWithTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'business-a',
      'user-a',
      expect.objectContaining({ type: 'PURCHASE', referenceId: 'purchase-a' }),
      2,
    );
    applyWithTransaction.mockClear();
    const postedService = new PurchaseService(
      purchaseRepo({ find: vi.fn().mockResolvedValue({ ...draft, status: 'POSTED' }) }),
      new InventoryService(inventoryRepo({ applyWithTransaction })),
    );
    await postedService.post('business-a', 'purchase-a', 'user-a');
    expect(applyWithTransaction).not.toHaveBeenCalled();
  });
  it('rejects updates to posted or cross-tenant purchases', async () => {
    await expect(
      new PurchaseService(
        purchaseRepo({ updateDraft: vi.fn().mockResolvedValue(null) }),
        new InventoryService(inventoryRepo()),
      ).update('business-a', 'other', input),
    ).rejects.toMatchObject({ code: 'PURCHASE_NOT_EDITABLE' });
  });
});
