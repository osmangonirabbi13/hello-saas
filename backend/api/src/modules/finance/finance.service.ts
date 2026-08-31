import type {
  FinancialAccountCreateInput,
  FinancialAccountUpdateInput,
  FinancialAdjustmentInput,
  FinancialTransactionCreateInput,
  FinancialTransferInput,
} from '@hello-shop/validation';
import type { MutationIdentity } from '../sync/mutation-idempotency.js';
import { FinanceRepository } from './finance.repository.js';

export class FinanceService {
  constructor(private readonly repository = new FinanceRepository()) {}
  listAccounts(businessId: string, query: Record<string, unknown>) {
    return this.repository.listAccounts(businessId, query);
  }
  findAccount(businessId: string, id: string) {
    return this.repository.findAccount(businessId, id);
  }
  createAccount(
    businessId: string,
    userId: string,
    input: FinancialAccountCreateInput,
    identity?: MutationIdentity,
  ) {
    return this.repository.createAccount(businessId, userId, input, identity);
  }
  updateAccount(
    businessId: string,
    id: string,
    userId: string,
    input: FinancialAccountUpdateInput,
  ) {
    return this.repository.updateAccount(businessId, id, userId, input);
  }
  disableAccount(businessId: string, id: string, userId: string) {
    return this.repository.setAccountActive(businessId, id, userId, false);
  }
  enableAccount(businessId: string, id: string, userId: string) {
    return this.repository.setAccountActive(businessId, id, userId, true);
  }
  moneyIn(
    businessId: string,
    userId: string,
    input: FinancialTransactionCreateInput,
    identity?: MutationIdentity,
  ) {
    return this.repository.postTransaction(businessId, userId, input, 'MONEY_IN', identity);
  }
  moneyOut(
    businessId: string,
    userId: string,
    input: FinancialTransactionCreateInput,
    identity?: MutationIdentity,
  ) {
    return this.repository.postTransaction(businessId, userId, input, 'MONEY_OUT', identity);
  }
  adjustment(
    businessId: string,
    userId: string,
    input: FinancialAdjustmentInput,
    identity?: MutationIdentity,
  ) {
    return this.repository.postTransaction(
      businessId,
      userId,
      input,
      input.direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      identity,
    );
  }
  listTransactions(businessId: string, query: Record<string, unknown>) {
    return this.repository.listTransactions(businessId, query);
  }
  findTransaction(businessId: string, id: string) {
    return this.repository.findTransaction(businessId, id);
  }
  statement(businessId: string, accountId: string, query: Record<string, unknown>) {
    return this.repository.statement(businessId, accountId, query);
  }
  createTransfer(
    businessId: string,
    userId: string,
    input: FinancialTransferInput,
    identity?: MutationIdentity,
  ) {
    return this.repository.createTransfer(businessId, userId, input, identity);
  }
  listTransfers(businessId: string, query: Record<string, unknown>) {
    return this.repository.listTransfers(businessId, query);
  }
  findTransfer(businessId: string, id: string) {
    return this.repository.findTransfer(businessId, id);
  }
}
