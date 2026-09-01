import { Prisma } from '@hello-shop/database';
import type { MovementInput } from '../inventory/inventory.types.js';
import { AppError } from '../../common/errors/app-error.js';

const INBOUND = new Set([
  'OPENING_STOCK',
  'PURCHASE',
  'SALE_RETURN',
  'ADJUSTMENT_IN',
  'TRANSFER_IN',
]);

export async function applyInventoryValuation(
  tx: Prisma.TransactionClient,
  businessId: string,
  input: MovementInput,
  stockMovementId: string,
  signedQuantity: number,
) {
  const previous = await tx.inventoryCostState.findUnique({
    where: {
      businessId_warehouseId_productId: {
        businessId,
        warehouseId: input.warehouseId,
        productId: input.productId,
      },
    },
  });
  const quantityBefore = new Prisma.Decimal(previous?.quantity ?? 0);
  const costBefore = new Prisma.Decimal(previous?.totalCost ?? 0);
  const averageBefore = new Prisma.Decimal(previous?.averageUnitCost ?? 0);
  const quantityDelta = new Prisma.Decimal(signedQuantity);
  const inbound = INBOUND.has(input.type);
  let unitCost = inbound ? new Prisma.Decimal(input.unitCost ?? 0) : averageBefore;
  if (inbound && unitCost.isZero() && input.type !== 'SALE_RETURN')
    throw new AppError(
      422,
      'INVENTORY_COST_REQUIRED',
      'Inbound stock requires an authoritative unit cost.',
    );
  if (inbound && input.type === 'SALE_RETURN' && unitCost.isZero()) {
    const saleReturn = input.referenceId
      ? await tx.saleReturn.findFirst({
          where: { id: input.referenceId, businessId },
          select: { saleId: true },
        })
      : null;
    const original = await tx.inventoryCostMovement.findFirst({
      where: {
        businessId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        sourceType: 'SALE',
        sourceId: saleReturn?.saleId ?? '',
      },
      orderBy: { createdAt: 'desc' },
    });
    unitCost = original?.unitCost ?? averageBefore;
  }
  if (!inbound && averageBefore.isZero() && quantityBefore.greaterThan(0))
    throw new AppError(
      409,
      'INVENTORY_COST_MISSING',
      'Inventory valuation is missing for this stock.',
    );

  const rawDelta = unitCost.mul(quantityDelta);
  const totalCostDelta = rawDelta.toDecimalPlaces(2);
  const quantityAfter = quantityBefore.plus(quantityDelta);
  let costAfter = costBefore.plus(totalCostDelta);
  if (quantityAfter.isZero()) costAfter = new Prisma.Decimal(0);
  if (quantityAfter.isNegative() || costAfter.isNegative())
    throw new AppError(
      409,
      'INVALID_INVENTORY_VALUATION',
      'Inventory valuation cannot be negative.',
    );
  const averageAfter = quantityAfter.isZero()
    ? new Prisma.Decimal(0)
    : costAfter.div(quantityAfter).toDecimalPlaces(6);

  await tx.inventoryCostState.upsert({
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
      quantity: quantityAfter,
      totalCost: costAfter,
      averageUnitCost: averageAfter,
    },
    update: { quantity: quantityAfter, totalCost: costAfter, averageUnitCost: averageAfter },
  });
  return tx.inventoryCostMovement.create({
    data: {
      businessId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      stockMovementId,
      quantityDelta,
      unitCost,
      totalCostDelta,
      costBefore,
      costAfter,
      averageBefore,
      averageAfter,
      sourceType: input.referenceType ?? input.type,
      sourceId: input.referenceId ?? stockMovementId,
    },
  });
}
