import { randomBytes } from 'node:crypto';
import { prisma } from '@hello-shop/database';
import type { Prisma, RmaStatus } from '@hello-shop/database';
import type { RmaCreateInput, RmaUpdateInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';

const finalStatuses: RmaStatus[] = ['DELIVERED', 'CANCELLED'];
const include = {
  business: { select: { name: true } },
  sale: { select: { saleNumber: true, invoiceNumber: true, saleDate: true, type: true } },
  saleLine: true,
  product: { select: { name: true, sku: true, serialized: true } },
  serialItem: {
    select: { id: true, serialNumber: true, status: true, warrantyStart: true, warrantyEnd: true },
  },
  replacementSerialItem: { select: { id: true, serialNumber: true, status: true } },
  customer: true,
  supplier: true,
  createdBy: { select: { displayName: true } },
  history: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { displayName: true } } },
  },
} satisfies Prisma.RmaInclude;
async function sequence(tx: Prisma.TransactionClient, businessId: string) {
  const row = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key: 'RMA' } },
    create: { businessId, key: 'RMA', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `RMA-${String(row.nextValue - 1).padStart(6, '0')}`;
}
function expiry(saleDate: Date, duration: number | null, unit: string | null) {
  if (!duration || !unit) return null;
  const date = new Date(saleDate);
  if (unit === 'DAYS') date.setUTCDate(date.getUTCDate() + duration);
  if (unit === 'MONTHS') date.setUTCMonth(date.getUTCMonth() + duration);
  if (unit === 'YEARS') date.setUTCFullYear(date.getUTCFullYear() + duration);
  return date;
}
const reason = (end: Date | null, status: string, active: boolean) =>
  active
    ? 'ACTIVE_RMA_EXISTS'
    : status !== 'SOLD'
      ? 'SERIAL_NOT_SOLD'
      : !end
        ? 'WARRANTY_NOT_CONFIGURED'
        : end < new Date()
          ? 'WARRANTY_EXPIRED'
          : 'ELIGIBLE';

export class RmaRepository {
  async eligibility(businessId: string, lookup: { serial?: string; saleLineId?: string }) {
    if (lookup.serial) {
      const item = await prisma.serialItem.findFirst({
        where: { businessId, serialNumber: { equals: lookup.serial, mode: 'insensitive' } },
        include: {
          product: true,
          sale: { include: { customer: true } },
          rmas: {
            where: { status: { notIn: finalStatuses } },
            select: { id: true, rmaNumber: true, status: true },
          },
        },
      });
      if (!item || !item.saleId || !item.sale)
        throw new AppError(404, 'WARRANTY_SOURCE_NOT_FOUND', 'A sold serial was not found.');
      const resultReason = reason(item.warrantyEnd, item.status, item.rmas.length > 0);
      return {
        eligible: resultReason === 'ELIGIBLE',
        reason: resultReason,
        serialItem: item,
        warrantyStart: item.warrantyStart,
        warrantyEnd: item.warrantyEnd,
        activeRma: item.rmas[0] ?? null,
      };
    }
    const saleLineId = lookup.saleLineId;
    if (!saleLineId)
      throw new AppError(422, 'WARRANTY_LOOKUP_INVALID', 'Sale line is required.');
    const line = await prisma.saleLine.findFirst({
      where: { id: saleLineId, businessId, sale: { status: 'POSTED' } },
      include: {
        product: true,
        sale: { include: { customer: true } },
        rmas: {
          where: { status: { notIn: finalStatuses } },
          select: { id: true, rmaNumber: true, status: true },
        },
      },
    });
    if (!line)
      throw new AppError(404, 'WARRANTY_SOURCE_NOT_FOUND', 'A posted sale line was not found.');
    if (line.product.serialized)
      throw new AppError(422, 'SERIAL_REQUIRED', 'Use the sold Serial/IMEI for this product.');
    const duration =
      line.warrantyDuration ??
      (line.product.warrantyEnabled ? line.product.warrantyDuration : null);
    const unit =
      line.warrantyUnit ?? (line.product.warrantyEnabled ? line.product.warrantyUnit : null);
    const end = expiry(line.sale.saleDate, duration, unit);
    const resultReason = line.rmas.length
      ? 'ACTIVE_RMA_EXISTS'
      : !end
        ? 'WARRANTY_NOT_CONFIGURED'
        : end < new Date()
          ? 'WARRANTY_EXPIRED'
          : 'ELIGIBLE';
    return {
      eligible: resultReason === 'ELIGIBLE',
      reason: resultReason,
      saleLine: line,
      warrantyStart: end ? line.sale.saleDate : null,
      warrantyEnd: end,
      activeRma: line.rmas[0] ?? null,
    };
  }
  async list(
    businessId: string,
    query: { page?: number; limit?: number; status?: RmaStatus; search?: string },
  ) {
    const page = query.page ?? 1,
      limit = query.limit ?? 20;
    const where: Prisma.RmaWhereInput = {
      businessId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { rmaNumber: { contains: query.search, mode: 'insensitive' } },
              { serialItem: { serialNumber: { contains: query.search, mode: 'insensitive' } } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.rma.findMany({
        where,
        include,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rma.count({ where }),
    ]);
    return { items, page, limit, total };
  }
  find(businessId: string, id: string) {
    return prisma.rma.findFirst({ where: { id, businessId }, include });
  }
  async create(businessId: string, userId: string, input: RmaCreateInput) {
    const eligibility = await this.eligibility(
      businessId,
      input.serialNumber
        ? { serial: input.serialNumber }
        : { saleLineId: input.saleLineId! },
    );
    if (!eligibility.eligible)
      throw new AppError(
        409,
        'WARRANTY_NOT_ELIGIBLE',
        `Warranty claim cannot be opened: ${eligibility.reason}.`,
      );
    const serial = 'serialItem' in eligibility ? eligibility.serialItem : null;
    const line =
      'saleLine' in eligibility
        ? eligibility.saleLine
        : await prisma.saleLine.findFirst({
            where: {
              businessId,
              saleId: serial!.saleId!,
              productId: serial!.productId,
              serialNumbers: { has: serial!.serialNumber },
            },
            include: { sale: true },
          });
    if (!line)
      throw new AppError(404, 'SALE_LINE_NOT_FOUND', 'The authoritative sale line was not found.');
    if (Number(input.quantity) > Number(line.quantity))
      throw new AppError(409, 'RMA_QUANTITY_EXCEEDED', 'Claim quantity exceeds the sold quantity.');
    return prisma.$transaction(
      async (tx) => {
        const active = await tx.rma.findFirst({
          where: {
            businessId,
            ...(serial ? { serialItemId: serial.id } : { saleLineId: line.id }),
            status: { notIn: finalStatuses },
          },
          select: { id: true },
        });
        if (active)
          throw new AppError(
            409,
            'ACTIVE_RMA_EXISTS',
            'An active RMA already exists for this item.',
          );
        if (serial) {
          const claimed = await tx.serialItem.updateMany({
            where: { id: serial.id, businessId, status: 'SOLD' },
            data: { status: 'IN_RMA' },
          });
          if (!claimed.count)
            throw new AppError(
              409,
              'SERIAL_RMA_CONFLICT',
              'The serial is no longer available for RMA intake.',
            );
        }
        const rmaNumber = await sequence(tx, businessId);
        const item = await tx.rma.create({
          data: {
            businessId,
            rmaNumber,
            publicToken: randomBytes(32).toString('base64url'),
            saleId: line.saleId,
            saleLineId: line.id,
            productId: line.productId,
            serialItemId: serial?.id ?? null,
            customerId: line.sale.customerId,
            quantity: serial ? '1' : input.quantity,
            issue: input.issue,
            issueDescription: input.issueDescription,
            physicalCondition: input.physicalCondition,
            conditionNote: input.conditionNote ?? null,
            accessories: input.accessories,
            accessoriesNote: input.accessoriesNote ?? null,
            customerNotes: input.customerNotes ?? null,
            internalNotes: input.internalNotes ?? null,
            warrantyEligible: true,
            warrantyReason: eligibility.reason,
            warrantyStart: eligibility.warrantyStart,
            warrantyEnd: eligibility.warrantyEnd,
            createdById: userId,
          },
          include,
        });
        await tx.rmaHistory.create({
          data: {
            businessId,
            rmaId: item.id,
            toStatus: 'RECEIVED',
            action: 'rma.received',
            actorUserId: userId,
          },
        });
        if (serial)
          await tx.serialHistory.create({
            data: {
              businessId,
              serialItemId: serial.id,
              eventType: 'RMA_RECEIVED',
              referenceType: 'RMA',
              referenceId: item.id,
            },
          });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'rma.create',
            entityType: 'Rma',
            entityId: item.id,
            metadata: { rmaNumber },
          },
        });
        return tx.rma.findUniqueOrThrow({ where: { id: item.id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async update(businessId: string, id: string, userId: string, input: RmaUpdateInput) {
    const current = await prisma.rma.findFirst({ where: { id, businessId } });
    if (!current) throw new AppError(404, 'RMA_NOT_FOUND', 'RMA was not found.');
    if (finalStatuses.includes(current.status))
      throw new AppError(409, 'RMA_FINAL', 'A delivered or cancelled RMA cannot be edited.');
    if (input.replacementSerialItemId) {
      const replacement = await prisma.serialItem.findFirst({
        where: {
          id: input.replacementSerialItemId,
          businessId,
          productId: current.productId,
          status: 'IN_STOCK',
        },
      });
      if (!replacement)
        throw new AppError(
          409,
          'REPLACEMENT_SERIAL_INVALID',
          'Replacement must be an in-stock serial for the same tenant and product.',
        );
    }
    const data = Object.fromEntries(
      Object.entries(input).filter((entry) => entry[1] !== undefined),
    ) as Prisma.RmaUncheckedUpdateInput;
    const item = await prisma.rma.update({ where: { id }, data, include });
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId: userId,
        action: 'rma.update',
        entityType: 'Rma',
        entityId: id,
        metadata: { fields: Object.keys(input) },
      },
    });
    return item;
  }
  async transition(
    businessId: string,
    id: string,
    userId: string,
    toStatus: RmaStatus,
    note?: string | null,
  ) {
    const allowed: Record<RmaStatus, RmaStatus[]> = {
      RECEIVED: ['INSPECTING', 'CANCELLED'],
      INSPECTING: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['SENT_TO_SUPPLIER', 'READY_FOR_CUSTOMER', 'CANCELLED'],
      REJECTED: ['READY_FOR_CUSTOMER', 'CANCELLED'],
      SENT_TO_SUPPLIER: ['SUPPLIER_PROCESSING', 'SUPPLIER_RETURNED'],
      SUPPLIER_PROCESSING: ['SUPPLIER_RETURNED'],
      SUPPLIER_RETURNED: ['READY_FOR_CUSTOMER'],
      READY_FOR_CUSTOMER: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    return prisma.$transaction(
      async (tx) => {
        const current = await tx.rma.findFirst({ where: { id, businessId } });
        if (!current) throw new AppError(404, 'RMA_NOT_FOUND', 'RMA was not found.');
        if (!allowed[current.status].includes(toStatus))
          throw new AppError(
            409,
            'RMA_TRANSITION_INVALID',
            `Cannot move from ${current.status} to ${toStatus}.`,
          );
        if (toStatus === 'SENT_TO_SUPPLIER' && !current.supplierId)
          throw new AppError(
            422,
            'SUPPLIER_REQUIRED',
            'Select a supplier before sending this RMA.',
          );
        const claimed = await tx.rma.updateMany({
          where: { id, businessId, status: current.status },
          data: {
            status: toStatus,
            ...(toStatus === 'SENT_TO_SUPPLIER' ? { sentToSupplierAt: new Date() } : {}),
            ...(toStatus === 'SUPPLIER_RETURNED' ? { receivedFromSupplierAt: new Date() } : {}),
            ...(toStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
            ...(toStatus === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
          },
        });
        if (!claimed.count)
          throw new AppError(409, 'RMA_TRANSITION_CONFLICT', 'RMA changed in another request.');
        await tx.rmaHistory.create({
          data: {
            businessId,
            rmaId: id,
            fromStatus: current.status,
            toStatus,
            action: `rma.${toStatus.toLowerCase()}`,
            note: note ?? null,
            actorUserId: userId,
          },
        });
        if (current.serialItemId) {
          if (toStatus === 'DELIVERED' || toStatus === 'CANCELLED') {
            const restored = await tx.serialItem.updateMany({
              where: { id: current.serialItemId, businessId, status: 'IN_RMA' },
              data: { status: 'SOLD' },
            });
            if (!restored.count)
              throw new AppError(
                409,
                'SERIAL_RMA_CONFLICT',
                'Serial lifecycle no longer matches this RMA.',
              );
          }
          await tx.serialHistory.create({
            data: {
              businessId,
              serialItemId: current.serialItemId,
              eventType: `RMA_${toStatus}`,
              referenceType: 'RMA',
              referenceId: id,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: `rma.transition.${toStatus.toLowerCase()}`,
            entityType: 'Rma',
            entityId: id,
            metadata: { from: current.status, to: toStatus },
          },
        });
        return tx.rma.findUniqueOrThrow({ where: { id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async publicTrack(token: string) {
    const item = await prisma.rma.findUnique({
      where: { publicToken: token },
      select: {
        rmaNumber: true,
        status: true,
        receivedAt: true,
        deliveredAt: true,
        business: { select: { name: true } },
        product: { select: { name: true } },
        serialItem: { select: { serialNumber: true } },
        history: { orderBy: { createdAt: 'asc' }, select: { toStatus: true, createdAt: true } },
      },
    });
    if (!item)
      throw new AppError(404, 'RMA_TRACKING_NOT_FOUND', 'Tracking reference was not found.');
    const serial = item.serialItem?.serialNumber;
    return {
      ...item,
      serialItem: serial
        ? { serialNumber: `${'*'.repeat(Math.max(0, serial.length - 4))}${serial.slice(-4)}` }
        : null,
    };
  }
  async serialHistory(businessId: string, id: string) {
    const serial = await prisma.serialItem.findFirst({
      where: { id, businessId },
      include: {
        product: true,
        history: { orderBy: { occurredAt: 'desc' } },
        rmas: {
          orderBy: { receivedAt: 'desc' },
          select: { id: true, rmaNumber: true, status: true, receivedAt: true },
        },
      },
    });
    if (!serial) throw new AppError(404, 'SERIAL_NOT_FOUND', 'Serial was not found.');
    return serial;
  }
}
