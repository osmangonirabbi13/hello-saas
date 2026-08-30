import { prisma } from '@hello-shop/database';
import type { Prisma, QuotationStatus } from '@hello-shop/database';
import type { QuotationInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { calculateSale } from '../sale/sale.service.js';
import { createSaleDraftInTransaction } from '../sale/sale.repository.js';
import type { SaleInput } from '../sale/sale.types.js';
const include = {
  business: { select: { name: true } },
  customer: true,
  createdBy: { select: { displayName: true } },
  convertedSale: { select: { id: true, saleNumber: true, invoiceNumber: true, status: true } },
  lines: { include: { product: true } },
  history: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { displayName: true } } },
  },
} satisfies Prisma.QuotationInclude;
const minor = (v: string) => {
    const [w, f = ''] = v.split('.');
    return Number(w) * 100 + Number(f.padEnd(2, '0'));
  },
  money = (v: number) => (v / 100).toFixed(2),
  qm = (v: string) => {
    const [w, f = ''] = v.split('.');
    return Number(w) * 1000 + Number(f.padEnd(3, '0'));
  };
export function quotationTotals(input: QuotationInput) {
  const lines = input.lines.map((l) => {
    const gross = Math.round((qm(l.quantity) * minor(l.unitPrice)) / 1000),
      total = gross - minor(l.discountAmount) + minor(l.taxAmount);
    if (total < 0)
      throw new AppError(422, 'INVALID_QUOTATION_LINE', 'Line total cannot be negative.');
    return { ...l, lineTotal: money(total) };
  });
  const subtotal = lines.reduce((s, l) => s + minor(l.lineTotal), 0),
    discount = minor(input.discountAmount),
    tax = minor(input.taxAmount),
    grand = subtotal - discount + tax;
  if (grand < 0)
    throw new AppError(422, 'INVALID_QUOTATION_TOTAL', 'Quotation total cannot be negative.');
  return {
    lines,
    subtotal: money(subtotal),
    discountAmount: money(discount),
    taxAmount: money(tax),
    grandTotal: money(grand),
  };
}
async function seq(tx: Prisma.TransactionClient, b: string) {
  const r = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId: b, key: 'QUOTATION' } },
    create: { businessId: b, key: 'QUOTATION', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `QUO-${String(r.nextValue - 1).padStart(6, '0')}`;
}
async function expire(b: string) {
  await prisma.quotation.updateMany({
    where: { businessId: b, status: { in: ['DRAFT', 'SENT'] }, validUntil: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
}
export class QuotationRepository {
  async validate(b: string, input: QuotationInput) {
    const [p, c] = await Promise.all([
      prisma.product.findMany({
        where: { businessId: b, id: { in: input.lines.map((l) => l.productId) }, isActive: true },
        select: { id: true },
      }),
      input.customerId
        ? prisma.customer.findFirst({
            where: { id: input.customerId, businessId: b, isActive: true },
          })
        : null,
    ]);
    if (p.length !== new Set(input.lines.map((l) => l.productId)).size)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'An active quotation product was not found.');
    if (input.customerId && !c)
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  }
  async create(b: string, u: string, input: QuotationInput) {
    await this.validate(b, input);
    const t = quotationTotals(input);
    return prisma.$transaction(
      async (tx) => {
        const quotationNumber = await seq(tx, b);
        const q = await tx.quotation.create({
          data: {
            businessId: b,
            quotationNumber,
            customerId: input.customerId ?? null,
            prospectName: input.prospectName ?? null,
            prospectPhone: input.prospectPhone ?? null,
            quotationDate: input.quotationDate,
            validUntil: input.validUntil,
            reference: input.reference ?? null,
            subtotal: t.subtotal,
            discountAmount: t.discountAmount,
            taxAmount: t.taxAmount,
            grandTotal: t.grandTotal,
            customerNote: input.customerNote ?? null,
            internalNote: input.internalNote ?? null,
            terms: input.terms ?? null,
            createdById: u,
            lines: {
              create: t.lines.map((l) => ({
                businessId: b,
                productId: l.productId,
                description: l.description ?? null,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountAmount: l.discountAmount,
                taxAmount: l.taxAmount,
                lineTotal: l.lineTotal,
              })),
            },
          },
          include,
        });
        await tx.quotationHistory.create({
          data: {
            businessId: b,
            quotationId: q.id,
            toStatus: 'DRAFT',
            action: 'quotation.created',
            actorUserId: u,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId: b,
            actorUserId: u,
            action: 'quotation.create',
            entityType: 'Quotation',
            entityId: q.id,
            metadata: { quotationNumber },
          },
        });
        return tx.quotation.findUniqueOrThrow({ where: { id: q.id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async list(b: string, q: Record<string, unknown>) {
    await expire(b);
    const page = Number(q.page ?? 1),
      limit = Number(q.limit ?? 20),
      search = typeof q.search === 'string' ? q.search : undefined;
    const where: Prisma.QuotationWhereInput = {
      businessId: b,
      ...(typeof q.status === 'string' ? { status: q.status as QuotationStatus } : {}),
      ...(search
        ? {
            OR: [
              { quotationNumber: { contains: search, mode: 'insensitive' } },
              { prospectName: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { quotationDate: 'desc' },
      }),
      prisma.quotation.count({ where }),
    ]);
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async find(b: string, id: string) {
    await expire(b);
    return prisma.quotation.findFirst({ where: { id, businessId: b }, include });
  }
  async update(b: string, id: string, u: string, input: QuotationInput) {
    await this.validate(b, input);
    const t = quotationTotals(input);
    return prisma.$transaction(
      async (tx) => {
        const changed = await tx.quotation.updateMany({
          where: { id, businessId: b, status: 'DRAFT' },
          data: {
            customerId: input.customerId ?? null,
            prospectName: input.prospectName ?? null,
            prospectPhone: input.prospectPhone ?? null,
            quotationDate: input.quotationDate,
            validUntil: input.validUntil,
            reference: input.reference ?? null,
            subtotal: t.subtotal,
            discountAmount: t.discountAmount,
            taxAmount: t.taxAmount,
            grandTotal: t.grandTotal,
            customerNote: input.customerNote ?? null,
            internalNote: input.internalNote ?? null,
            terms: input.terms ?? null,
            version: { increment: 1 },
          },
        });
        if (!changed.count)
          throw new AppError(
            409,
            'QUOTATION_NOT_EDITABLE',
            'Only a tenant-owned draft quotation can be edited.',
          );
        await tx.quotationLine.deleteMany({ where: { quotationId: id, businessId: b } });
        await tx.quotationLine.createMany({
          data: t.lines.map((l) => ({
            businessId: b,
            quotationId: id,
            productId: l.productId,
            description: l.description ?? null,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountAmount: l.discountAmount,
            taxAmount: l.taxAmount,
            lineTotal: l.lineTotal,
          })),
        });
        await tx.auditLog.create({
          data: {
            businessId: b,
            actorUserId: u,
            action: 'quotation.update',
            entityType: 'Quotation',
            entityId: id,
          },
        });
        return tx.quotation.findUniqueOrThrow({ where: { id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async transition(b: string, id: string, u: string, to: QuotationStatus, note?: string | null) {
    const allowed: Record<QuotationStatus, QuotationStatus[]> = {
      DRAFT: ['SENT', 'CANCELLED'],
      SENT: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
      ACCEPTED: [],
      REJECTED: [],
      EXPIRED: [],
      CONVERTED: [],
      CANCELLED: [],
    };
    return prisma.$transaction(
      async (tx) => {
        const q = await tx.quotation.findFirst({ where: { id, businessId: b } });
        if (!q) throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation was not found.');
        if (q.validUntil < new Date() && ['DRAFT', 'SENT'].includes(q.status))
          throw new AppError(409, 'QUOTATION_EXPIRED', 'Quotation has expired.');
        if (!allowed[q.status].includes(to))
          throw new AppError(
            409,
            'QUOTATION_TRANSITION_INVALID',
            `Cannot move from ${q.status} to ${to}.`,
          );
        const changed = await tx.quotation.updateMany({
          where: { id, businessId: b, status: q.status },
          data: { status: to },
        });
        if (!changed.count)
          throw new AppError(
            409,
            'QUOTATION_TRANSITION_CONFLICT',
            'Quotation changed in another request.',
          );
        await tx.quotationHistory.create({
          data: {
            businessId: b,
            quotationId: id,
            fromStatus: q.status,
            toStatus: to,
            action: `quotation.${to.toLowerCase()}`,
            note: note ?? null,
            actorUserId: u,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId: b,
            actorUserId: u,
            action: `quotation.transition.${to.toLowerCase()}`,
            entityType: 'Quotation',
            entityId: id,
          },
        });
        return tx.quotation.findUniqueOrThrow({ where: { id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async remove(b: string, id: string, u: string) {
    const q = await prisma.quotation.findFirst({ where: { id, businessId: b, status: 'DRAFT' } });
    if (!q)
      throw new AppError(
        409,
        'QUOTATION_NOT_DELETABLE',
        'Only a tenant-owned draft quotation can be deleted.',
      );
    await prisma.$transaction([
      prisma.auditLog.create({
        data: {
          businessId: b,
          actorUserId: u,
          action: 'quotation.delete',
          entityType: 'Quotation',
          entityId: id,
          metadata: { quotationNumber: q.quotationNumber },
        },
      }),
      prisma.quotation.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }
  async convert(b: string, id: string, u: string) {
    return prisma.$transaction(
      async (tx) => {
        const q = await tx.quotation.findFirst({
          where: { id, businessId: b },
          include: { lines: true },
        });
        if (!q) throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation was not found.');
        if (q.status === 'CONVERTED' && q.convertedSaleId)
          return {
            quotation: await tx.quotation.findUniqueOrThrow({ where: { id }, include }),
            sale: await tx.sale.findFirstOrThrow({
              where: { id: q.convertedSaleId, businessId: b },
            }),
          };
        if (q.status !== 'ACCEPTED')
          throw new AppError(
            409,
            'QUOTATION_NOT_CONVERTIBLE',
            'Only an accepted quotation can be converted.',
          );
        const [customer, products, warehouse] = await Promise.all([
          q.customerId
            ? tx.customer.findFirst({ where: { id: q.customerId, businessId: b, isActive: true } })
            : null,
          tx.product.findMany({
            where: { businessId: b, id: { in: q.lines.map((l) => l.productId) }, isActive: true },
            include: { unit: true },
          }),
          tx.warehouse.findFirst({
            where: { businessId: b, isActive: true },
            orderBy: { isDefault: 'desc' },
          }),
        ]);
        if (q.customerId && !customer)
          throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer is no longer active.');
        if (products.length !== q.lines.length)
          throw new AppError(404, 'PRODUCT_NOT_FOUND', 'A quotation product is no longer active.');
        if (!warehouse)
          throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'No active warehouse was found.');
        const input: SaleInput = {
          customerId: q.customerId,
          warehouseId: warehouse.id,
          type: 'REGULAR',
          saleDate: new Date(),
          reference: q.quotationNumber,
          discountAmount: String(q.discountAmount),
          additionalCost: '0',
          taxAmount: String(q.taxAmount),
          paidAmount: '0',
          note: q.customerNote,
          lines: q.lines.map((l) => ({
            productId: l.productId,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            discountAmount: String(l.discountAmount),
            taxAmount: String(l.taxAmount),
            serialNumbers: [],
          })),
        };
        const sale = await createSaleDraftInTransaction(tx, b, u, input, calculateSale(input), {
          quotationId: id,
        });
        const saleId = (sale as { id: string }).id;
        const changed = await tx.quotation.updateMany({
          where: { id, businessId: b, status: 'ACCEPTED', convertedSaleId: null },
          data: { status: 'CONVERTED', convertedSaleId: saleId },
        });
        if (!changed.count)
          throw new AppError(
            409,
            'QUOTATION_CONVERSION_CONFLICT',
            'Quotation was converted by another request.',
          );
        await tx.quotationHistory.create({
          data: {
            businessId: b,
            quotationId: id,
            fromStatus: 'ACCEPTED',
            toStatus: 'CONVERTED',
            action: 'quotation.converted',
            actorUserId: u,
          },
        });
        return {
          quotation: await tx.quotation.findUniqueOrThrow({ where: { id }, include }),
          sale,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
