import { AppError } from '../../common/errors/app-error.js';
import { InventoryRepository } from '../inventory/inventory.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import type { PurchaseReturnInput, SaleReturnInput } from '@hello-shop/validation';
import { ReturnRepository } from './return.repository.js';
import { Prisma } from '@hello-shop/database';
import { ApprovalRepository } from '../team-security/approval.repository.js';
import { approvalRequiredError } from '../team-security/approval-error.js';
export class ReturnService {
  private readonly inventory = new InventoryService(new InventoryRepository());
  constructor(private readonly repository = new ReturnRepository(), private readonly approvals = new ApprovalRepository()) {}
  purchaseReturnable(businessId: string, id: string) {
    return this.repository.purchaseReturnable(businessId, id);
  }
  saleReturnable(businessId: string, id: string) {
    return this.repository.saleReturnable(businessId, id);
  }
  createPurchase(businessId: string, userId: string, input: PurchaseReturnInput) {
    return this.repository.createPurchase(businessId, userId, input);
  }
  createSale(businessId: string, userId: string, input: SaleReturnInput) {
    return this.repository.createSale(businessId, userId, input);
  }
  updatePurchase(businessId: string, id: string, userId: string, input: PurchaseReturnInput) {
    return this.repository.updatePurchase(businessId, id, userId, input);
  }
  updateSale(businessId: string, id: string, userId: string, input: SaleReturnInput) {
    return this.repository.updateSale(businessId, id, userId, input);
  }
  listPurchase(businessId: string) {
    return this.repository.listPurchase(businessId);
  }
  listSale(businessId: string) {
    return this.repository.listSale(businessId);
  }
  async findPurchase(businessId: string, id: string) {
    const item = await this.repository.findPurchase(businessId, id);
    if (!item)
      throw new AppError(404, 'PURCHASE_RETURN_NOT_FOUND', 'Purchase return was not found.');
    return item;
  }
  async findSale(businessId: string, id: string) {
    const item = await this.repository.findSale(businessId, id);
    if (!item) throw new AppError(404, 'SALE_RETURN_NOT_FOUND', 'Sale return was not found.');
    return item;
  }
  async postPurchase(businessId: string, id: string, userId: string) {
    const source = await this.findPurchase(businessId, id); const payload = { grandTotal: source.grandTotal.toString(), purchaseId: source.purchaseId };
    const gate = await this.approvals.evaluateAndRequest(businessId, userId, { actionType: 'PURCHASE_RETURN_POST', sourceType: 'PurchaseReturn', sourceId: id, sourceVersion: source.version, value: new Prisma.Decimal(source.grandTotal), reason: 'Purchase Return posting meets the configured approval policy.', payload });
    if (gate.approvalRequired) throw approvalRequiredError(gate.request);
    const execute = () => this.repository.postPurchase(businessId, id, userId, (tx, tenant, actor, movement) =>
      this.inventory.applyMovementInTransaction(tx, tenant, actor, movement),
    );
    return 'approvedRequest' in gate ? this.approvals.execute(businessId, gate.approvedRequest.id, source.version, payload, userId, execute) : execute();
  }
  async postSale(businessId: string, id: string, userId: string) {
    const source = await this.findSale(businessId, id); const payload = { grandTotal: source.grandTotal.toString(), saleId: source.saleId };
    const gate = await this.approvals.evaluateAndRequest(businessId, userId, { actionType: 'SALE_RETURN_POST', sourceType: 'SaleReturn', sourceId: id, sourceVersion: source.version, value: new Prisma.Decimal(source.grandTotal), reason: 'Sale Return posting meets the configured approval policy.', payload });
    if (gate.approvalRequired) throw approvalRequiredError(gate.request);
    const execute = () => this.repository.postSale(businessId, id, userId, (tx, tenant, actor, movement) =>
      this.inventory.applyMovementInTransaction(tx, tenant, actor, movement),
    );
    return 'approvedRequest' in gate ? this.approvals.execute(businessId, gate.approvedRequest.id, source.version, payload, userId, execute) : execute();
  }
  deletePurchase(businessId: string, id: string, userId: string) {
    return this.repository.deletePurchase(businessId, id, userId);
  }
  deleteSale(businessId: string, id: string, userId: string) {
    return this.repository.deleteSale(businessId, id, userId);
  }
}
