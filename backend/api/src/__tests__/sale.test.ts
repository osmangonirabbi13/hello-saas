import { readFileSync } from 'node:fs';
import type { Prisma } from '@hello-shop/database';
import { describe, expect, it, vi } from 'vitest';
import { saleCreateSchema, saleListQuerySchema } from '@hello-shop/validation';
import { InventoryService } from '../modules/inventory/inventory.service.js';
import type { InventoryRepositoryContract } from '../modules/inventory/inventory.types.js';
import { calculateSale, SaleService } from '../modules/sale/sale.service.js';
import type { PostingSale, SaleInput, SaleRepositoryContract } from '../modules/sale/sale.types.js';

const input: SaleInput = {
  customerId: 'cm12345678901234567890123',
  warehouseId: 'cm12345678901234567890124',
  type: 'REGULAR',
  saleDate: new Date('2026-08-27'),
  discountAmount: '5.00',
  additionalCost: '10.00',
  taxAmount: '2.00',
  paidAmount: '50.00',
  lines: [
    {
      productId: 'cm12345678901234567890125',
      quantity: '2',
      unitPrice: '30.00',
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
    trackStock: true,
    allowNegativeStock: false,
    warrantyEnabled: false,
    warrantyDuration: null,
    warrantyUnit: null,
    unit: { decimalAllowed: false },
  },
];
function saleRepo(overrides: Partial<SaleRepositoryContract> = {}): SaleRepositoryContract {
  return {
    validateMasters: vi.fn().mockResolvedValue({ customer: true, warehouse: true, products }),
    findSerials: vi.fn().mockResolvedValue([]),
    createDraft: vi.fn().mockResolvedValue({ id: 'sale-a' }),
    updateDraft: vi.fn().mockResolvedValue({ id: 'sale-a' }),
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
    context: vi.fn().mockResolvedValue({
      product: { id: 'p', allowNegativeStock: false, trackStock: true },
      warehouse: { id: 'w' },
    }),
    balance: vi.fn().mockResolvedValue(1),
    applyAtomic: vi.fn().mockResolvedValue({ movement: {}, quantity: 0 }),
    applyWithTransaction: vi.fn().mockResolvedValue({ movement: {}, quantity: -1 }),
    createAdjustmentAtomic: vi.fn().mockResolvedValue({}),
    listStock: vi.fn().mockResolvedValue({}),
    listMovements: vi.fn().mockResolvedValue({}),
    listAdjustments: vi.fn().mockResolvedValue({}),
    findAdjustment: vi.fn().mockResolvedValue(null),
    listWarehouses: vi.fn().mockResolvedValue([]),
    listSerials: vi.fn().mockResolvedValue({}),
    findSerial: vi.fn().mockResolvedValue(null),
    findSerialByNumber: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('Sale validation, VAT, and arithmetic', () => {
  it('rejects negative quantity and price', () => {
    expect(
      saleCreateSchema.safeParse({ ...input, lines: [{ ...input.lines[0]!, quantity: '-1' }] })
        .success,
    ).toBe(false);
    expect(
      saleCreateSchema.safeParse({ ...input, lines: [{ ...input.lines[0]!, unitPrice: '-1' }] })
        .success,
    ).toBe(false);
  });
  it('rejects duplicate products and selected serials', () => {
    const line = { ...input.lines[0]!, serialNumbers: ['SN-1'] };
    expect(saleCreateSchema.safeParse({ ...input, lines: [line, line] }).success).toBe(false);
  });
  it('bounds pagination, validates filters, and date order', () => {
    expect(saleListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(
      saleListQuerySchema.safeParse({ dateFrom: '2026-09-01', dateTo: '2026-08-01' }).success,
    ).toBe(false);
  });
  it('recalculates regular and VAT totals using integer minor units', () => {
    expect(calculateSale(input)).toMatchObject({
      subtotal: '62.00',
      grandTotal: '69.00',
      dueAmount: '19.00',
    });
    expect(calculateSale({ ...input, type: 'VAT', taxAmount: '15.00' })).toMatchObject({
      taxAmount: '15.00',
      grandTotal: '82.00',
    });
  });
  it('rejects paid above the authoritative total', () =>
    expect(() => calculateSale({ ...input, paidAmount: '70.00' })).toThrow(
      'Paid amount cannot exceed grand total.',
    ));
  it('uses atomic Sale and Invoice BusinessSequence allocation, never count plus one', () => {
    const source = readFileSync(
      new URL('../modules/sale/sale.repository.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain("allocate(tx, businessId, 'SALE')");
    expect(source).toContain("allocate(tx, businessId, 'INVOICE')");
    expect(source).not.toMatch(/sale\.count\([^)]*\)\s*\+\s*1/);
  });
});

describe('SaleService tenancy, inventory, serial, and lifecycle rules', () => {
  it('derives tenant from service context and draft creation does not affect stock', async () => {
    const createDraft = vi.fn().mockResolvedValue({ id: 'sale-a' });
    const apply = vi.fn();
    await new SaleService(
      saleRepo({ createDraft }),
      new InventoryService(inventoryRepo({ applyWithTransaction: apply })),
    ).create('business-a', 'user-a', input);
    expect(createDraft).toHaveBeenCalledWith(
      'business-a',
      'user-a',
      input,
      expect.objectContaining({ grandTotal: '69.00' }),
    );
    expect(apply).not.toHaveBeenCalled();
  });
  it.each([
    ['customer', { customer: false, warehouse: true, products }],
    ['warehouse', { customer: true, warehouse: false, products }],
    ['product', { customer: true, warehouse: true, products: [] }],
  ] as const)('rejects inactive or cross-tenant %s', async (_name, masters) => {
    await expect(
      new SaleService(
        saleRepo({ validateMasters: vi.fn().mockResolvedValue(masters) }),
        new InventoryService(inventoryRepo()),
      ).create('business-a', 'user-a', input),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('supports a null walk-in customer', async () => {
    const validateMasters = vi
      .fn()
      .mockResolvedValue({ customer: true, warehouse: true, products });
    await new SaleService(
      saleRepo({ validateMasters }),
      new InventoryService(inventoryRepo()),
    ).create('business-a', 'user-a', { ...input, customerId: null });
    expect(validateMasters).toHaveBeenCalledWith('business-a', null, input.warehouseId, [
      input.lines[0]!.productId,
    ]);
  });
  it('requires exact serialized quantity and rejects serials on ordinary products', async () => {
    const serialized = [{ ...products[0]!, serialized: true }];
    await expect(
      new SaleService(
        saleRepo({
          validateMasters: vi
            .fn()
            .mockResolvedValue({ customer: true, warehouse: true, products: serialized }),
        }),
        new InventoryService(inventoryRepo()),
      ).create('business-a', 'user-a', {
        ...input,
        lines: [{ ...input.lines[0]!, serialNumbers: ['ONE'] }],
      }),
    ).rejects.toMatchObject({ code: 'SERIAL_COUNT_MISMATCH' });
    await expect(
      new SaleService(saleRepo(), new InventoryService(inventoryRepo())).create(
        'business-a',
        'user-a',
        { ...input, lines: [{ ...input.lines[0]!, serialNumbers: ['UNEXPECTED'] }] },
      ),
    ).rejects.toMatchObject({ code: 'UNEXPECTED_SERIALS' });
  });
  it.each([
    ['wrong product', { productId: 'other', status: 'IN_STOCK' }, 'SERIAL_PRODUCT_MISMATCH'],
    ['sold', { productId: input.lines[0]!.productId, status: 'SOLD' }, 'SERIAL_NOT_SELLABLE'],
  ] as const)('rejects %s serial', async (_name, serial, code) => {
    const serialized = [{ ...products[0]!, serialized: true }];
    const repository = saleRepo({
      validateMasters: vi
        .fn()
        .mockResolvedValue({ customer: true, warehouse: true, products: serialized }),
      findSerials: vi.fn().mockResolvedValue([{ id: 's', serialNumber: 'SN-1', ...serial }]),
    });
    await expect(
      new SaleService(repository, new InventoryService(inventoryRepo())).create(
        'business-a',
        'user-a',
        { ...input, lines: [{ ...input.lines[0]!, quantity: '1', serialNumbers: ['SN-1'] }] },
      ),
    ).rejects.toMatchObject({ code });
  });
  it('rejects missing and therefore cross-tenant serials with not-found semantics', async () => {
    const serialized = [{ ...products[0]!, serialized: true }];
    await expect(
      new SaleService(
        saleRepo({
          validateMasters: vi
            .fn()
            .mockResolvedValue({ customer: true, warehouse: true, products: serialized }),
        }),
        new InventoryService(inventoryRepo()),
      ).create('business-a', 'user-a', {
        ...input,
        lines: [{ ...input.lines[0]!, quantity: '1', serialNumbers: ['FOREIGN'] }],
      }),
    ).rejects.toMatchObject({ code: 'SERIAL_NOT_FOUND' });
  });
  it('posts SALE through InventoryService and repeated posting cannot double deduct', async () => {
    const apply = vi.fn().mockResolvedValue({ movement: {}, quantity: -1 });
    const draft = {
      id: 'sale-a',
      status: 'DRAFT',
      customerId: input.customerId!,
      warehouseId: input.warehouseId,
      saleNumber: 'SAL-000001',
      invoiceNumber: 'INV-000001',
      saleDate: input.saleDate,
      lines: [{ ...input.lines[0]!, lineTotal: '62.00', product: products[0]! }],
    } as PostingSale;
    const postAtomic = vi.fn<SaleRepositoryContract['postAtomic']>(
      async (businessId, _id, userId, _calculate, poster) => {
        await poster({} as Prisma.TransactionClient, businessId, userId, {
          warehouseId: draft.warehouseId,
          productId: draft.lines[0]!.productId,
          type: 'SALE',
          quantity: '2',
          referenceType: 'SALE',
          referenceId: draft.id,
        });
        return { status: 'POSTED' };
      },
    );
    await new SaleService(
      saleRepo({ find: vi.fn().mockResolvedValue(draft), postAtomic }),
      new InventoryService(inventoryRepo({ applyWithTransaction: apply })),
    ).post('business-a', 'sale-a', 'user-a');
    expect(apply).toHaveBeenCalledWith(
      expect.anything(),
      'business-a',
      'user-a',
      expect.objectContaining({ type: 'SALE' }),
      -2,
    );
    apply.mockClear();
    await new SaleService(
      saleRepo({ find: vi.fn().mockResolvedValue({ ...draft, status: 'POSTED' }) }),
      new InventoryService(inventoryRepo({ applyWithTransaction: apply })),
    ).post('business-a', 'sale-a', 'user-a');
    expect(apply).not.toHaveBeenCalled();
  });
  it('enforces negative-stock policy through InventoryService', async () => {
    await expect(
      new InventoryService(inventoryRepo({ balance: vi.fn().mockResolvedValue(1) })).applyMovement(
        'business-a',
        'user-a',
        { warehouseId: 'w', productId: 'p', type: 'SALE', quantity: '2' },
      ),
    ).rejects.toMatchObject({ code: 'NEGATIVE_STOCK_DENIED' });
    const applyAtomic = vi.fn().mockResolvedValue({ movement: {}, quantity: -1 });
    await new InventoryService(
      inventoryRepo({
        context: vi.fn().mockResolvedValue({
          product: { id: 'p', allowNegativeStock: true, trackStock: true },
          warehouse: { id: 'w' },
        }),
        balance: vi.fn().mockResolvedValue(1),
        applyAtomic,
      }),
    ).applyMovement('business-a', 'user-a', {
      warehouseId: 'w',
      productId: 'p',
      type: 'SALE',
      quantity: '2',
    });
    expect(applyAtomic).toHaveBeenCalled();
  });
  it('rejects posted or cross-tenant update and hard delete', async () => {
    const service = new SaleService(
      saleRepo({
        updateDraft: vi.fn().mockResolvedValue(null),
        deleteDraft: vi.fn().mockResolvedValue(false),
      }),
      new InventoryService(inventoryRepo()),
    );
    await expect(service.update('business-a', 'foreign', input)).rejects.toMatchObject({
      code: 'SALE_NOT_EDITABLE',
    });
    await expect(service.deleteDraft('business-a', 'posted', 'user-a')).rejects.toMatchObject({
      code: 'SALE_NOT_DELETABLE',
    });
  });
  it('keeps VAT and POS on the single SaleService and InventoryService path', () => {
    const routes = readFileSync(new URL('../modules/sale/sale.routes.ts', import.meta.url), 'utf8');
    expect(routes.match(/new SaleService/g)).toHaveLength(1);
    expect(routes).toContain('controller.createVat');
    expect(routes).toContain('controller.createPos');
    expect(
      readFileSync(new URL('../modules/sale/sale.repository.ts', import.meta.url), 'utf8'),
    ).not.toMatch(/stockBalance\.(create|update|upsert)|stockMovement\.create/);
  });
});
