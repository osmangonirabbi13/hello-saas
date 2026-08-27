import { AppError } from '../../common/errors/app-error.js';
import type { InventoryService } from '../inventory/inventory.service.js';
import type {
  PurchaseInput,
  PurchaseRepositoryContract,
  PurchaseTotals,
  PostingPurchase,
} from './purchase.types.js';
const cents = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};
const money = (value: number) => (value / 100).toFixed(2);
const quantityMillis = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
};
export function calculatePurchase(input: PurchaseInput): PurchaseTotals {
  const lines = input.lines.map((line) => {
    const gross = Math.round((quantityMillis(line.quantity) * cents(line.unitCost)) / 1000);
    const total = gross - cents(line.discountAmount) + cents(line.taxAmount);
    if (total < 0)
      throw new AppError(
        422,
        'INVALID_LINE_TOTAL',
        'Line discount cannot exceed its value plus tax.',
      );
    return { ...line, lineTotal: money(total) };
  });
  const subtotal = lines.reduce((sum, line) => sum + cents(line.lineTotal), 0);
  const discount = cents(input.discountAmount),
    additional = cents(input.additionalCost),
    tax = cents(input.taxAmount);
  const grand = subtotal - discount + additional + tax;
  if (grand < 0)
    throw new AppError(422, 'INVALID_PURCHASE_TOTAL', 'Purchase total cannot be negative.');
  const paid = cents(input.paidAmount);
  if (paid > grand)
    throw new AppError(422, 'PAID_EXCEEDS_TOTAL', 'Paid amount cannot exceed grand total.');
  return {
    subtotal: money(subtotal),
    discountAmount: money(discount),
    additionalCost: money(additional),
    taxAmount: money(tax),
    grandTotal: money(grand),
    paidAmount: money(paid),
    dueAmount: money(grand - paid),
    lines,
  };
}
export class PurchaseService {
  constructor(
    private readonly repository: PurchaseRepositoryContract,
    private readonly inventory: InventoryService,
  ) {}
  private async validate(businessId: string, input: PurchaseInput) {
    const ids = input.lines.map((line) => line.productId);
    const masters = await this.repository.validateMasters(
      businessId,
      input.supplierId,
      input.warehouseId,
      ids,
    );
    if (!masters.supplier)
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Active supplier was not found.');
    if (!masters.warehouse)
      throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Active warehouse was not found.');
    if (masters.products.length !== new Set(ids).size)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'An active product was not found.');
    const products = new Map(masters.products.map((product) => [product.id, product]));
    for (const line of input.lines) {
      const product = products.get(line.productId)!;
      if (product.serialized) {
        if (product.unit.decimalAllowed || !Number.isInteger(Number(line.quantity)))
          throw new AppError(
            422,
            'SERIALIZED_QUANTITY_INVALID',
            'Serialized products require whole-number quantities.',
          );
        if (line.serialNumbers.length !== Number(line.quantity))
          throw new AppError(
            422,
            'SERIAL_COUNT_MISMATCH',
            'Serial count must equal purchased quantity.',
          );
      } else if (line.serialNumbers.length)
        throw new AppError(
          422,
          'UNEXPECTED_SERIALS',
          'Non-serialized products cannot contain serial numbers.',
        );
    }
    const serials = input.lines.flatMap((line) => line.serialNumbers);
    if ((await this.repository.serialConflicts(businessId, serials)).length)
      throw new AppError(409, 'DUPLICATE_SERIAL', 'A serial already exists for this business.');
  }
  async create(businessId: string, userId: string, input: PurchaseInput) {
    await this.validate(businessId, input);
    return this.repository.createDraft(businessId, userId, input, calculatePurchase(input));
  }
  async update(businessId: string, id: string, input: PurchaseInput) {
    await this.validate(businessId, input);
    const item = await this.repository.updateDraft(businessId, id, input, calculatePurchase(input));
    if (!item)
      throw new AppError(
        409,
        'PURCHASE_NOT_EDITABLE',
        'Only a tenant-owned draft purchase can be edited.',
      );
    return item;
  }
  list(businessId: string, query: Record<string, unknown>) {
    return this.repository.list(businessId, query);
  }
  async find(businessId: string, id: string) {
    const purchase = await this.repository.find(businessId, id);
    if (!purchase) throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase was not found.');
    return purchase;
  }
  async post(businessId: string, id: string, userId: string) {
    const purchase = await this.find(businessId, id);
    if (purchase.status === 'POSTED') return purchase;
    if (purchase.status !== 'DRAFT')
      throw new AppError(409, 'PURCHASE_NOT_POSTABLE', 'Only a draft purchase can be posted.');
    await this.validatePosting(businessId, purchase);
    return this.repository.postAtomic(businessId, id, userId, (tx, tenant, actor, movement) =>
      this.inventory.applyMovementInTransaction(tx, tenant, actor, movement),
    );
  }
  private async validatePosting(businessId: string, purchase: PostingPurchase) {
    const serials = purchase.lines.flatMap((line) => line.serialNumbers);
    if ((await this.repository.serialConflicts(businessId, serials)).length)
      throw new AppError(409, 'DUPLICATE_SERIAL', 'A serial already exists for this business.');
    for (const line of purchase.lines) {
      if (!line.product.isActive)
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'An active product was not found.');
      if (line.product.serialized && line.serialNumbers.length !== Number(line.quantity))
        throw new AppError(
          422,
          'SERIAL_COUNT_MISMATCH',
          'Serial count must equal purchased quantity.',
        );
    }
  }
  async deleteDraft(businessId: string, id: string, userId: string) {
    if (!(await this.repository.deleteDraft(businessId, id, userId)))
      throw new AppError(
        409,
        'PURCHASE_NOT_DELETABLE',
        'Only a tenant-owned draft purchase can be deleted.',
      );
    return { deleted: true };
  }
}
