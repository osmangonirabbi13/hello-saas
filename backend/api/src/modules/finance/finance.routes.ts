import { Router } from 'express';
import {
  financialAccountCreateSchema,
  financialAccountListSchema,
  financialAccountUpdateSchema,
  financialAdjustmentSchema,
  financialStatementSchema,
  financialTransactionCreateSchema,
  financialTransactionListSchema,
  financialTransferListSchema,
  financialTransferSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { financeController } from './finance.controller.js';

function secured(auth: AuthService, repository: AuthRepository) {
  const router = Router();
  router.use(authenticate(auth), resolveTenant(repository));
  return router;
}
export function createFinancialAccountRouter(auth: AuthService, repository: AuthRepository) {
  const router = secured(auth, repository),
    controller = financeController();
  router.get(
    '/',
    requirePermission('financial_account.read'),
    validateQuery(financialAccountListSchema),
    controller.listAccounts,
  );
  router.post(
    '/',
    requirePermission('financial_account.create'),
    validateBody(financialAccountCreateSchema),
    controller.createAccount,
  );
  router.get(
    '/:id/statement',
    requirePermission('financial_transaction.read'),
    validateQuery(financialStatementSchema),
    controller.statement,
  );
  router.get('/:id', requirePermission('financial_account.read'), controller.findAccount);
  router.patch(
    '/:id',
    requirePermission('financial_account.update'),
    validateBody(financialAccountUpdateSchema),
    controller.updateAccount,
  );
  router.post(
    '/:id/disable',
    requirePermission('financial_account.disable'),
    controller.disableAccount,
  );
  router.post(
    '/:id/enable',
    requirePermission('financial_account.update'),
    controller.enableAccount,
  );
  return router;
}
export function createFinancialTransactionRouter(auth: AuthService, repository: AuthRepository) {
  const router = secured(auth, repository),
    controller = financeController();
  router.get(
    '/',
    requirePermission('financial_transaction.read'),
    validateQuery(financialTransactionListSchema),
    controller.listTransactions,
  );
  router.post(
    '/money-in',
    requirePermission('financial_transaction.create'),
    validateBody(financialTransactionCreateSchema),
    controller.moneyIn,
  );
  router.post(
    '/money-out',
    requirePermission('financial_transaction.create'),
    validateBody(financialTransactionCreateSchema),
    controller.moneyOut,
  );
  router.post(
    '/adjustment',
    requirePermission('financial.adjust'),
    validateBody(financialAdjustmentSchema),
    controller.adjustment,
  );
  router.get('/:id', requirePermission('financial_transaction.read'), controller.findTransaction);
  return router;
}
export function createFinancialTransferRouter(auth: AuthService, repository: AuthRepository) {
  const router = secured(auth, repository),
    controller = financeController();
  router.get(
    '/',
    requirePermission('financial_transfer.read'),
    validateQuery(financialTransferListSchema),
    controller.listTransfers,
  );
  router.post(
    '/',
    requirePermission('financial_transfer.create'),
    validateBody(financialTransferSchema),
    controller.createTransfer,
  );
  router.get('/:id', requirePermission('financial_transfer.read'), controller.findTransfer);
  return router;
}
