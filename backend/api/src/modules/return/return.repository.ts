import { prisma } from '@hello-shop/database';
import type { Prisma, PurchaseReturnReason, SaleReturnReason } from '@hello-shop/database';
import type { PurchaseReturnInput, SaleReturnInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { postPurchaseReturnAccounting, postSaleReturnAccounting } from '../accounting/source-accounting.service.js';
import type { ReturnPoster } from './return.types.js';

const purchaseInclude = {
  business: { select: { name: true } },
  purchase: { select: { purchaseNumber: true } },
  supplier: true,
  warehouse: true,
  createdBy: { select: { displayName: true } },
  postedBy: { select: { displayName: true } },
  lines: {
    include: {
      product: { select: { name: true, sku: true, serialized: true } },
      purchaseLine: true,
    },
  },
} satisfies Prisma.PurchaseReturnInclude;
const saleInclude = {
  business: { select: { name: true } },
  sale: { select: { saleNumber: true, invoiceNumber: true, type: true } },
  customer: true,
  warehouse: true,
  createdBy: { select: { displayName: true } },
  postedBy: { select: { displayName: true } },
  lines: {
    include: { product: { select: { name: true, sku: true, serialized: true } }, saleLine: true },
  },
} satisfies Prisma.SaleReturnInclude;
const minor = (value: Prisma.Decimal | string) => Math.round(Number(value) * 100);
const money = (value: number) => (value / 100).toFixed(2);
const ratioMoney = (value: Prisma.Decimal, quantity: number, original: Prisma.Decimal) =>
  Math.round((minor(value) * quantity) / Number(original));
async function sequence(tx: Prisma.TransactionClient, businessId: string, key: string) {
  const row = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `${key}-${String(row.nextValue - 1).padStart(6, '0')}`;
}

export class ReturnRepository {
  async purchaseReturnable(businessId: string, purchaseId: string) {
    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, businessId, status: 'POSTED' },
      include: { supplier: true, warehouse: true, lines: { include: { product: true } } },
    });
    if (!purchase)
      throw new AppError(404, 'PURCHASE_NOT_RETURNABLE', 'A posted purchase was not found.');
    const returned = await prisma.purchaseReturnLine.groupBy({
      by: ['purchaseLineId'],
      where: { businessId, purchaseReturn: { purchaseId, status: 'POSTED' } },
      _sum: { quantity: true },
    });
    const totals = new Map(
      returned.map((row) => [row.purchaseLineId, Number(row._sum.quantity ?? 0)]),
    );
    const serials = await prisma.serialItem.findMany({
      where: { businessId, purchaseId, warehouseId: purchase.warehouseId, status: 'IN_STOCK' },
      select: { serialNumber: true, productId: true },
    });
    return {
      ...purchase,
      lines: purchase.lines.map((line) => ({
        ...line,
        returnedQuantity: totals.get(line.id) ?? 0,
        returnableQuantity: Number(line.quantity) - (totals.get(line.id) ?? 0),
        eligibleSerials: serials
          .filter((s) => s.productId === line.productId)
          .map((s) => s.serialNumber),
      })),
    };
  }
  async saleReturnable(businessId: string, saleId: string) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId, status: 'POSTED' },
      include: { customer: true, warehouse: true, lines: { include: { product: true } } },
    });
    if (!sale) throw new AppError(404, 'SALE_NOT_RETURNABLE', 'A posted sale was not found.');
    const returned = await prisma.saleReturnLine.groupBy({
      by: ['saleLineId'],
      where: { businessId, saleReturn: { saleId, status: 'POSTED' } },
      _sum: { quantity: true },
    });
    const totals = new Map(returned.map((row) => [row.saleLineId, Number(row._sum.quantity ?? 0)]));
    const serials = await prisma.serialItem.findMany({
      where: { businessId, saleId, warehouseId: sale.warehouseId, status: 'SOLD' },
      select: { serialNumber: true, productId: true },
    });
    return {
      ...sale,
      lines: sale.lines.map((line) => ({
        ...line,
        returnedQuantity: totals.get(line.id) ?? 0,
        returnableQuantity: Number(line.quantity) - (totals.get(line.id) ?? 0),
        eligibleSerials: serials
          .filter(
            (s) => s.productId === line.productId && line.serialNumbers.includes(s.serialNumber),
          )
          .map((s) => s.serialNumber),
      })),
    };
  }
  async createPurchase(businessId: string, userId: string, input: PurchaseReturnInput) {
    const source = await this.purchaseReturnable(businessId, input.sourceId);
    const lines = input.lines.map((entry) => {
      const line = source.lines.find((item) => item.id === entry.sourceLineId);
      if (!line || Number(entry.quantity) > line.returnableQuantity)
        throw new AppError(
          409,
          'RETURN_QUANTITY_EXCEEDED',
          'Return quantity exceeds the remaining purchased quantity.',
        );
      if (
        line.product.serialized &&
        (entry.serialNumbers.length !== Number(entry.quantity) ||
          entry.serialNumbers.some((s) => !line.eligibleSerials.includes(s)))
      )
        throw new AppError(
          409,
          'SERIAL_NOT_RETURNABLE',
          'Select eligible in-stock serials from this purchase.',
        );
      if (!line.product.serialized && entry.serialNumbers.length)
        throw new AppError(422, 'UNEXPECTED_SERIALS', 'Ordinary products cannot include serials.');
      const gross = Math.round(Number(entry.quantity) * minor(line.unitCost));
      const discount = ratioMoney(line.discountAmount, Number(entry.quantity), line.quantity);
      const tax = ratioMoney(line.taxAmount, Number(entry.quantity), line.quantity);
      return {
        businessId,
        purchaseLineId: line.id,
        productId: line.productId,
        quantity: entry.quantity,
        unitCost: line.unitCost,
        discountAmount: money(discount),
        taxAmount: money(tax),
        lineTotal: money(gross - discount + tax),
        serialNumbers: entry.serialNumbers,
      };
    });
    const subtotal = lines.reduce(
      (sum, line) => sum + minor(line.unitCost) * Number(line.quantity),
      0,
    );
    const discount = lines.reduce((sum, line) => sum + minor(line.discountAmount), 0);
    const tax = lines.reduce((sum, line) => sum + minor(line.taxAmount), 0);
    return prisma.$transaction(
      async (tx) => {
        const returnNumber = await sequence(tx, businessId, 'PRT');
        const item = await tx.purchaseReturn.create({
          data: {
            businessId,
            returnNumber,
            purchaseId: source.id,
            supplierId: source.supplierId,
            warehouseId: source.warehouseId,
            returnDate: input.returnDate,
            reason: input.reason as PurchaseReturnReason,
            note: input.note ?? null,
            subtotal: money(subtotal),
            discountAmount: money(discount),
            taxAmount: money(tax),
            grandTotal: money(subtotal - discount + tax),
            createdById: userId,
            lines: { create: lines },
          },
          include: purchaseInclude,
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'purchase_return.create',
            entityType: 'PurchaseReturn',
            entityId: item.id,
            metadata: { returnNumber, purchaseId: source.id },
          },
        });
        return item;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async createSale(businessId: string, userId: string, input: SaleReturnInput) {
    const source = await this.saleReturnable(businessId, input.sourceId);
    const lines = input.lines.map((entry) => {
      const line = source.lines.find((item) => item.id === entry.sourceLineId);
      if (!line || Number(entry.quantity) > line.returnableQuantity)
        throw new AppError(
          409,
          'RETURN_QUANTITY_EXCEEDED',
          'Return quantity exceeds the remaining sold quantity.',
        );
      if (
        line.product.serialized &&
        (entry.serialNumbers.length !== Number(entry.quantity) ||
          entry.serialNumbers.some((s) => !line.eligibleSerials.includes(s)))
      )
        throw new AppError(409, 'SERIAL_NOT_RETURNABLE', 'Select serials sold on this sale.');
      if (!line.product.serialized && entry.serialNumbers.length)
        throw new AppError(422, 'UNEXPECTED_SERIALS', 'Ordinary products cannot include serials.');
      const gross = Math.round(Number(entry.quantity) * minor(line.unitPrice));
      const discount = ratioMoney(line.discountAmount, Number(entry.quantity), line.quantity);
      const tax = ratioMoney(line.taxAmount, Number(entry.quantity), line.quantity);
      return {
        businessId,
        saleLineId: line.id,
        productId: line.productId,
        quantity: entry.quantity,
        unitPrice: line.unitPrice,
        discountAmount: money(discount),
        taxAmount: money(tax),
        lineTotal: money(gross - discount + tax),
        serialNumbers: entry.serialNumbers,
      };
    });
    const subtotal = lines.reduce(
      (sum, line) => sum + minor(line.unitPrice) * Number(line.quantity),
      0,
    );
    const discount = lines.reduce((sum, line) => sum + minor(line.discountAmount), 0);
    const tax = lines.reduce((sum, line) => sum + minor(line.taxAmount), 0);
    return prisma.$transaction(
      async (tx) => {
        const returnNumber = await sequence(tx, businessId, 'SRT');
        const item = await tx.saleReturn.create({
          data: {
            businessId,
            returnNumber,
            saleId: source.id,
            customerId: source.customerId,
            warehouseId: source.warehouseId,
            returnDate: input.returnDate,
            reason: input.reason as SaleReturnReason,
            note: input.note ?? null,
            subtotal: money(subtotal),
            discountAmount: money(discount),
            taxAmount: money(tax),
            grandTotal: money(subtotal - discount + tax),
            createdById: userId,
            lines: { create: lines },
          },
          include: saleInclude,
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'sale_return.create',
            entityType: 'SaleReturn',
            entityId: item.id,
            metadata: { returnNumber, saleId: source.id },
          },
        });
        return item;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async updatePurchase(businessId: string, id: string, userId: string, input: PurchaseReturnInput) {
    const source = await this.purchaseReturnable(businessId, input.sourceId);
    const lines = input.lines.map((entry) => {
      const line = source.lines.find((v) => v.id === entry.sourceLineId);
      if (!line || Number(entry.quantity) > line.returnableQuantity)
        throw new AppError(
          409,
          'RETURN_QUANTITY_EXCEEDED',
          'Return quantity exceeds remaining quantity.',
        );
      if (
        line.product.serialized &&
        (entry.serialNumbers.length !== Number(entry.quantity) ||
          entry.serialNumbers.some((s) => !line.eligibleSerials.includes(s)))
      )
        throw new AppError(
          409,
          'SERIAL_NOT_RETURNABLE',
          'Select eligible serials from this purchase.',
        );
      const gross = Math.round(Number(entry.quantity) * minor(line.unitCost)),
        discount = ratioMoney(line.discountAmount, Number(entry.quantity), line.quantity),
        tax = ratioMoney(line.taxAmount, Number(entry.quantity), line.quantity);
      return {
        businessId,
        purchaseLineId: line.id,
        productId: line.productId,
        quantity: entry.quantity,
        unitCost: line.unitCost,
        discountAmount: money(discount),
        taxAmount: money(tax),
        lineTotal: money(gross - discount + tax),
        serialNumbers: entry.serialNumbers,
      };
    });
    const subtotal = lines.reduce((s, l) => s + minor(l.unitCost) * Number(l.quantity), 0),
      discount = lines.reduce((s, l) => s + minor(l.discountAmount), 0),
      tax = lines.reduce((s, l) => s + minor(l.taxAmount), 0);
    return prisma.$transaction(
      async (tx) => {
        const changed = await tx.purchaseReturn.updateMany({
          where: { id, businessId, status: 'DRAFT' },
          data: {
            purchaseId: source.id,
            supplierId: source.supplierId,
            warehouseId: source.warehouseId,
            returnDate: input.returnDate,
            reason: input.reason as PurchaseReturnReason,
            note: input.note ?? null,
            subtotal: money(subtotal),
            discountAmount: money(discount),
            taxAmount: money(tax),
            grandTotal: money(subtotal - discount + tax),
            version: { increment: 1 },
          },
        });
        if (!changed.count)
          throw new AppError(
            409,
            'RETURN_NOT_EDITABLE',
            'Only a tenant-owned draft return can be edited.',
          );
        await tx.purchaseReturnLine.deleteMany({ where: { purchaseReturnId: id, businessId } });
        await tx.purchaseReturnLine.createMany({
          data: lines.map((line) => ({ ...line, purchaseReturnId: id })),
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'purchase_return.update',
            entityType: 'PurchaseReturn',
            entityId: id,
          },
        });
        return tx.purchaseReturn.findFirstOrThrow({
          where: { id, businessId },
          include: purchaseInclude,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async updateSale(businessId: string, id: string, userId: string, input: SaleReturnInput) {
    const source = await this.saleReturnable(businessId, input.sourceId);
    const lines = input.lines.map((entry) => {
      const line = source.lines.find((v) => v.id === entry.sourceLineId);
      if (!line || Number(entry.quantity) > line.returnableQuantity)
        throw new AppError(
          409,
          'RETURN_QUANTITY_EXCEEDED',
          'Return quantity exceeds remaining quantity.',
        );
      if (
        line.product.serialized &&
        (entry.serialNumbers.length !== Number(entry.quantity) ||
          entry.serialNumbers.some((s) => !line.eligibleSerials.includes(s)))
      )
        throw new AppError(409, 'SERIAL_NOT_RETURNABLE', 'Select serials sold on this sale.');
      const gross = Math.round(Number(entry.quantity) * minor(line.unitPrice)),
        discount = ratioMoney(line.discountAmount, Number(entry.quantity), line.quantity),
        tax = ratioMoney(line.taxAmount, Number(entry.quantity), line.quantity);
      return {
        businessId,
        saleLineId: line.id,
        productId: line.productId,
        quantity: entry.quantity,
        unitPrice: line.unitPrice,
        discountAmount: money(discount),
        taxAmount: money(tax),
        lineTotal: money(gross - discount + tax),
        serialNumbers: entry.serialNumbers,
      };
    });
    const subtotal = lines.reduce((s, l) => s + minor(l.unitPrice) * Number(l.quantity), 0),
      discount = lines.reduce((s, l) => s + minor(l.discountAmount), 0),
      tax = lines.reduce((s, l) => s + minor(l.taxAmount), 0);
    return prisma.$transaction(
      async (tx) => {
        const changed = await tx.saleReturn.updateMany({
          where: { id, businessId, status: 'DRAFT' },
          data: {
            saleId: source.id,
            customerId: source.customerId,
            warehouseId: source.warehouseId,
            returnDate: input.returnDate,
            reason: input.reason as SaleReturnReason,
            note: input.note ?? null,
            subtotal: money(subtotal),
            discountAmount: money(discount),
            taxAmount: money(tax),
            grandTotal: money(subtotal - discount + tax),
            version: { increment: 1 },
          },
        });
        if (!changed.count)
          throw new AppError(
            409,
            'RETURN_NOT_EDITABLE',
            'Only a tenant-owned draft return can be edited.',
          );
        await tx.saleReturnLine.deleteMany({ where: { saleReturnId: id, businessId } });
        await tx.saleReturnLine.createMany({
          data: lines.map((line) => ({ ...line, saleReturnId: id })),
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'sale_return.update',
            entityType: 'SaleReturn',
            entityId: id,
          },
        });
        return tx.saleReturn.findFirstOrThrow({ where: { id, businessId }, include: saleInclude });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  listPurchase(businessId: string) {
    return prisma.purchaseReturn.findMany({
      where: { businessId },
      include: purchaseInclude,
      orderBy: { returnDate: 'desc' },
    });
  }
  listSale(businessId: string) {
    return prisma.saleReturn.findMany({
      where: { businessId },
      include: saleInclude,
      orderBy: { returnDate: 'desc' },
    });
  }
  findPurchase(businessId: string, id: string) {
    return prisma.purchaseReturn.findFirst({ where: { id, businessId }, include: purchaseInclude });
  }
  findSale(businessId: string, id: string) {
    return prisma.saleReturn.findFirst({ where: { id, businessId }, include: saleInclude });
  }
  async deletePurchase(businessId: string, id: string, userId: string) {
    return this.deleteDraft('PURCHASE', businessId, id, userId);
  }
  async deleteSale(businessId: string, id: string, userId: string) {
    return this.deleteDraft('SALE', businessId, id, userId);
  }
  private async deleteDraft(
    kind: 'PURCHASE' | 'SALE',
    businessId: string,
    id: string,
    userId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const result =
        kind === 'PURCHASE'
          ? await tx.purchaseReturn.deleteMany({ where: { id, businessId, status: 'DRAFT' } })
          : await tx.saleReturn.deleteMany({ where: { id, businessId, status: 'DRAFT' } });
      if (!result.count)
        throw new AppError(
          409,
          'RETURN_NOT_DELETABLE',
          'Only a tenant-owned draft return can be deleted.',
        );
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId: userId,
          action: kind.toLowerCase() + '_return.delete',
          entityType: kind === 'PURCHASE' ? 'PurchaseReturn' : 'SaleReturn',
          entityId: id,
        },
      });
      return { deleted: true };
    });
  }
  async postPurchase(businessId: string, id: string, userId: string, poster: ReturnPoster) {
    return prisma.$transaction(
      async (tx) => {
        const item = await tx.purchaseReturn.findFirst({
          where: { id, businessId },
          include: purchaseInclude,
        });
        if (!item)
          throw new AppError(404, 'PURCHASE_RETURN_NOT_FOUND', 'Purchase return was not found.');
        if (item.status === 'POSTED') return item;
        if (item.status !== 'DRAFT')
          throw new AppError(409, 'RETURN_NOT_POSTABLE', 'Only a draft return can be posted.');
        const source = await tx.purchase.findFirst({
          where: { id: item.purchaseId, businessId, status: 'POSTED' },
          include: { lines: true },
        });
        if (!source)
          throw new AppError(409, 'SOURCE_NOT_POSTED', 'Original purchase is not posted.');
        for (const line of item.lines) {
          const original = source.lines.find((value) => value.id === line.purchaseLineId);
          const prior = await tx.purchaseReturnLine.aggregate({
            where: {
              businessId,
              purchaseLineId: line.purchaseLineId,
              purchaseReturn: { status: 'POSTED' },
            },
            _sum: { quantity: true },
          });
          if (
            !original ||
            Number(line.quantity) > Number(original.quantity) - Number(prior._sum.quantity ?? 0)
          )
            throw new AppError(
              409,
              'RETURN_QUANTITY_EXCEEDED',
              'Return quantity changed; reload and try again.',
            );
          const serials = line.serialNumbers.length
            ? await tx.serialItem.findMany({
                where: {
                  businessId,
                  purchaseId: source.id,
                  warehouseId: item.warehouseId,
                  productId: line.productId,
                  serialNumber: { in: line.serialNumbers },
                  status: 'IN_STOCK',
                },
              })
            : [];
          if (serials.length !== line.serialNumbers.length)
            throw new AppError(
              409,
              'SERIAL_NOT_RETURNABLE',
              'A selected serial is no longer returnable.',
            );
          await poster(tx, businessId, userId, {
            warehouseId: item.warehouseId,
            productId: line.productId,
            type: 'PURCHASE_RETURN',
            quantity: String(line.quantity),
            referenceType: 'PURCHASE_RETURN',
            referenceId: item.id,
            unitCost: String(line.unitCost),
          });
          for (const serial of serials) {
            await tx.serialItem.update({
              where: { id: serial.id },
              data: { status: 'RETURNED_TO_SUPPLIER' },
            });
            await tx.serialHistory.create({
              data: {
                businessId,
                serialItemId: serial.id,
                eventType: 'RETURNED_TO_SUPPLIER',
                referenceType: 'PURCHASE_RETURN',
                referenceId: item.id,
              },
            });
          }
        }
        const claimed = await tx.purchaseReturn.updateMany({
          where: { id, businessId, status: 'DRAFT' },
          data: { status: 'POSTED', postedById: userId, postedAt: new Date() },
        });
        if (!claimed.count)
          throw new AppError(409, 'RETURN_POST_CONFLICT', 'Return was posted by another request.');
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'purchase_return.post',
            entityType: 'PurchaseReturn',
            entityId: id,
            metadata: { returnNumber: item.returnNumber, purchaseId: item.purchaseId },
          },
        });
        await postPurchaseReturnAccounting(tx, businessId, userId, item);
        return tx.purchaseReturn.findFirstOrThrow({
          where: { id, businessId },
          include: purchaseInclude,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async postSale(businessId: string, id: string, userId: string, poster: ReturnPoster) {
    return prisma.$transaction(
      async (tx) => {
        const item = await tx.saleReturn.findFirst({
          where: { id, businessId },
          include: saleInclude,
        });
        if (!item) throw new AppError(404, 'SALE_RETURN_NOT_FOUND', 'Sale return was not found.');
        if (item.status === 'POSTED') return item;
        if (item.status !== 'DRAFT')
          throw new AppError(409, 'RETURN_NOT_POSTABLE', 'Only a draft return can be posted.');
        const source = await tx.sale.findFirst({
          where: { id: item.saleId, businessId, status: 'POSTED' },
          include: { lines: true },
        });
        if (!source) throw new AppError(409, 'SOURCE_NOT_POSTED', 'Original sale is not posted.');
        for (const line of item.lines) {
          const original = source.lines.find((value) => value.id === line.saleLineId);
          const prior = await tx.saleReturnLine.aggregate({
            where: { businessId, saleLineId: line.saleLineId, saleReturn: { status: 'POSTED' } },
            _sum: { quantity: true },
          });
          if (
            !original ||
            Number(line.quantity) > Number(original.quantity) - Number(prior._sum.quantity ?? 0)
          )
            throw new AppError(
              409,
              'RETURN_QUANTITY_EXCEEDED',
              'Return quantity changed; reload and try again.',
            );
          const serials = line.serialNumbers.length
            ? await tx.serialItem.findMany({
                where: {
                  businessId,
                  saleId: source.id,
                  warehouseId: item.warehouseId,
                  productId: line.productId,
                  serialNumber: { in: line.serialNumbers },
                  status: 'SOLD',
                },
              })
            : [];
          if (serials.length !== line.serialNumbers.length)
            throw new AppError(
              409,
              'SERIAL_NOT_RETURNABLE',
              'A selected serial is no longer returnable.',
            );
          await poster(tx, businessId, userId, {
            warehouseId: item.warehouseId,
            productId: line.productId,
            type: 'SALE_RETURN',
            quantity: String(line.quantity),
            referenceType: 'SALE_RETURN',
            referenceId: item.id,
          });
          for (const serial of serials) {
            await tx.serialHistory.create({
              data: {
                businessId,
                serialItemId: serial.id,
                eventType: 'SALE_RETURNED',
                referenceType: 'SALE_RETURN',
                referenceId: item.id,
              },
            });
            await tx.serialItem.update({ where: { id: serial.id }, data: { status: 'IN_STOCK' } });
          }
        }
        const claimed = await tx.saleReturn.updateMany({
          where: { id, businessId, status: 'DRAFT' },
          data: { status: 'POSTED', postedById: userId, postedAt: new Date() },
        });
        if (!claimed.count)
          throw new AppError(409, 'RETURN_POST_CONFLICT', 'Return was posted by another request.');
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'sale_return.post',
            entityType: 'SaleReturn',
            entityId: id,
            metadata: { returnNumber: item.returnNumber, saleId: item.saleId },
          },
        });
        await postSaleReturnAccounting(tx, businessId, userId, item);
        return tx.saleReturn.findFirstOrThrow({ where: { id, businessId }, include: saleInclude });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
