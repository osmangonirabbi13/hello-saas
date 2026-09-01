import { prisma } from '@hello-shop/database';
import type { Prisma, SerialStatus, StockMovementType } from '@hello-shop/database';
import { AppError } from '../../common/errors/app-error.js';
import { applyInventoryValuation } from '../accounting/inventory-valuation.service.js';
import {
  OUTBOUND_MOVEMENTS,
  stockStatus,
  type AdjustmentInput,
  type InventoryRepositoryContract,
  type MovementInput,
} from './inventory.types.js';
type Tx = Prisma.TransactionClient;
async function applyInTransaction(
  tx: Tx,
  businessId: string,
  userId: string,
  input: MovementInput,
  signed: number,
) {
  const [product, warehouse, balance] = await Promise.all([
    tx.product.findFirst({
      where: { id: input.productId, businessId, isActive: true },
      select: { id: true, trackStock: true, allowNegativeStock: true },
    }),
    tx.warehouse.findFirst({
      where: { id: input.warehouseId, businessId, isActive: true },
      select: { id: true },
    }),
    tx.stockBalance.findUnique({
      where: {
        businessId_warehouseId_productId: {
          businessId,
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    }),
  ]);
  if (!product || !warehouse)
    throw new AppError(404, 'INVENTORY_CONTEXT_NOT_FOUND', 'Product or warehouse was not found.');
  if (!product.trackStock)
    throw new AppError(422, 'STOCK_TRACKING_DISABLED', 'Product does not track stock.');
  const next = Number(balance?.quantity ?? 0) + signed;
  if (!product.allowNegativeStock && next < 0)
    throw new AppError(409, 'NEGATIVE_STOCK_DENIED', 'Insufficient available stock.');
  const resulting = await tx.stockBalance.upsert({
    where: {
      businessId_warehouseId_productId: {
        businessId,
        warehouseId: input.warehouseId,
        productId: input.productId,
      },
    },
    create: {
      businessId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      quantity: signed,
    },
    update: { quantity: { increment: signed } },
  });
  const movement = await tx.stockMovement.create({
    data: {
      businessId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      unitCost: input.unitCost ?? null,
      note: input.note ?? null,
      createdById: userId,
    },
  });
  const valuation = await applyInventoryValuation(
    tx,
    businessId,
    input,
    movement.id,
    signed,
  );
  return { movement, valuation, quantity: Number(resulting.quantity) };
}
export class InventoryRepository implements InventoryRepositoryContract {
  async context(businessId: string, warehouseId: string, productId: string) {
    const [product, warehouse] = await Promise.all([
      prisma.product.findFirst({
        where: { id: productId, businessId, isActive: true },
        select: { id: true, allowNegativeStock: true, trackStock: true },
      }),
      prisma.warehouse.findFirst({
        where: { id: warehouseId, businessId, isActive: true },
        select: { id: true },
      }),
    ]);
    return product && warehouse ? { product, warehouse } : null;
  }
  async balance(businessId: string, warehouseId: string, productId: string) {
    const row = await prisma.stockBalance.findUnique({
      where: { businessId_warehouseId_productId: { businessId, warehouseId, productId } },
    });
    return Number(row?.quantity ?? 0);
  }
  applyAtomic(businessId: string, userId: string, input: MovementInput, signedQuantity: number) {
    return prisma.$transaction(
      (tx) => applyInTransaction(tx, businessId, userId, input, signedQuantity),
      { isolationLevel: 'Serializable' },
    );
  }
  applyWithTransaction(
    transaction: Prisma.TransactionClient,
    businessId: string,
    userId: string,
    input: MovementInput,
    signedQuantity: number,
  ) {
    return applyInTransaction(transaction, businessId, userId, input, signedQuantity);
  }
  createAdjustmentAtomic(businessId: string, userId: string, input: AdjustmentInput) {
    return prisma.$transaction(
      async (tx) => {
        const warehouse = await tx.warehouse.findFirst({
          where: { id: input.warehouseId, businessId, isActive: true },
        });
        if (!warehouse) throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Warehouse was not found.');
        const adjustment = await tx.stockAdjustment.create({
          data: {
            businessId,
            warehouseId: input.warehouseId,
            reason: input.reason,
            note: input.note ?? null,
            createdById: userId,
          },
        });
        for (const line of input.lines) {
          const movementInput: MovementInput = {
            warehouseId: input.warehouseId,
            productId: line.productId,
            type: line.direction,
            quantity: line.quantity,
            referenceType: 'STOCK_ADJUSTMENT',
            referenceId: adjustment.id,
            unitCost: line.unitCost ?? null,
          };
          const signed = OUTBOUND_MOVEMENTS.has(line.direction)
            ? -Number(line.quantity)
            : Number(line.quantity);
          await tx.stockAdjustmentLine.create({
            data: {
              adjustmentId: adjustment.id,
              productId: line.productId,
              direction: line.direction,
              quantity: line.quantity,
              unitCost: line.unitCost ?? null,
            },
          });
          await applyInTransaction(tx, businessId, userId, movementInput, signed);
        }
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'inventory.adjustment.create',
            entityType: 'StockAdjustment',
            entityId: adjustment.id,
            metadata: { reason: input.reason },
          },
        });
        return tx.stockAdjustment.findUniqueOrThrow({
          where: { id: adjustment.id },
          include: { lines: true, warehouse: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async listStock(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20),
      search = typeof query.search === 'string' ? query.search : undefined,
      warehouseId = typeof query.warehouse === 'string' ? query.warehouse : undefined;
    const where: Prisma.ProductWhereInput = {
      businessId,
      isActive: true,
      trackStock: true,
      ...(typeof query.productId === 'string' ? { id: query.productId } : {}),
      ...(typeof query.category === 'string' ? { categoryId: query.category } : {}),
      ...(typeof query.brand === 'string' ? { brandId: query.brand } : {}),
      ...(typeof query.serialized === 'string' ? { serialized: query.serialized === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [products, total, warehouse] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: true,
          brand: true,
          stockBalances: {
            where: warehouseId ? { warehouseId } : {},
            include: { warehouse: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
      warehouseId
        ? prisma.warehouse.findFirst({ where: { id: warehouseId, businessId } })
        : prisma.warehouse.findFirst({ where: { businessId, isDefault: true, isActive: true } }),
    ]);
    const rows = products
      .map((product) => {
        const selected = warehouseId
          ? product.stockBalances
          : product.stockBalances.filter((item) => item.warehouseId === warehouse?.id);
        const quantity = selected.reduce((sum, item) => sum + Number(item.quantity), 0);
        const status = stockStatus(quantity, Number(product.reorderLevel));
        return {
          productId: product.id,
          product: product.name,
          sku: product.sku,
          category: product.category.name,
          brand: product.brand?.name ?? null,
          warehouse: selected[0]?.warehouse.name ?? warehouse?.name ?? 'Default warehouse',
          quantity,
          reorderLevel: Number(product.reorderLevel),
          status,
          serialized: product.serialized,
        };
      })
      .filter((row) => typeof query.status !== 'string' || row.status === query.status)
      .filter((row) => query.lowStock !== true || row.quantity <= row.reorderLevel)
      .filter((row) => query.alerts !== true || row.status !== 'IN_STOCK');
    return { rows, total, page, limit };
  }
  listMovements(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    const where: Prisma.StockMovementWhereInput = {
      businessId,
      ...(typeof query.productId === 'string' ? { productId: query.productId } : {}),
      ...(typeof query.warehouseId === 'string' ? { warehouseId: query.warehouseId } : {}),
      ...(typeof query.type === 'string' ? { type: query.type as StockMovementType } : {}),
    };
    return Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { product: true, warehouse: true },
        orderBy: { occurredAt: 'desc' },
      }),
      prisma.stockMovement.count({ where }),
    ]).then(([rows, total]) => ({ rows, total, page, limit }));
  }
  listAdjustments(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    const where = {
      businessId,
      ...(typeof query.warehouseId === 'string' ? { warehouseId: query.warehouseId } : {}),
    };
    return Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { warehouse: true, lines: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockAdjustment.count({ where }),
    ]).then(([rows, total]) => ({ rows, total, page, limit }));
  }
  findAdjustment(businessId: string, id: string) {
    return prisma.stockAdjustment.findFirst({
      where: { id, businessId },
      include: { warehouse: true, lines: { include: { product: true } } },
    });
  }
  listWarehouses(businessId: string) {
    return prisma.warehouse.findMany({
      where: { businessId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }
  listSerials(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20),
      search = typeof query.search === 'string' ? query.search : undefined;
    const where: Prisma.SerialItemWhereInput = {
      businessId,
      ...(typeof query.warehouseId === 'string' ? { warehouseId: query.warehouseId } : {}),
      ...(typeof query.productId === 'string' ? { productId: query.productId } : {}),
      ...(typeof query.status === 'string' ? { status: query.status as SerialStatus } : {}),
      ...(search
        ? {
            OR: [
              { serialNumber: { contains: search, mode: 'insensitive' } },
              { product: { name: { contains: search, mode: 'insensitive' } } },
              { product: { sku: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    return Promise.all([
      prisma.serialItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { product: true, warehouse: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.serialItem.count({ where }),
    ]).then(([rows, total]) => ({ rows, total, page, limit }));
  }
  findSerial(businessId: string, id: string) {
    return prisma.serialItem.findFirst({
      where: { id, businessId },
      include: { product: true, warehouse: true },
    });
  }
  findSerialByNumber(businessId: string, serialNumber: string) {
    return prisma.serialItem.findFirst({
      where: { businessId, serialNumber },
      include: { product: true, warehouse: true },
    });
  }
}
