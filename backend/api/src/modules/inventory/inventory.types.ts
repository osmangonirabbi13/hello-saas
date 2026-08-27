import type { Prisma } from '@hello-shop/database';

export type MovementType =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'PURCHASE_RETURN'
  | 'SALE'
  | 'SALE_RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';
export type MovementInput = {
  warehouseId: string;
  productId: string;
  type: MovementType;
  quantity: string;
  referenceType?: string | null;
  referenceId?: string | null;
  unitCost?: string | null;
  note?: string | null;
};
export type AdjustmentInput = {
  warehouseId: string;
  reason:
    | 'OPENING_BALANCE'
    | 'PHYSICAL_COUNT'
    | 'DAMAGE_CORRECTION'
    | 'LOST'
    | 'FOUND'
    | 'DATA_CORRECTION'
    | 'OTHER';
  note?: string | null;
  lines: Array<{
    productId: string;
    direction: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    quantity: string;
    unitCost?: string | null;
  }>;
};
export type InventoryContext = {
  product: { id: string; allowNegativeStock: boolean; trackStock: boolean };
  warehouse: { id: string };
};
export interface InventoryRepositoryContract {
  context(
    businessId: string,
    warehouseId: string,
    productId: string,
  ): Promise<InventoryContext | null>;
  balance(businessId: string, warehouseId: string, productId: string): Promise<number>;
  applyAtomic(
    businessId: string,
    userId: string,
    input: MovementInput,
    signedQuantity: number,
  ): Promise<{ movement: object; quantity: number }>;
  applyWithTransaction(
    transaction: Prisma.TransactionClient,
    businessId: string,
    userId: string,
    input: MovementInput,
    signedQuantity: number,
  ): Promise<{ movement: object; quantity: number }>;
  createAdjustmentAtomic(
    businessId: string,
    userId: string,
    input: AdjustmentInput,
  ): Promise<object>;
  listStock(businessId: string, query: Record<string, unknown>): Promise<object>;
  listMovements(businessId: string, query: Record<string, unknown>): Promise<object>;
  listAdjustments(businessId: string, query: Record<string, unknown>): Promise<object>;
  findAdjustment(businessId: string, id: string): Promise<object | null>;
  listWarehouses(businessId: string): Promise<object[]>;
  listSerials(businessId: string, query: Record<string, unknown>): Promise<object>;
  findSerial(businessId: string, id: string): Promise<object | null>;
  findSerialByNumber(
    businessId: string,
    serialNumber: string,
  ): Promise<({ status: string } & object) | null>;
}
export const OUTBOUND_MOVEMENTS = new Set<MovementType>([
  'PURCHASE_RETURN',
  'SALE',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'TRANSFER_OUT',
]);
export function stockStatus(quantity: number, reorderLevel: number) {
  if (quantity < 0) return 'NEGATIVE_STOCK' as const;
  if (quantity === 0) return 'OUT_OF_STOCK' as const;
  if (quantity <= reorderLevel) return 'LOW_STOCK' as const;
  return 'IN_STOCK' as const;
}
