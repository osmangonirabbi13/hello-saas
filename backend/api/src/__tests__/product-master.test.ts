import { describe, expect, it, vi } from 'vitest';
import { productCreateSchema, productListQuerySchema } from '@hello-shop/validation';
import { ProductService } from '../modules/product/product.service.js';
import type { ProductInput, ProductRepositoryContract } from '../modules/product/product.types.js';

const valid: ProductInput = {
  name: 'ThinkPad',
  slug: 'thinkpad',
  sku: 'TP-1',
  categoryId: 'cm12345678901234567890123',
  unitId: 'cm12345678901234567890124',
  purchasePrice: '10.00',
  salePrice: '12.00',
  trackStock: true,
  serialized: false,
  reorderLevel: '0',
  allowNegativeStock: false,
  warrantyEnabled: false,
  isActive: true,
};
function repository(overrides: Partial<ProductRepositoryContract> = {}): ProductRepositoryContract {
  return {
    masters: vi.fn().mockResolvedValue({ valid: true }),
    duplicate: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue({ id: 'product-1' }),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    find: vi.fn().mockResolvedValue(null),
    findByBarcode: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    deactivate: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('Product Master validation', () => {
  it('rejects negative prices and invalid pagination', () => {
    expect(productCreateSchema.safeParse({ ...valid, salePrice: '-1' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
  it('requires stock tracking for serialized products', () => {
    expect(
      productCreateSchema.safeParse({ ...valid, serialized: true, trackStock: false }).success,
    ).toBe(false);
  });
  it('rejects a minimum sale price above sale price', () => {
    expect(productCreateSchema.safeParse({ ...valid, minimumSalePrice: '13.00' }).success).toBe(
      false,
    );
  });
});

describe('ProductService tenant boundaries', () => {
  it('passes only the server-derived tenant to every repository operation', async () => {
    const masters = vi.fn().mockResolvedValue({ valid: true });
    const create = vi.fn().mockResolvedValue({ id: 'product-1' });
    const repo = repository({ masters, create });
    await new ProductService(repo).create('business-a', 'user-a', valid);
    expect(masters).toHaveBeenCalledWith('business-a', valid);
    expect(create).toHaveBeenCalledWith('business-a', 'user-a', valid);
  });
  it('rejects a relation outside the active tenant', async () => {
    const service = new ProductService(
      repository({
        masters: vi.fn().mockResolvedValue({ valid: false, reason: 'Category is invalid.' }),
      }),
    );
    await expect(service.create('business-a', 'user-a', valid)).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_MASTER_RELATION',
    });
  });
  it('rejects duplicate SKU or barcode within the tenant', async () => {
    const service = new ProductService(repository({ duplicate: vi.fn().mockResolvedValue(true) }));
    await expect(service.create('business-a', 'user-a', valid)).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_PRODUCT_IDENTIFIER',
    });
  });
  it('uses the server tenant for exact barcode lookup and rejects inactive products', async () => {
    const findByBarcode = vi.fn().mockResolvedValue({ id: 'product-a', isActive: true });
    await expect(
      new ProductService(repository({ findByBarcode })).lookupBarcode('business-a', ' 89411001 '),
    ).resolves.toMatchObject({ id: 'product-a' });
    expect(findByBarcode).toHaveBeenCalledWith('business-a', '89411001');
    await expect(
      new ProductService(
        repository({
          findByBarcode: vi.fn().mockResolvedValue({ id: 'product-a', isActive: false }),
        }),
      ).lookupBarcode('business-a', '89411001'),
    ).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE' });
  });
  it('returns not-found semantics for an unknown or cross-tenant barcode', async () => {
    await expect(
      new ProductService(repository()).lookupBarcode('business-a', 'tenant-b-code'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'BARCODE_NOT_FOUND' });
  });
});
