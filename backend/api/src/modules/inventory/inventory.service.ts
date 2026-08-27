import { AppError } from '../../common/errors/app-error.js';
import type { Prisma } from '@hello-shop/database';
import {
  OUTBOUND_MOVEMENTS,
  stockStatus,
  type AdjustmentInput,
  type InventoryRepositoryContract,
  type MovementInput,
} from './inventory.types.js';
export class InventoryService {
  constructor(private readonly repository: InventoryRepositoryContract) {}
  getAvailableStock(businessId: string, warehouseId: string, productId: string) {
    return this.repository.balance(businessId, warehouseId, productId);
  }
  async applyMovement(businessId: string, userId: string, input: MovementInput) {
    const context = await this.repository.context(businessId, input.warehouseId, input.productId);
    if (!context)
      throw new AppError(404, 'INVENTORY_CONTEXT_NOT_FOUND', 'Product or warehouse was not found.');
    if (!context.product.trackStock)
      throw new AppError(422, 'STOCK_TRACKING_DISABLED', 'Product does not track stock.');
    const quantity = Number(input.quantity);
    const signed = OUTBOUND_MOVEMENTS.has(input.type) ? -quantity : quantity;
    const current = await this.repository.balance(businessId, input.warehouseId, input.productId);
    if (!context.product.allowNegativeStock && current + signed < 0)
      throw new AppError(409, 'NEGATIVE_STOCK_DENIED', 'Insufficient available stock.');
    return this.repository.applyAtomic(businessId, userId, input, signed);
  }
  applyMovementInTransaction(
    transaction: Prisma.TransactionClient,
    businessId: string,
    userId: string,
    input: MovementInput,
  ) {
    const quantity = Number(input.quantity);
    const signed = OUTBOUND_MOVEMENTS.has(input.type) ? -quantity : quantity;
    return this.repository.applyWithTransaction(transaction, businessId, userId, input, signed);
  }
  async createAdjustment(businessId: string, userId: string, input: AdjustmentInput) {
    for (const line of input.lines)
      await this.applyMovementValidationOnly(
        businessId,
        input.warehouseId,
        line.productId,
        line.direction,
        line.quantity,
      );
    return this.repository.createAdjustmentAtomic(businessId, userId, input);
  }
  private async applyMovementValidationOnly(
    businessId: string,
    warehouseId: string,
    productId: string,
    type: MovementInput['type'],
    quantity: string,
  ) {
    const context = await this.repository.context(businessId, warehouseId, productId);
    if (!context)
      throw new AppError(404, 'INVENTORY_CONTEXT_NOT_FOUND', 'Product or warehouse was not found.');
    const signed = OUTBOUND_MOVEMENTS.has(type) ? -Number(quantity) : Number(quantity);
    const current = await this.repository.balance(businessId, warehouseId, productId);
    if (!context.product.allowNegativeStock && current + signed < 0)
      throw new AppError(409, 'NEGATIVE_STOCK_DENIED', 'Insufficient available stock.');
  }
  listStock(businessId: string, query: Record<string, unknown>) {
    return this.repository.listStock(businessId, query);
  }
  listMovements(businessId: string, query: Record<string, unknown>) {
    return this.repository.listMovements(businessId, query);
  }
  listAdjustments(businessId: string, query: Record<string, unknown>) {
    return this.repository.listAdjustments(businessId, query);
  }
  async findAdjustment(businessId: string, id: string) {
    const item = await this.repository.findAdjustment(businessId, id);
    if (!item) throw new AppError(404, 'ADJUSTMENT_NOT_FOUND', 'Adjustment was not found.');
    return item;
  }
  listWarehouses(businessId: string) {
    return this.repository.listWarehouses(businessId);
  }
  listSerials(businessId: string, query: Record<string, unknown>) {
    return this.repository.listSerials(businessId, query);
  }
  async findSerial(businessId: string, id: string) {
    const item = await this.repository.findSerial(businessId, id);
    if (!item) throw new AppError(404, 'SERIAL_NOT_FOUND', 'Serial item was not found.');
    return item;
  }
  static status(quantity: number, reorderLevel: number) {
    return stockStatus(quantity, reorderLevel);
  }
}
