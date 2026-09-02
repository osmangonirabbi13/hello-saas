import type { RequestHandler } from 'express';
import type {
  AccountingInitializeInput,
  ChartAccountCreateInput,
  ChartAccountUpdateInput,
  CreditApplicationInput,
  FiscalPeriodCreateInput,
  ManualJournalInput,
  SettlementInput,
} from '@hello-shop/validation';
import { success } from '../../lib/response.js';
import { AccountingService } from './accounting.service.js';

export const accountingController = (s = new AccountingService()) => ({
  initialize: ((q, r, n) => {
    void s
      .initialize(q.tenant!.businessId, q.auth!.id, q.body as AccountingInitializeInput)
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  listAccounts: ((q, r, n) => {
    void s
      .listAccounts(q.tenant!.businessId)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  findAccount: ((q, r, n) => {
    void s
      .findAccount(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  createAccount: ((q, r, n) => {
    void s
      .createAccount(q.tenant!.businessId, q.auth!.id, q.body as ChartAccountCreateInput)
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  updateAccount: ((q, r, n) => {
    void s
      .updateAccount(q.tenant!.businessId, String(q.params.id), q.body as ChartAccountUpdateInput)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  mapFinancialAccount: ((q, r, n) => {
    void s
      .mapFinancialAccount(
        q.tenant!.businessId,
        String(q.params.id),
        (q.body as { chartAccountId: string }).chartAccountId,
      )
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  mapExpenseCategory: ((q, r, n) => {
    void s
      .mapExpenseCategory(
        q.tenant!.businessId,
        String(q.params.id),
        (q.body as { chartAccountId: string }).chartAccountId,
      )
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  listJournals: ((q, r, n) => {
    void s
      .listJournals(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  findJournal: ((q, r, n) => {
    void s
      .findJournal(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  createJournal: ((q, r, n) => {
    void s
      .createJournal(q.tenant!.businessId, q.auth!.id, q.body as ManualJournalInput)
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  updateJournal: ((q, r, n) => {
    void s
      .updateJournal(q.tenant!.businessId, String(q.params.id), q.body as ManualJournalInput)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  postJournal: ((q, r, n) => {
    void s
      .postJournal(q.tenant!.businessId, String(q.params.id), q.auth!.id)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  reverseJournal: ((q, r, n) => {
    void s
      .reverseJournal(q.tenant!.businessId, String(q.params.id), q.auth!.id)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  listReceivables: ((q, r, n) => {
    void s
      .listReceivables(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  findReceivable: ((q, r, n) => {
    void s
      .findReceivable(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  receivePayment: ((q, r, n) => {
    void s
      .receivePayment(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        q.body as SettlementInput,
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  receivableStatement: ((q, r, n) => {
    void s
      .receivableStatement(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  listPayables: ((q, r, n) => {
    void s
      .listPayables(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  findPayable: ((q, r, n) => {
    void s
      .findPayable(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  paySupplier: ((q, r, n) => {
    void s
      .paySupplier(q.tenant!.businessId, String(q.params.id), q.auth!.id, q.body as SettlementInput)
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  payableStatement: ((q, r, n) => {
    void s
      .payableStatement(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  applyCustomerCredit: ((q, r, n) => {
    void s
      .applyPartyCredit(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        q.body as CreditApplicationInput,
        'CUSTOMER_CREDIT',
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  applySupplierCredit: ((q, r, n) => {
    void s
      .applyPartyCredit(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        q.body as CreditApplicationInput,
        'SUPPLIER_CREDIT',
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  listPeriods: ((q, r, n) => {
    void s
      .listPeriods(q.tenant!.businessId)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  createPeriod: ((q, r, n) => {
    void s
      .createPeriod(q.tenant!.businessId, q.body as FiscalPeriodCreateInput)
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  closePeriod: ((q, r, n) => {
    void s
      .closePeriod(q.tenant!.businessId, String(q.params.id), q.auth!.id)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  reopenPeriod: ((q, r, n) => {
    void s
      .reopenPeriod(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  trialBalance: ((q, r, n) => {
    void s
      .trialBalance(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  generalLedger: ((q, r, n) => {
    void s
      .generalLedger(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  profitLoss: ((q, r, n) => {
    void s
      .profitLoss(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
});
