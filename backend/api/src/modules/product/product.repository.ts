import { prisma, type Prisma } from '@hello-shop/database';
import { AppError } from '../../common/errors/app-error.js';
import type { ProductInput, ProductRepositoryContract } from './product.types.js';
import { executeIdempotent, type MutationIdentity } from '../sync/mutation-idempotency.js';

export class ProductRepository implements ProductRepositoryContract {
  async masters(businessId: string, input: ProductInput) {
    const [category, subCategory, brand, unit] = await Promise.all([
      prisma.category.findFirst({ where: { id: input.categoryId, businessId, isActive: true } }),
      input.subCategoryId
        ? prisma.subCategory.findFirst({
            where: {
              id: input.subCategoryId,
              businessId,
              categoryId: input.categoryId,
              isActive: true,
            },
          })
        : Promise.resolve(true),
      input.brandId
        ? prisma.brand.findFirst({ where: { id: input.brandId, businessId, isActive: true } })
        : Promise.resolve(true),
      prisma.unit.findFirst({ where: { id: input.unitId, businessId, isActive: true } }),
    ]);
    if (!category) return { valid: false, reason: 'Category is invalid or inactive.' };
    if (!subCategory)
      return { valid: false, reason: 'Sub category does not belong to the selected category.' };
    if (!brand) return { valid: false, reason: 'Brand is invalid or inactive.' };
    if (!unit) return { valid: false, reason: 'Unit is invalid or inactive.' };
    return { valid: true };
  }

  async duplicate(businessId: string, sku: string, barcode?: string | null, excludeId?: string) {
    return Boolean(
      await prisma.product.findFirst({
        where: {
          businessId,
          ...(excludeId ? { id: { not: excludeId } } : {}),
          OR: [{ sku }, ...(barcode ? [{ barcode }] : [])],
        },
        select: { id: true },
      }),
    );
  }

  create(businessId: string, userId: string, input: ProductInput, identity?: MutationIdentity) {
    const data = Object.fromEntries(
      Object.entries({ ...input, businessId, createdById: userId }).filter(
        ([, value]) => value !== undefined,
      ),
    ) as unknown as Prisma.ProductUncheckedCreateInput;
    return executeIdempotent({
      businessId, userId, identity, payload: input,
      execute: async (tx) => {
        const duplicate = await tx.product.findFirst({
          where: {
            businessId,
            OR: [{ sku: input.sku }, ...(input.barcode ? [{ barcode: input.barcode }] : [])],
          },
          select: { id: true },
        });
        if (duplicate)
          throw new AppError(
            409,
            'DUPLICATE_PRODUCT_IDENTIFIER',
            'SKU or barcode already exists.',
          );
        return tx.product.create({ data });
      },
    });
  }

  async list(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const search = typeof query.search === 'string' ? query.search : undefined;
    const where = {
      businessId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
              { barcode: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true, subCategory: true, brand: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);
    return { rows, total, page, limit };
  }

  find(businessId: string, id: string) {
    return prisma.product.findFirst({
      where: { id, businessId },
      include: { category: true, subCategory: true, brand: true, unit: true },
    });
  }

  findByBarcode(businessId: string, barcode: string) {
    return prisma.product.findFirst({
      where: { businessId, barcode },
      include: { category: true, subCategory: true, brand: true, unit: true },
    });
  }

  async update(businessId: string, id: string, input: Partial<ProductInput>, expectedVersion?: number) {
    const data = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Prisma.ProductUncheckedUpdateManyInput;
    const result = await prisma.product.updateMany({
      where: { id, businessId, ...(expectedVersion ? { version: expectedVersion } : {}) },
      data: { ...data, version: { increment: 1 } },
    });
    if (!result.count && expectedVersion && (await this.find(businessId, id)))
      throw new AppError(409, 'RECORD_CHANGED', 'This product was changed on another device.');
    return result.count ? this.find(businessId, id) : null;
  }

  async deactivate(businessId: string, id: string) {
    return (
      (
        await prisma.product.updateMany({
          where: { id, businessId },
          data: { isActive: false },
        })
      ).count === 1
    );
  }
}
