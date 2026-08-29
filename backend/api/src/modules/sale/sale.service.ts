import { AppError } from '../../common/errors/app-error.js';
import type { InventoryService } from '../inventory/inventory.service.js';
import { replayIdempotent, type MutationIdentity } from '../sync/mutation-idempotency.js';
import type { PostingSale, SaleInput, SaleRepositoryContract, SaleTotals } from './sale.types.js';

const minorUnits = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};
const formatMoney = (value: number) => (value / 100).toFixed(2);
const quantityMillis = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
};

export function calculateSale(input: SaleInput): SaleTotals {
  const lines = input.lines.map((line) => {
    const gross = Math.round((quantityMillis(line.quantity) * minorUnits(line.unitPrice)) / 1000);
    const lineTotal = gross - minorUnits(line.discountAmount) + minorUnits(line.taxAmount);
    if (lineTotal < 0)
      throw new AppError(422, 'INVALID_LINE_TOTAL', 'Line discount cannot exceed value plus tax.');
    return { ...line, lineTotal: formatMoney(lineTotal) };
  });
  const subtotal = lines.reduce((sum, line) => sum + minorUnits(line.lineTotal), 0);
  const discount = minorUnits(input.discountAmount);
  const additional = minorUnits(input.additionalCost);
  const tax = minorUnits(input.taxAmount);
  const grandTotal = subtotal - discount + additional + tax;
  if (grandTotal < 0)
    throw new AppError(422, 'INVALID_SALE_TOTAL', 'Sale total cannot be negative.');
  const paid = minorUnits(input.paidAmount);
  if (paid > grandTotal)
    throw new AppError(422, 'PAID_EXCEEDS_TOTAL', 'Paid amount cannot exceed grand total.');
  return {
    subtotal: formatMoney(subtotal),
    discountAmount: formatMoney(discount),
    additionalCost: formatMoney(additional),
    taxAmount: formatMoney(tax),
    grandTotal: formatMoney(grandTotal),
    paidAmount: formatMoney(paid),
    dueAmount: formatMoney(grandTotal - paid),
    lines,
  };
}

export class SaleService {
  constructor(
    private readonly repository: SaleRepositoryContract,
    private readonly inventory: InventoryService,
  ) {}

  private async validate(businessId: string, input: SaleInput) {
    const productIds = input.lines.map((line) => line.productId);
    const masters = await this.repository.validateMasters(
      businessId,
      input.customerId ?? null,
      input.warehouseId,
      productIds,
    );
    if (!masters.customer)
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Active customer was not found.');
    if (!masters.warehouse)
      throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Active warehouse was not found.');
    if (masters.products.length !== new Set(productIds).size)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'An active product was not found.');
    const products = new Map(masters.products.map((product) => [product.id, product]));
    for (const line of input.lines) {
      const product = products.get(line.productId)!;
      if (!product.trackStock)
        throw new AppError(422, 'STOCK_TRACKING_DISABLED', 'Sale products must track stock.');
      if (product.serialized) {
        if (product.unit.decimalAllowed || !Number.isInteger(Number(line.quantity)))
          throw new AppError(
            422,
            'SERIALIZED_QUANTITY_INVALID',
            'Serialized products require whole quantities.',
          );
        if (line.serialNumbers.length !== Number(line.quantity))
          throw new AppError(
            422,
            'SERIAL_COUNT_MISMATCH',
            'Serial count must equal sold quantity.',
          );
      } else if (line.serialNumbers.length)
        throw new AppError(
          422,
          'UNEXPECTED_SERIALS',
          'Non-serialized products cannot contain serials.',
        );
    }
    await this.validateSerials(businessId, input.warehouseId, input.lines);
  }

  private async validateSerials(
    businessId: string,
    warehouseId: string,
    lines: SaleInput['lines'],
  ) {
    const requested = lines.flatMap((line) =>
      line.serialNumbers.map((serialNumber) => ({ serialNumber, productId: line.productId })),
    );
    if (!requested.length) return;
    const found = await this.repository.findSerials(
      businessId,
      warehouseId,
      requested.map((item) => item.serialNumber),
    );
    if (found.length !== requested.length)
      throw new AppError(404, 'SERIAL_NOT_FOUND', 'A sellable serial was not found.');
    const byNumber = new Map(found.map((item) => [item.serialNumber.toLowerCase(), item]));
    for (const item of requested) {
      const serial = byNumber.get(item.serialNumber.toLowerCase());
      if (!serial) throw new AppError(404, 'SERIAL_NOT_FOUND', 'A sellable serial was not found.');
      if (serial.productId !== item.productId)
        throw new AppError(
          409,
          'SERIAL_PRODUCT_MISMATCH',
          'Serial does not belong to the selected product.',
        );
      if (serial.status !== 'IN_STOCK')
        throw new AppError(409, 'SERIAL_NOT_SELLABLE', 'Serial is not available for sale.');
    }
  }

  async create(businessId: string, userId: string, input: SaleInput, identity?: MutationIdentity) {
    const replay = await replayIdempotent<object>(businessId, identity, input);
    if (replay) return replay;
    await this.validate(businessId, input);
    const totals = calculateSale(input);
    return identity
      ? this.repository.createDraft(businessId, userId, input, totals, identity)
      : this.repository.createDraft(businessId, userId, input, totals);
  }
  async update(businessId: string, id: string, input: SaleInput, version?: number) {
    await this.validate(businessId, input);
    const sale = await this.repository.updateDraft(businessId, id, input, calculateSale(input), version);
    if (!sale)
      throw new AppError(409, 'SALE_NOT_EDITABLE', 'Only a tenant-owned draft sale can be edited.');
    return sale;
  }
  list(businessId: string, query: Record<string, unknown>) {
    return this.repository.list(businessId, query);
  }
  async find(businessId: string, id: string) {
    const sale = await this.repository.find(businessId, id);
    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale was not found.');
    return sale;
  }
  async post(businessId: string, id: string, userId: string) {
    const sale = await this.find(businessId, id);
    if (sale.status === 'POSTED') return sale;
    if (sale.status !== 'DRAFT')
      throw new AppError(409, 'SALE_NOT_POSTABLE', 'Only a draft sale can be posted.');
    await this.validatePosting(businessId, sale);
    return this.repository.postAtomic(
      businessId,
      id,
      userId,
      calculateSale,
      (transaction, tenant, actor, movement) =>
        this.inventory.applyMovementInTransaction(transaction, tenant, actor, movement),
    );
  }
  private validatePosting(businessId: string, sale: PostingSale) {
    return this.validateSerials(businessId, sale.warehouseId, sale.lines);
  }
  async deleteDraft(businessId: string, id: string, userId: string) {
    if (!(await this.repository.deleteDraft(businessId, id, userId)))
      throw new AppError(
        409,
        'SALE_NOT_DELETABLE',
        'Only a tenant-owned draft sale can be deleted.',
      );
    return { deleted: true };
  }
}
