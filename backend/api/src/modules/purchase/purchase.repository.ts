import { prisma } from '@hello-shop/database';
import type { Prisma, PurchaseStatus } from '@hello-shop/database';
import { AppError } from '../../common/errors/app-error.js';
import { executeIdempotent, type MutationIdentity } from '../sync/mutation-idempotency.js';
import type {
  InventoryPoster,
  PurchaseInput,
  PurchaseRepositoryContract,
  PurchaseTotals,
  PostingPurchase,
} from './purchase.types.js';
const include = {
  supplier: true,
  warehouse: true,
  createdBy: { select: { id: true, displayName: true } },
  lines: { include: { product: { include: { unit: true } } } },
} as const;
const lineData = (businessId: string, lines: PurchaseTotals['lines']) =>
  lines.map((line) => ({
    businessId,
    productId: line.productId,
    quantity: line.quantity,
    unitCost: line.unitCost,
    discountAmount: line.discountAmount,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
    warrantyDuration: line.warrantyDuration ?? null,
    warrantyUnit: line.warrantyUnit ?? null,
    serialNumbers: line.serialNumbers,
  }));
function mapPosting(
  value: Awaited<ReturnType<typeof prisma.purchase.findFirst>> & Record<string, unknown>,
): PostingPurchase {
  return value as unknown as PostingPurchase;
}
export class PurchaseRepository implements PurchaseRepositoryContract {
  async validateMasters(
    businessId: string,
    supplierId: string,
    warehouseId: string,
    productIds: string[],
  ) {
    const [supplier, warehouse, products] = await Promise.all([
      prisma.supplier.findFirst({
        where: { id: supplierId, businessId, isActive: true },
        select: { id: true },
      }),
      prisma.warehouse.findFirst({
        where: { id: warehouseId, businessId, isActive: true },
        select: { id: true },
      }),
      prisma.product.findMany({
        where: { id: { in: productIds }, businessId, isActive: true },
        select: {
          id: true,
          serialized: true,
          isActive: true,
          unit: { select: { decimalAllowed: true } },
        },
      }),
    ]);
    return { supplier: Boolean(supplier), warehouse: Boolean(warehouse), products };
  }
  async serialConflicts(businessId: string, serials: string[]) {
    if (!serials.length) return [];
    const rows = await prisma.serialItem.findMany({
      where: { businessId, serialNumber: { in: serials } },
      select: { serialNumber: true },
    });
    return rows.map((row) => row.serialNumber);
  }
  createDraft(businessId: string, userId: string, input: PurchaseInput, totals: PurchaseTotals, identity?: MutationIdentity) {
    return executeIdempotent({
      businessId, userId, identity, payload: input,
      execute: async (tx) => {
        const sequence = await tx.businessSequence.upsert({
          where: { businessId_key: { businessId, key: 'PURCHASE' } },
          create: { businessId, key: 'PURCHASE', nextValue: 2 },
          update: { nextValue: { increment: 1 } },
        });
        const purchaseNumber = 'PUR-' + String(sequence.nextValue - 1).padStart(6, '0');
        const purchase = await tx.purchase.create({
          data: {
            businessId,
            purchaseNumber,
            supplierId: input.supplierId,
            warehouseId: input.warehouseId,
            supplierInvoiceNumber: input.supplierInvoiceNumber ?? null,
            reference: input.reference ?? null,
            purchaseDate: input.purchaseDate,
            dueDate: input.dueDate ?? null,
            subtotal: totals.subtotal,
            discountAmount: totals.discountAmount,
            additionalCost: totals.additionalCost,
            taxAmount: totals.taxAmount,
            grandTotal: totals.grandTotal,
            paidAmount: totals.paidAmount,
            dueAmount: totals.dueAmount,
            note: input.note ?? null,
            createdById: userId,
            lines: { create: lineData(businessId, totals.lines) },
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'purchase.create',
            entityType: 'Purchase',
            entityId: purchase.id,
            metadata: { purchaseNumber },
          },
        });
        return purchase;
      },
    });
  }
  updateDraft(businessId: string, id: string, input: PurchaseInput, totals: PurchaseTotals, expectedVersion?: number) {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.purchase.updateMany({
        where: { id, businessId, status: 'DRAFT', ...(expectedVersion ? { version: expectedVersion } : {}) },
        data: {
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          supplierInvoiceNumber: input.supplierInvoiceNumber ?? null,
          reference: input.reference ?? null,
          purchaseDate: input.purchaseDate,
          dueDate: input.dueDate ?? null,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          additionalCost: totals.additionalCost,
          taxAmount: totals.taxAmount,
          grandTotal: totals.grandTotal,
          paidAmount: totals.paidAmount,
          dueAmount: totals.dueAmount,
          note: input.note ?? null,
          version: { increment: 1 },
        },
      });
      if (!changed.count) {
        const existing = await tx.purchase.findFirst({ where: { id, businessId }, select: { status: true } });
        if (existing && expectedVersion)
          throw new AppError(409, 'RECORD_CHANGED', existing.status === 'DRAFT' ? 'This purchase draft was changed on another device.' : 'This purchase can no longer be edited because it has already been posted.');
        return null;
      }
      await tx.purchaseLine.deleteMany({ where: { purchaseId: id } });
      await tx.purchaseLine.createMany({
        data: lineData(businessId, totals.lines).map((line) => ({ ...line, purchaseId: id })),
      });
      return tx.purchase.findFirst({ where: { id, businessId }, include });
    });
  }
  async find(businessId: string, id: string) {
    const value = await prisma.purchase.findFirst({ where: { id, businessId }, include });
    if (!value) return null;
    return mapPosting({
      ...value,
      lines: value.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        unitCost: line.unitCost.toString(),
        discountAmount: line.discountAmount.toString(),
        taxAmount: line.taxAmount.toString(),
        lineTotal: line.lineTotal.toString(),
      })),
    });
  }
  async list(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20),
      search = typeof query.search === 'string' ? query.search : undefined;
    const where: Prisma.PurchaseWhereInput = {
      businessId,
      ...(typeof query.supplier === 'string' ? { supplierId: query.supplier } : {}),
      ...(typeof query.warehouse === 'string' ? { warehouseId: query.warehouse } : {}),
      ...(typeof query.status === 'string' ? { status: query.status as PurchaseStatus } : {}),
      ...(query.dateFrom instanceof Date || query.dateTo instanceof Date
        ? {
            purchaseDate: {
              ...(query.dateFrom instanceof Date ? { gte: query.dateFrom } : {}),
              ...(query.dateTo instanceof Date ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { purchaseNumber: { contains: search, mode: 'insensitive' } },
              { supplierInvoiceNumber: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { supplier: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { supplier: true, warehouse: true, createdBy: { select: { displayName: true } } },
        orderBy: { purchaseDate: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      }),
      prisma.purchase.count({ where }),
    ]);
    const mapped = rows
      .map((row) => ({
        ...row,
        paymentState:
          Number(row.paidAmount) === 0
            ? 'UNPAID'
            : Number(row.paidAmount) >= Number(row.grandTotal)
              ? 'PAID'
              : 'PARTIALLY_PAID',
      }))
      .filter(
        (row) => typeof query.paymentState !== 'string' || row.paymentState === query.paymentState,
      );
    return { rows: mapped, total, page, limit };
  }
  postAtomic(businessId: string, id: string, userId: string, poster: InventoryPoster) {
    return prisma
      .$transaction(
        async (tx) => {
          const purchase = await tx.purchase.findFirst({
            where: { id, businessId },
            include: {
              supplier: { select: { isActive: true } },
              warehouse: { select: { isActive: true } },
              lines: { include: { product: { include: { unit: true } } } },
            },
          });
          if (!purchase) throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase was not found.');
          if (purchase.status === 'POSTED') return purchase;
          if (purchase.status !== 'DRAFT')
            throw new AppError(
              409,
              'PURCHASE_NOT_POSTABLE',
              'Only a draft purchase can be posted.',
            );
          if (!purchase.supplier.isActive)
            throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Active supplier was not found.');
          if (!purchase.warehouse.isActive)
            throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Active warehouse was not found.');
          for (const line of purchase.lines)
            if (!line.product.isActive)
              throw new AppError(404, 'PRODUCT_NOT_FOUND', 'An active product was not found.');
          const claimed = await tx.purchase.updateMany({
            where: { id, businessId, status: 'DRAFT' },
            data: { status: 'POSTED', postedById: userId, postedAt: new Date() },
          });
          if (!claimed.count)
            throw new AppError(409, 'PURCHASE_ALREADY_POSTED', 'Purchase has already been posted.');
          for (const line of purchase.lines) {
            await poster(tx, businessId, userId, {
              warehouseId: purchase.warehouseId,
              productId: line.productId,
              type: 'PURCHASE',
              quantity: line.quantity.toString(),
              referenceType: 'PURCHASE',
              referenceId: purchase.id,
              unitCost: line.unitCost.toString(),
            });
            if (line.serialNumbers.length)
              await tx.serialItem.createMany({
                data: line.serialNumbers.map((serialNumber) => ({
                  businessId,
                  warehouseId: purchase.warehouseId,
                  productId: line.productId,
                  serialNumber,
                  status: 'IN_STOCK',
                  purchaseId: purchase.id,
                  supplierId: purchase.supplierId,
                })),
                skipDuplicates: false,
              });
          }
          await tx.auditLog.create({
            data: {
              businessId,
              actorUserId: userId,
              action: 'purchase.post',
              entityType: 'Purchase',
              entityId: purchase.id,
              metadata: { purchaseNumber: purchase.purchaseNumber },
            },
          });
          return tx.purchase.findUniqueOrThrow({ where: { id }, include });
        },
        { isolationLevel: 'Serializable' },
      )
      .catch((error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        )
          throw new AppError(409, 'DUPLICATE_SERIAL', 'A serial already exists for this business.');
        throw error;
      });
  }
  deleteDraft(businessId: string, id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, businessId, status: 'DRAFT' },
        select: { id: true, purchaseNumber: true },
      });
      if (!purchase) return false;
      await tx.purchase.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId: userId,
          action: 'purchase.draft.delete',
          entityType: 'Purchase',
          entityId: id,
          metadata: { purchaseNumber: purchase.purchaseNumber },
        },
      });
      return true;
    });
  }
}
