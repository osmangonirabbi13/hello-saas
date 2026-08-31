import type { Request, RequestHandler } from 'express';
import type {
  FinancialAccountCreateInput,
  FinancialAccountUpdateInput,
  FinancialAdjustmentInput,
  FinancialTransactionCreateInput,
  FinancialTransferInput,
} from '@hello-shop/validation';
import { success } from '../../lib/response.js';
import { mutationIdentity } from '../sync/mutation-idempotency.js';
import { FinanceService } from './finance.service.js';

const identity = (request: Request, scope: string) =>
  mutationIdentity(request.headers['idempotency-key'], scope);
export const financeController = (service = new FinanceService()) => ({
  listAccounts: ((q, r, n) => {
    void service
      .listAccounts(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  findAccount: ((q, r, n) => {
    void service
      .findAccount(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  createAccount: ((q, r, n) => {
    void service
      .createAccount(
        q.tenant!.businessId,
        q.auth!.id,
        q.body as FinancialAccountCreateInput,
        identity(q, 'finance.account.create'),
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  updateAccount: ((q, r, n) => {
    void service
      .updateAccount(
        q.tenant!.businessId,
        String(q.params.id),
        q.auth!.id,
        q.body as FinancialAccountUpdateInput,
      )
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  disableAccount: ((q, r, n) => {
    void service
      .disableAccount(q.tenant!.businessId, String(q.params.id), q.auth!.id)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  enableAccount: ((q, r, n) => {
    void service
      .enableAccount(q.tenant!.businessId, String(q.params.id), q.auth!.id)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  listTransactions: ((q, r, n) => {
    void service
      .listTransactions(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  findTransaction: ((q, r, n) => {
    void service
      .findTransaction(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  moneyIn: ((q, r, n) => {
    void service
      .moneyIn(
        q.tenant!.businessId,
        q.auth!.id,
        q.body as FinancialTransactionCreateInput,
        identity(q, 'finance.money_in'),
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  moneyOut: ((q, r, n) => {
    void service
      .moneyOut(
        q.tenant!.businessId,
        q.auth!.id,
        q.body as FinancialTransactionCreateInput,
        identity(q, 'finance.money_out'),
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  adjustment: ((q, r, n) => {
    void service
      .adjustment(
        q.tenant!.businessId,
        q.auth!.id,
        q.body as FinancialAdjustmentInput,
        identity(q, 'finance.adjustment'),
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  statement: ((q, r, n) => {
    void service
      .statement(q.tenant!.businessId, String(q.params.id), q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  listTransfers: ((q, r, n) => {
    void service
      .listTransfers(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  findTransfer: ((q, r, n) => {
    void service
      .findTransfer(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  createTransfer: ((q, r, n) => {
    void service
      .createTransfer(
        q.tenant!.businessId,
        q.auth!.id,
        q.body as FinancialTransferInput,
        identity(q, 'finance.transfer'),
      )
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
});
