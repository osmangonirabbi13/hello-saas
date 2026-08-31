import { Router } from 'express';
import {
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  expenseInputSchema,
  expenseListSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { expenseController } from './expense.controller.js';
function secured(a: AuthService, repo: AuthRepository) {
  const r = Router();
  r.use(authenticate(a), resolveTenant(repo));
  return r;
}
export function createExpenseRouter(a: AuthService, repo: AuthRepository) {
  const r = secured(a, repo),
    c = expenseController();
  r.get('/', requirePermission('expense.read'), validateQuery(expenseListSchema), c.list);
  r.post('/', requirePermission('expense.create'), validateBody(expenseInputSchema), c.create);
  r.get('/:id', requirePermission('expense.read'), c.find);
  r.patch('/:id', requirePermission('expense.update'), validateBody(expenseInputSchema), c.update);
  r.post('/:id/post', requirePermission('expense.post'), c.post);
  r.delete('/:id', requirePermission('expense.delete_draft'), c.remove);
  return r;
}
export function createExpenseCategoryRouter(a: AuthService, repo: AuthRepository) {
  const r = secured(a, repo),
    c = expenseController();
  r.get('/', requirePermission('expense_category.read'), c.categories);
  r.post(
    '/',
    requirePermission('expense_category.manage'),
    validateBody(expenseCategoryCreateSchema),
    c.createCategory,
  );
  r.patch(
    '/:id',
    requirePermission('expense_category.manage'),
    validateBody(expenseCategoryUpdateSchema),
    c.updateCategory,
  );
  return r;
}
