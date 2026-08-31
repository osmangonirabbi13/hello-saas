import { prisma } from '@hello-shop/database';
import type { DamageReason, DamageStatus } from '@hello-shop/database';
import type { DamageInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { InventoryRepository } from '../inventory/inventory.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
const include = {
  business: { select: { name: true } },
  warehouse: true,
  createdBy: { select: { displayName: true } },
  postedBy: { select: { displayName: true } },
  lines: { include: { product: true, serials: { include: { serialItem: true } } } },
} as const;
async function seq(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], b: string) {
  const x = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId: b, key: 'DAMAGE' } },
    create: { businessId: b, key: 'DAMAGE', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `DMG-${String(x.nextValue - 1).padStart(6, '0')}`;
}
export class DamageRepository {
  list(b: string, q: Record<string, unknown>) {
    const page = Number(q.page ?? 1),
      limit = Number(q.limit ?? 20);
    return Promise.all([
      prisma.damage.findMany({
        where: {
          businessId: b,
          ...(typeof q.status === 'string' ? { status: q.status as DamageStatus } : {}),
          ...(typeof q.reason === 'string' ? { reason: q.reason as DamageReason } : {}),
          ...(typeof q.warehouseId === 'string' ? { warehouseId: q.warehouseId } : {}),
          ...(q.dateFrom || q.dateTo
            ? {
                damageDate: {
                  ...(q.dateFrom instanceof Date ? { gte: q.dateFrom } : {}),
                  ...(q.dateTo instanceof Date ? { lte: q.dateTo } : {}),
                },
              }
            : {}),
          ...(typeof q.search === 'string'
            ? {
                OR: [
                  { damageNumber: { contains: q.search, mode: 'insensitive' as const } },
                  {
                    lines: {
                      some: {
                        OR: [
                          {
                            product: { name: { contains: q.search, mode: 'insensitive' as const } },
                          },
                          {
                            serials: {
                              some: {
                                serialItem: {
                                  serialNumber: {
                                    contains: q.search,
                                    mode: 'insensitive' as const,
                                  },
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        include,
        orderBy: { damageDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.damage.count({ where: { businessId: b } }),
    ]).then(([rows, total]) => ({ rows, total, page, limit }));
  }
  find(b: string, id: string) {
    return prisma.damage.findFirst({ where: { id, businessId: b }, include });
  }
  async create(b: string, u: string, i: DamageInput) {
    return prisma.$transaction(
      async (tx) => {
        const [w, products, serials] = await Promise.all([
          tx.warehouse.findFirst({ where: { id: i.warehouseId, businessId: b, isActive: true } }),
          tx.product.findMany({
            where: { businessId: b, id: { in: i.lines.map((x) => x.productId) }, isActive: true },
          }),
          tx.serialItem.findMany({
            where: {
              businessId: b,
              id: { in: i.lines.flatMap((x) => x.serialItemIds) },
              warehouseId: i.warehouseId,
              status: 'IN_STOCK',
            },
          }),
        ]);
        if (!w || products.length !== i.lines.length)
          throw new AppError(
            404,
            'DAMAGE_CONTEXT_NOT_FOUND',
            'Warehouse or product was not found.',
          );
        const ids = i.lines.flatMap((x) => x.serialItemIds);
        if (new Set(ids).size !== ids.length || serials.length !== ids.length)
          throw new AppError(
            409,
            'DAMAGE_SERIAL_INVALID',
            'Every serial must be unique and currently in stock.',
          );
        const map = new Map(products.map((p) => [p.id, p]));
        for (const l of i.lines) {
          const p = map.get(l.productId)!;
          if (
            p.serialized &&
            (l.serialItemIds.length !== Number(l.quantity) || !Number.isInteger(Number(l.quantity)))
          )
            throw new AppError(
              422,
              'DAMAGE_SERIAL_QUANTITY',
              'Serialized quantity must match selected serials.',
            );
          if (serials.some((s) => l.serialItemIds.includes(s.id) && s.productId !== l.productId))
            throw new AppError(
              409,
              'DAMAGE_SERIAL_PRODUCT',
              'Serial does not belong to the selected product.',
            );
        }
        const number = await seq(tx, b);
        const item = await tx.damage.create({
          data: {
            businessId: b,
            damageNumber: number,
            warehouseId: i.warehouseId,
            damageDate: i.damageDate,
            reason: i.reason,
            notes: i.notes ?? null,
            createdById: u,
            totalDamageValue: i.lines.reduce(
              (s, l) => s + Number(map.get(l.productId)!.purchasePrice) * Number(l.quantity),
              0,
            ),
            lines: {
              create: i.lines.map((l) => {
                const cost = map.get(l.productId)!.purchasePrice;
                return {
                  businessId: b,
                  productId: l.productId,
                  quantity: l.quantity,
                  unitCostSnapshot: cost,
                  totalDamageValue: Number(cost) * Number(l.quantity),
                  serials: { create: l.serialItemIds.map((serialItemId) => ({ serialItemId })) },
                };
              }),
            },
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            businessId: b,
            actorUserId: u,
            action: 'damage.create',
            entityType: 'Damage',
            entityId: item.id,
          },
        });
        return item;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async update(b: string, id: string, u: string, i: DamageInput) {
    return prisma.$transaction(
      async (tx) => {
        const current = await tx.damage.findFirst({
          where: { id, businessId: b, status: 'DRAFT' },
        });
        if (!current)
          throw new AppError(409, 'DAMAGE_IMMUTABLE', 'Only a draft damage record can be edited.');
        const [warehouse, products, serials] = await Promise.all([
          tx.warehouse.findFirst({ where: { id: i.warehouseId, businessId: b, isActive: true } }),
          tx.product.findMany({
            where: {
              businessId: b,
              id: { in: i.lines.map((line) => line.productId) },
              isActive: true,
            },
          }),
          tx.serialItem.findMany({
            where: {
              businessId: b,
              id: { in: i.lines.flatMap((line) => line.serialItemIds) },
              warehouseId: i.warehouseId,
              status: 'IN_STOCK',
            },
          }),
        ]);
        const serialIds = i.lines.flatMap((line) => line.serialItemIds);
        if (
          !warehouse ||
          products.length !== i.lines.length ||
          serials.length !== serialIds.length ||
          new Set(serialIds).size !== serialIds.length
        )
          throw new AppError(
            409,
            'DAMAGE_CONTEXT_INVALID',
            'Damage inventory selections are no longer available.',
          );
        const productsById = new Map(products.map((product) => [product.id, product]));
        for (const line of i.lines) {
          const product = productsById.get(line.productId)!;
          if (
            product.serialized &&
            (line.serialItemIds.length !== Number(line.quantity) ||
              !Number.isInteger(Number(line.quantity)))
          )
            throw new AppError(
              422,
              'DAMAGE_SERIAL_QUANTITY',
              'Serialized quantity must match selected serials.',
            );
          if (
            serials.some(
              (serial) =>
                line.serialItemIds.includes(serial.id) && serial.productId !== line.productId,
            )
          )
            throw new AppError(
              409,
              'DAMAGE_SERIAL_PRODUCT',
              'Serial does not belong to the selected product.',
            );
        }
        await tx.damageLine.deleteMany({ where: { damageId: id } });
        const item = await tx.damage.update({
          where: { id },
          data: {
            warehouseId: i.warehouseId,
            damageDate: i.damageDate,
            reason: i.reason,
            notes: i.notes ?? null,
            totalDamageValue: i.lines.reduce(
              (sum, line) =>
                sum +
                Number(productsById.get(line.productId)!.purchasePrice) * Number(line.quantity),
              0,
            ),
            version: { increment: 1 },
            lines: {
              create: i.lines.map((line) => {
                const cost = productsById.get(line.productId)!.purchasePrice;
                return {
                  businessId: b,
                  productId: line.productId,
                  quantity: line.quantity,
                  unitCostSnapshot: cost,
                  totalDamageValue: Number(cost) * Number(line.quantity),
                  serials: { create: line.serialItemIds.map((serialItemId) => ({ serialItemId })) },
                };
              }),
            },
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            businessId: b,
            actorUserId: u,
            action: 'damage.update',
            entityType: 'Damage',
            entityId: id,
          },
        });
        return item;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async remove(b: string, id: string, u: string) {
    await prisma.$transaction(async (tx) => {
      const x = await tx.damage.deleteMany({ where: { id, businessId: b, status: 'DRAFT' } });
      if (!x.count)
        throw new AppError(
          409,
          'DAMAGE_DELETE_DENIED',
          'Only a draft damage record can be deleted.',
        );
      await tx.auditLog.create({
        data: {
          businessId: b,
          actorUserId: u,
          action: 'damage.delete_draft',
          entityType: 'Damage',
          entityId: id,
        },
      });
    });
  }
  async post(b: string, id: string, u: string) {
    return prisma.$transaction(
      async (tx) => {
        const d = await tx.damage.findFirst({ where: { id, businessId: b }, include });
        if (!d) throw new AppError(404, 'DAMAGE_NOT_FOUND', 'Damage was not found.');
        if (d.status === 'POSTED') return d;
        if (d.status !== 'DRAFT')
          throw new AppError(409, 'DAMAGE_NOT_POSTABLE', 'Only a draft can be posted.');
        const inventory = new InventoryService(new InventoryRepository());
        for (const l of d.lines) {
          await inventory.applyMovementInTransaction(tx, b, u, {
            warehouseId: d.warehouseId,
            productId: l.productId,
            type: 'DAMAGE',
            quantity: String(l.quantity),
            referenceType: 'DAMAGE',
            referenceId: id,
            unitCost: String(l.unitCostSnapshot),
          });
          for (const x of l.serials) {
            const claimed = await tx.serialItem.updateMany({
              where: {
                id: x.serialItemId,
                businessId: b,
                productId: l.productId,
                warehouseId: d.warehouseId,
                status: 'IN_STOCK',
              },
              data: { status: 'DAMAGED' },
            });
            if (!claimed.count)
              throw new AppError(
                409,
                'DAMAGE_SERIAL_UNAVAILABLE',
                'A serial is no longer available.',
              );
            await tx.serialHistory.create({
              data: {
                businessId: b,
                serialItemId: x.serialItemId,
                eventType: 'DAMAGE_RECORDED',
                referenceType: 'DAMAGE',
                referenceId: id,
              },
            });
          }
        }
        const claimed = await tx.damage.updateMany({
          where: { id, businessId: b, status: 'DRAFT' },
          data: { status: 'POSTED', postedById: u, postedAt: new Date() },
        });
        if (!claimed.count)
          throw new AppError(409, 'DAMAGE_POST_CONFLICT', 'Damage was posted by another request.');
        await tx.auditLog.create({
          data: {
            businessId: b,
            actorUserId: u,
            action: 'damage.post',
            entityType: 'Damage',
            entityId: id,
          },
        });
        return tx.damage.findUniqueOrThrow({ where: { id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
