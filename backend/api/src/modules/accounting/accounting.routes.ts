import { Router } from 'express';
import {
  accountingInitializeSchema,
  accountingListSchema,
  chartAccountCreateSchema,
  chartAccountUpdateSchema,
  creditApplicationSchema,
  expenseCategoryMappingSchema,
  financialAccountMappingSchema,
  fiscalPeriodCreateSchema,
  manualJournalSchema,
  settlementSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { accountingController } from './accounting.controller.js';

export function createAccountingRouter(auth: AuthService, repository: AuthRepository) {
  const r = Router(),
    c = accountingController();
  r.use(authenticate(auth), resolveTenant(repository));
  r.post(
    '/initialize',
    requirePermission('accounting.initialize'),
    validateBody(accountingInitializeSchema),
    c.initialize,
  );
  r.get('/accounts', requirePermission('coa.read'), c.listAccounts);
  r.post(
    '/accounts',
    requirePermission('coa.manage'),
    validateBody(chartAccountCreateSchema),
    c.createAccount,
  );
  r.get('/accounts/:id', requirePermission('coa.read'), c.findAccount);
  r.patch(
    '/accounts/:id',
    requirePermission('coa.manage'),
    validateBody(chartAccountUpdateSchema),
    c.updateAccount,
  );
  r.patch(
    '/mappings/financial-accounts/:id',
    requirePermission('coa.manage'),
    validateBody(financialAccountMappingSchema),
    c.mapFinancialAccount,
  );
  r.patch(
    '/mappings/expense-categories/:id',
    requirePermission('coa.manage'),
    validateBody(expenseCategoryMappingSchema),
    c.mapExpenseCategory,
  );
  r.get(
    '/journals',
    requirePermission('journal.read'),
    validateQuery(accountingListSchema),
    c.listJournals,
  );
  r.post(
    '/journals',
    requirePermission('journal.create_manual'),
    validateBody(manualJournalSchema),
    c.createJournal,
  );
  r.get('/journals/:id', requirePermission('journal.read'), c.findJournal);
  r.patch(
    '/journals/:id',
    requirePermission('journal.create_manual'),
    validateBody(manualJournalSchema),
    c.updateJournal,
  );
  r.post('/journals/:id/post', requirePermission('journal.post'), c.postJournal);
  r.post('/journals/:id/reverse', requirePermission('journal.reverse'), c.reverseJournal);
  r.get(
    '/receivables',
    requirePermission('receivable.read'),
    validateQuery(accountingListSchema),
    c.listReceivables,
  );
  r.get('/receivables/:id', requirePermission('receivable.read'), c.findReceivable);
  r.get('/receivables/:id/statement', requirePermission('receivable.read'), c.receivableStatement);
  r.post(
    '/receivables/:id/receive-payment',
    requirePermission('receivable.receive_payment'),
    validateBody(settlementSchema),
    c.receivePayment,
  );
  r.get(
    '/payables',
    requirePermission('payable.read'),
    validateQuery(accountingListSchema),
    c.listPayables,
  );
  r.get('/payables/:id', requirePermission('payable.read'), c.findPayable);
  r.get('/payables/:id/statement', requirePermission('payable.read'), c.payableStatement);
  r.post(
    '/payables/:id/pay',
    requirePermission('payable.make_payment'),
    validateBody(settlementSchema),
    c.paySupplier,
  );
  r.post(
    '/customer-credits/:id/apply',
    requirePermission('receivable.receive_payment'),
    validateBody(creditApplicationSchema),
    c.applyCustomerCredit,
  );
  r.post(
    '/supplier-credits/:id/apply',
    requirePermission('payable.make_payment'),
    validateBody(creditApplicationSchema),
    c.applySupplierCredit,
  );
  r.get(
    '/reports/trial-balance',
    requirePermission('accounting_report.trial_balance'),
    validateQuery(accountingListSchema),
    c.trialBalance,
  );
  r.get(
    '/reports/general-ledger',
    requirePermission('accounting_report.general_ledger'),
    validateQuery(accountingListSchema),
    c.generalLedger,
  );
  r.get(
    '/reports/profit-loss',
    requirePermission('accounting_report.pnl'),
    validateQuery(accountingListSchema),
    c.profitLoss,
  );
  r.get('/fiscal-periods', requirePermission('fiscal_period.read'), c.listPeriods);
  r.post(
    '/fiscal-periods',
    requirePermission('fiscal_period.manage'),
    validateBody(fiscalPeriodCreateSchema),
    c.createPeriod,
  );
  r.post('/fiscal-periods/:id/close', requirePermission('fiscal_period.close'), c.closePeriod);
  r.post('/fiscal-periods/:id/reopen', requirePermission('fiscal_period.manage'), c.reopenPeriod);
  return r;
}
