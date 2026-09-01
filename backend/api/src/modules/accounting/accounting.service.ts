import type {
  AccountingInitializeInput,
  ChartAccountCreateInput,
  ChartAccountUpdateInput,
  CreditApplicationInput,
  FiscalPeriodCreateInput,
  ManualJournalInput,
  SettlementInput,
} from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { AccountingRepository } from './accounting.repository.js';

export class AccountingService {
  constructor(private readonly repository = new AccountingRepository()) {}
  initialize(b: string, u: string, i: AccountingInitializeInput) {
    return this.repository.initialize(b, u, i);
  }
  listAccounts(b: string) {
    return this.repository.listAccounts(b);
  }
  async findAccount(b: string, id: string) {
    const x = await this.repository.findAccount(b, id);
    if (!x) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account was not found.');
    return x;
  }
  createAccount(b: string, u: string, i: ChartAccountCreateInput) {
    return this.repository.createAccount(b, u, i);
  }
  updateAccount(b: string, id: string, i: ChartAccountUpdateInput) {
    return this.repository.updateAccount(b, id, i);
  }
  mapFinancialAccount(b: string, id: string, chartAccountId: string) {
    return this.repository.mapFinancialAccount(b, id, chartAccountId);
  }
  mapExpenseCategory(b: string, id: string, chartAccountId: string) {
    return this.repository.mapExpenseCategory(b, id, chartAccountId);
  }
  listJournals(b: string, q: Record<string, unknown>) {
    return this.repository.listJournals(b, q);
  }
  async findJournal(b: string, id: string) {
    const x = await this.repository.findJournal(b, id);
    if (!x) throw new AppError(404, 'JOURNAL_NOT_FOUND', 'Journal was not found.');
    return x;
  }
  createJournal(b: string, u: string, i: ManualJournalInput) {
    return this.repository.createManualJournal(b, u, i);
  }
  updateJournal(b: string, id: string, i: ManualJournalInput) {
    return this.repository.updateManualJournal(b, id, i);
  }
  postJournal(b: string, id: string, u: string) {
    return this.repository.postJournal(b, id, u);
  }
  reverseJournal(b: string, id: string, u: string) {
    return this.repository.reverseJournal(b, id, u);
  }
  listReceivables(b: string, q: Record<string, unknown>) {
    return this.repository.listReceivables(b, q);
  }
  async findReceivable(b: string, id: string) {
    const x = await this.repository.findReceivable(b, id);
    if (!x) throw new AppError(404, 'RECEIVABLE_NOT_FOUND', 'Receivable was not found.');
    return x;
  }
  receivePayment(b: string, id: string, u: string, i: SettlementInput) {
    return this.repository.receivePayment(b, id, u, i);
  }
  async receivableStatement(b: string, id: string) {
    const x = await this.repository.receivableStatement(b, id);
    if (!x) throw new AppError(404, 'RECEIVABLE_NOT_FOUND', 'Receivable was not found.');
    return x;
  }
  listPayables(b: string, q: Record<string, unknown>) {
    return this.repository.listPayables(b, q);
  }
  async findPayable(b: string, id: string) {
    const x = await this.repository.findPayable(b, id);
    if (!x) throw new AppError(404, 'PAYABLE_NOT_FOUND', 'Payable was not found.');
    return x;
  }
  paySupplier(b: string, id: string, u: string, i: SettlementInput) {
    return this.repository.paySupplier(b, id, u, i);
  }
  async payableStatement(b: string, id: string) {
    const x = await this.repository.payableStatement(b, id);
    if (!x) throw new AppError(404, 'PAYABLE_NOT_FOUND', 'Payable was not found.');
    return x;
  }
  applyPartyCredit(
    b: string,
    id: string,
    u: string,
    i: CreditApplicationInput,
    kind: 'CUSTOMER_CREDIT' | 'SUPPLIER_CREDIT',
  ) {
    return this.repository.applyPartyCredit(b, id, u, i, kind);
  }
  listPeriods(b: string) {
    return this.repository.listPeriods(b);
  }
  createPeriod(b: string, i: FiscalPeriodCreateInput) {
    return this.repository.createPeriod(b, i);
  }
  closePeriod(b: string, id: string) {
    return this.repository.setPeriodStatus(b, id, 'CLOSED');
  }
  reopenPeriod(b: string, id: string) {
    return this.repository.setPeriodStatus(b, id, 'OPEN');
  }
  trialBalance(b: string, q: Record<string, unknown>) {
    return this.repository.trialBalance(b, q);
  }
  generalLedger(b: string, q: Record<string, unknown>) {
    return this.repository.generalLedger(b, q);
  }
  profitLoss(b: string, q: Record<string, unknown>) {
    return this.repository.profitLoss(b, q);
  }
}
