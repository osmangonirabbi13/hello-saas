import { prisma } from '@hello-shop/database';
import type { Prisma, ServiceStatus } from '@hello-shop/database';
import type { ServiceCreateInput, ServiceUpdateInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { postServiceAccounting } from '../accounting/source-accounting.service.js';
const include = {
  business: { select: { name: true } },
  customer: true,
  product: true,
  serialItem: true,
  assignee: { select: { id: true, displayName: true } },
  createdBy: { select: { displayName: true } },
  deliveredBy: { select: { displayName: true } },
  parts: { include: { product: true } },
  history: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { displayName: true } } },
  },
} satisfies Prisma.ServiceJobInclude;
const minor = (v: string) => {
  const [w, f = ''] = v.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
};
const money = (v: number) => (v / 100).toFixed(2);
const qmillis = (v: string) => {
  const [w, f = ''] = v.split('.');
  return Number(w) * 1000 + Number(f.padEnd(3, '0'));
};
export function serviceTotals(input: {
  serviceCharge: string;
  partsCharge: string;
  discountAmount: string;
  taxAmount: string;
}) {
  const total =
    minor(input.serviceCharge) +
    minor(input.partsCharge) -
    minor(input.discountAmount) +
    minor(input.taxAmount);
  if (total < 0)
    throw new AppError(422, 'INVALID_SERVICE_TOTAL', 'Service total cannot be negative.');
  return money(total);
}
async function number(tx: Prisma.TransactionClient, businessId: string) {
  const row = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key: 'SERVICE' } },
    create: { businessId, key: 'SERVICE', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `SRV-${String(row.nextValue - 1).padStart(6, '0')}`;
}
export class ServiceRepository {
  assignees(businessId: string) {
    return prisma.businessMembership.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { user: { displayName: 'asc' } },
      select: { user: { select: { id: true, displayName: true } } },
    });
  }
  async validateReferences(businessId: string, input: ServiceCreateInput | ServiceUpdateInput) {
    const create = 'deviceName' in input;
    const customerId = create ? input.customerId : undefined,
      productId = create ? input.productId : undefined,
      serialItemId = create ? input.serialItemId : undefined,
      assigneeId = input.assigneeId;
    const [customer, product, serial, assignee] = await Promise.all([
      customerId
        ? prisma.customer.findFirst({ where: { id: customerId, businessId, isActive: true } })
        : null,
      productId
        ? prisma.product.findFirst({ where: { id: productId, businessId, isActive: true } })
        : null,
      serialItemId
        ? prisma.serialItem.findFirst({ where: { id: serialItemId, businessId } })
        : null,
      assigneeId
        ? prisma.businessMembership.findFirst({
            where: { businessId, userId: assigneeId, status: 'ACTIVE' },
            include: { user: true },
          })
        : null,
    ]);
    if (customerId && !customer)
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
    if (productId && !product)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    if (serialItemId && !serial)
      throw new AppError(404, 'SERIAL_NOT_FOUND', 'Serial was not found.');
    if (serial && productId && serial.productId !== productId)
      throw new AppError(
        409,
        'SERIAL_PRODUCT_MISMATCH',
        'Serial does not belong to the selected product.',
      );
    if (assigneeId && !assignee)
      throw new AppError(404, 'ASSIGNEE_NOT_FOUND', 'Active business member was not found.');
  }
  async create(businessId: string, userId: string, input: ServiceCreateInput) {
    await this.validateReferences(businessId, input);
    const parts = input.parts.map((p) => ({
      ...p,
      businessId,
      lineTotal: money(Math.round((qmillis(p.quantity) * minor(p.unitPrice)) / 1000)),
    }));
    return prisma.$transaction(
      async (tx) => {
        const serviceNumber = await number(tx, businessId);
        const item = await tx.serviceJob.create({
          data: {
            businessId,
            serviceNumber,
            customerId: input.customerId ?? null,
            productId: input.productId ?? null,
            serialItemId: input.serialItemId ?? null,
            assigneeId: input.assigneeId ?? null,
            type: input.type,
            typeDescription: input.typeDescription ?? null,
            priority: input.priority,
            deviceName: input.deviceName,
            deviceBrand: input.deviceBrand ?? null,
            deviceModel: input.deviceModel ?? null,
            externalSerialNumber: input.externalSerialNumber ?? null,
            color: input.color ?? null,
            condition: input.condition,
            conditionNote: input.conditionNote ?? null,
            accessories: input.accessories,
            accessoriesNote: input.accessoriesNote ?? null,
            customerComplaint: input.customerComplaint,
            estimatedServiceCharge: input.estimatedServiceCharge,
            estimatedPartsCost: input.estimatedPartsCost,
            createdById: userId,
            parts: { create: parts },
          },
          include,
        });
        await tx.serviceHistory.create({
          data: {
            businessId,
            serviceJobId: item.id,
            toStatus: 'RECEIVED',
            action: 'service.received',
            actorUserId: userId,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'service.create',
            entityType: 'ServiceJob',
            entityId: item.id,
            metadata: { serviceNumber },
          },
        });
        return tx.serviceJob.findUniqueOrThrow({ where: { id: item.id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async list(businessId: string, q: Record<string, unknown>) {
    const page = Number(q.page ?? 1),
      limit = Number(q.limit ?? 20),
      search = typeof q.search === 'string' ? q.search : undefined;
    const where: Prisma.ServiceJobWhereInput = {
      businessId,
      ...(typeof q.status === 'string' ? { status: q.status as ServiceStatus } : {}),
      ...(typeof q.priority === 'string' ? { priority: q.priority as never } : {}),
      ...(typeof q.assigneeId === 'string' ? { assigneeId: q.assigneeId } : {}),
      ...(search
        ? {
            OR: [
              { serviceNumber: { contains: search, mode: 'insensitive' } },
              { deviceName: { contains: search, mode: 'insensitive' } },
              { externalSerialNumber: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { customer: { phone: { contains: search } } },
              { serialItem: { serialNumber: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.serviceJob.findMany({
        where,
        include,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.serviceJob.count({ where }),
    ]);
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  find(businessId: string, id: string) {
    return prisma.serviceJob.findFirst({ where: { id, businessId }, include });
  }
  async update(businessId: string, id: string, userId: string, input: ServiceUpdateInput) {
    await this.validateReferences(businessId, input);
    const current = await prisma.serviceJob.findFirst({ where: { id, businessId } });
    if (!current) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service job was not found.');
    if (['DELIVERED', 'CANCELLED'].includes(current.status))
      throw new AppError(
        409,
        'SERVICE_FINAL',
        'A delivered or cancelled service cannot be edited.',
      );
    const data = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    ) as Prisma.ServiceJobUncheckedUpdateInput;
    if (input.serviceCharge || input.partsCharge || input.discountAmount || input.taxAmount)
      data.grandTotal = serviceTotals({
        serviceCharge: input.serviceCharge ?? String(current.serviceCharge),
        partsCharge: input.partsCharge ?? String(current.partsCharge),
        discountAmount: input.discountAmount ?? String(current.discountAmount),
        taxAmount: input.taxAmount ?? String(current.taxAmount),
      });
    const item = await prisma.serviceJob.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
      include,
    });
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId: userId,
        action: 'service.update',
        entityType: 'ServiceJob',
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
    to: ServiceStatus,
    note?: string | null,
  ) {
    const allowed: Record<ServiceStatus, ServiceStatus[]> = {
      RECEIVED: ['DIAGNOSING', 'CANCELLED'],
      DIAGNOSING: ['WAITING_FOR_APPROVAL', 'IN_PROGRESS', 'CANCELLED'],
      WAITING_FOR_APPROVAL: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['WAITING_FOR_PARTS', 'READY_FOR_DELIVERY', 'CANCELLED'],
      WAITING_FOR_PARTS: ['IN_PROGRESS', 'READY_FOR_DELIVERY', 'CANCELLED'],
      READY_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    return prisma.$transaction(
      async (tx) => {
        const current = await tx.serviceJob.findFirst({ where: { id, businessId } });
        if (!current) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service job was not found.');
        if (!allowed[current.status].includes(to))
          throw new AppError(
            409,
            'SERVICE_TRANSITION_INVALID',
            `Cannot move from ${current.status} to ${to}.`,
          );
        const changed = await tx.serviceJob.updateMany({
          where: { id, businessId, status: current.status },
          data: {
            status: to,
            ...(to === 'WAITING_FOR_APPROVAL' ? { approvalStatus: 'PENDING' } : {}),
            ...(to === 'IN_PROGRESS' && current.approvalStatus === 'PENDING'
              ? { approvalStatus: 'APPROVED' }
              : {}),
            ...(to === 'DELIVERED' ? { deliveredAt: new Date(), deliveredById: userId } : {}),
            ...(to === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
          },
        });
        if (!changed.count)
          throw new AppError(
            409,
            'SERVICE_TRANSITION_CONFLICT',
            'Service changed in another request.',
          );
        await tx.serviceHistory.create({
          data: {
            businessId,
            serviceJobId: id,
            fromStatus: current.status,
            toStatus: to,
            action: `service.${to.toLowerCase()}`,
            note: note ?? null,
            actorUserId: userId,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: `service.transition.${to.toLowerCase()}`,
            entityType: 'ServiceJob',
            entityId: id,
            metadata: { from: current.status, to },
          },
        });
        if (to === 'DELIVERED') await postServiceAccounting(tx, businessId, userId, current, new Date());
        return tx.serviceJob.findUniqueOrThrow({ where: { id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
