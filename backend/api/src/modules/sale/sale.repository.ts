import { prisma } from '@hello-shop/database';
import type { Prisma, SaleStatus, SaleType } from '@hello-shop/database';
import { AppError } from '../../common/errors/app-error.js';
import type {
  PostingSale,
  SaleInput,
  SaleInventoryPoster,
  SaleRepositoryContract,
  SaleTotals,
} from './sale.types.js';

const include = {
  customer: true,
  warehouse: true,
  createdBy: { select: { id: true, displayName: true } },
  postedBy: { select: { id: true, displayName: true } },
  lines: { include: { product: { include: { unit: true } } } },
  invoice: true,
} satisfies Prisma.SaleInclude;

function serialize<T extends Record<string, unknown>>(value: T) {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error('Sale serialization did not produce an object.');
  return parsed as T;
}

async function allocate(tx: Prisma.TransactionClient, businessId: string, key: string) {
  const sequence = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  return sequence.nextValue - 1;
}
const displayNumber = (prefix: string, value: number) =>
  `${prefix}-${String(value).padStart(6, '0')}`;

function lineData(businessId: string, totals: SaleTotals) {
  return totals.lines.map((line) => ({
    businessId,
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
    warrantyDuration: line.warrantyDuration ?? null,
    warrantyUnit: line.warrantyUnit ?? null,
    serialNumbers: line.serialNumbers,
  }));
}

function saleData(input: SaleInput, totals: SaleTotals) {
  return {
    customerId: input.customerId ?? null,
    warehouseId: input.warehouseId,
    type: input.type,
    saleDate: input.saleDate,
    dueDate: input.dueDate ?? null,
    reference: input.reference ?? null,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    additionalCost: totals.additionalCost,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    paidAmount: totals.paidAmount,
    dueAmount: totals.dueAmount,
    note: input.note ?? null,
  };
}

function warrantyEnd(start: Date, duration: number | null, unit: string | null) {
  if (!duration || !unit) return null;
  const end = new Date(start);
  if (unit === 'DAYS') end.setUTCDate(end.getUTCDate() + duration);
  if (unit === 'MONTHS') end.setUTCMonth(end.getUTCMonth() + duration);
  if (unit === 'YEARS') end.setUTCFullYear(end.getUTCFullYear() + duration);
  return end;
}

export class SaleRepository implements SaleRepositoryContract {
  async validateMasters(
    businessId: string,
    customerId: string | null,
    warehouseId: string,
    productIds: string[],
  ) {
    const [customer, warehouse, products] = await Promise.all([
      customerId
        ? prisma.customer.findFirst({
            where: { id: customerId, businessId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve({ id: 'walk-in' }),
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
          trackStock: true,
          allowNegativeStock: true,
          warrantyEnabled: true,
          warrantyDuration: true,
          warrantyUnit: true,
          unit: { select: { decimalAllowed: true } },
        },
      }),
    ]);
    return { customer: Boolean(customer), warehouse: Boolean(warehouse), products };
  }

  findSerials(businessId: string, warehouseId: string, serials: string[]) {
    return prisma.serialItem.findMany({
      where: { businessId, warehouseId, serialNumber: { in: serials, mode: 'insensitive' } },
      select: { id: true, serialNumber: true, productId: true, status: true },
    });
  }

  createDraft(businessId: string, userId: string, input: SaleInput, totals: SaleTotals) {
    return prisma.$transaction(
      async (tx) => {
        const [saleValue, invoiceValue] = await Promise.all([
          allocate(tx, businessId, 'SALE'),
          allocate(tx, businessId, 'INVOICE'),
        ]);
        const saleNumber = displayNumber('SAL', saleValue);
        const invoiceNumber = displayNumber('INV', invoiceValue);
        const sale = await tx.sale.create({
          data: {
            businessId,
            saleNumber,
            invoiceNumber,
            createdById: userId,
            ...saleData(input, totals),
            lines: { create: lineData(businessId, totals) },
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'sale.create',
            entityType: 'Sale',
            entityId: sale.id,
            metadata: { saleNumber, invoiceNumber },
          },
        });
        return serialize(sale);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  updateDraft(businessId: string, id: string, input: SaleInput, totals: SaleTotals) {
    return prisma.$transaction(
      async (tx) => {
        const changed = await tx.sale.updateMany({
          where: { id, businessId, status: 'DRAFT' },
          data: saleData(input, totals),
        });
        if (!changed.count) return null;
        await tx.saleLine.deleteMany({ where: { saleId: id, businessId } });
        await tx.saleLine.createMany({
          data: lineData(businessId, totals).map((line) => ({ ...line, saleId: id })),
        });
        return serialize(await tx.sale.findFirstOrThrow({ where: { id, businessId }, include }));
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async find(businessId: string, id: string) {
    const sale = await prisma.sale.findFirst({ where: { id, businessId }, include });
    return sale ? (serialize(sale) as unknown as PostingSale) : null;
  }

  async list(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const search = typeof query.search === 'string' ? query.search : undefined;
    const paymentState = typeof query.paymentState === 'string' ? query.paymentState : undefined;
    const where: Prisma.SaleWhereInput = {
      businessId,
      ...(typeof query.customer === 'string' ? { customerId: query.customer } : {}),
      ...(typeof query.warehouse === 'string' ? { warehouseId: query.warehouse } : {}),
      ...(typeof query.type === 'string' ? { type: query.type as SaleType } : {}),
      ...(typeof query.status === 'string' ? { status: query.status as SaleStatus } : {}),
      ...(query.dateFrom instanceof Date || query.dateTo instanceof Date
        ? {
            saleDate: {
              ...(query.dateFrom instanceof Date ? { gte: query.dateFrom } : {}),
              ...(query.dateTo instanceof Date ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(paymentState === 'UNPAID' ? { paidAmount: 0 } : {}),
      ...(paymentState === 'PAID' ? { dueAmount: 0 } : {}),
      ...(paymentState === 'PARTIALLY_PAID' ? { paidAmount: { gt: 0 }, dueAmount: { gt: 0 } } : {}),
      ...(search
        ? {
            OR: [
              { saleNumber: { contains: search, mode: 'insensitive' } },
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { customer: { phone: { contains: search } } },
            ],
          }
        : {}),
    };
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'saleDate';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.sale.count({ where }),
    ]);
    return {
      rows: rows.map((row) => serialize(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  postAtomic(
    businessId: string,
    id: string,
    userId: string,
    calculate: (input: SaleInput) => SaleTotals,
    poster: SaleInventoryPoster,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findFirst({ where: { id, businessId }, include });
        if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale was not found.');
        if (sale.status === 'POSTED') return serialize(sale);
        if (sale.status !== 'DRAFT')
          throw new AppError(409, 'SALE_NOT_POSTABLE', 'Only a draft sale can be posted.');
        if (sale.customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: sale.customerId, businessId, isActive: true },
            select: { id: true },
          });
          if (!customer)
            throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Active customer was not found.');
        }
        const warehouse = await tx.warehouse.findFirst({
          where: { id: sale.warehouseId, businessId, isActive: true },
          select: { id: true },
        });
        if (!warehouse)
          throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Active warehouse was not found.');
        if (sale.lines.some((line) => !line.product.isActive))
          throw new AppError(404, 'PRODUCT_NOT_FOUND', 'An active product was not found.');
        const input: SaleInput = {
          customerId: sale.customerId,
          warehouseId: sale.warehouseId,
          type: sale.type,
          saleDate: sale.saleDate,
          dueDate: sale.dueDate,
          reference: sale.reference,
          discountAmount: String(sale.discountAmount),
          additionalCost: String(sale.additionalCost),
          taxAmount: String(sale.taxAmount),
          paidAmount: String(sale.paidAmount),
          note: sale.note,
          lines: sale.lines.map((line) => ({
            productId: line.productId,
            quantity: String(line.quantity),
            unitPrice: String(line.unitPrice),
            discountAmount: String(line.discountAmount),
            taxAmount: String(line.taxAmount),
            warrantyDuration: line.warrantyDuration,
            warrantyUnit: line.warrantyUnit,
            serialNumbers: line.serialNumbers,
          })),
        };
        const totals = calculate(input);
        const claimed = await tx.sale.updateMany({
          where: { id, businessId, status: 'DRAFT' },
          data: {
            ...saleData(input, totals),
            status: 'POSTED',
            postedById: userId,
            postedAt: new Date(),
          },
        });
        if (!claimed.count)
          throw new AppError(
            409,
            'SALE_POST_CONFLICT',
            'Sale posting conflicted with another request.',
          );
        for (const line of sale.lines) {
          await poster(tx, businessId, userId, {
            warehouseId: sale.warehouseId,
            productId: line.productId,
            type: 'SALE',
            quantity: String(line.quantity),
            referenceType: 'SALE',
            referenceId: sale.id,
          });
          if (line.product.serialized) {
            const duration =
              line.warrantyDuration ??
              (line.product.warrantyEnabled ? line.product.warrantyDuration : null);
            const unit =
              line.warrantyUnit ??
              (line.product.warrantyEnabled ? line.product.warrantyUnit : null);
            const changed = await tx.serialItem.updateMany({
              where: {
                businessId,
                warehouseId: sale.warehouseId,
                productId: line.productId,
                serialNumber: { in: line.serialNumbers },
                status: 'IN_STOCK',
                saleId: null,
              },
              data: {
                status: 'SOLD',
                saleId: sale.id,
                customerId: sale.customerId,
                warrantyStart: duration && unit ? sale.saleDate : null,
                warrantyEnd: warrantyEnd(sale.saleDate, duration, unit),
              },
            });
            if (changed.count !== line.serialNumbers.length)
              throw new AppError(
                409,
                'SERIAL_NOT_SELLABLE',
                'A selected serial is no longer sellable.',
              );
          }
        }
        await tx.invoice.create({
          data: {
            businessId,
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
            issuedAt: sale.saleDate,
            total: totals.grandTotal,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'sale.post',
            entityType: 'Sale',
            entityId: sale.id,
            metadata: { saleNumber: sale.saleNumber, invoiceNumber: sale.invoiceNumber },
          },
        });
        return serialize(await tx.sale.findFirstOrThrow({ where: { id, businessId }, include }));
      },
      { isolationLevel: 'Serializable' },
    );
  }

  deleteDraft(businessId: string, id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, businessId, status: 'DRAFT' },
        select: { saleNumber: true, invoiceNumber: true },
      });
      if (!sale) return false;
      await tx.sale.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId: userId,
          action: 'sale.draft.delete',
          entityType: 'Sale',
          entityId: id,
          metadata: { saleNumber: sale.saleNumber, invoiceNumber: sale.invoiceNumber },
        },
      });
      return true;
    });
  }
}
