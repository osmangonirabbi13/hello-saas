import type { RequestHandler } from 'express';
import type {
  ExpenseCategoryCreateInput,
  ExpenseCategoryUpdateInput,
  ExpenseInput,
} from '@hello-shop/validation';
import { success } from '../../lib/response.js';
import { ExpenseService } from './expense.service.js';
export const expenseController = (s = new ExpenseService()) => ({
  categories: ((q, r, n) => {
    void s
      .categories(q.tenant!.businessId)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  createCategory: ((q, r, n) => {
    void s
      .createCategory(q.tenant!.businessId, q.auth!.id, q.body as ExpenseCategoryCreateInput)
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  updateCategory: ((q, r, n) => {
    void s
      .updateCategory(
        q.tenant!.businessId,
        String(q.params.id),
        q.body as ExpenseCategoryUpdateInput,
      )
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  list: ((q, r, n) => {
    void s
      .list(q.tenant!.businessId, q.query)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  find: ((q, r, n) => {
    void s
      .find(q.tenant!.businessId, String(q.params.id))
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  create: ((q, r, n) => {
    void s
      .create(q.tenant!.businessId, q.auth!.id, q.body as ExpenseInput)
      .then((x) => success(r, x, 201))
      .catch(n);
  }) as RequestHandler,
  update: ((q, r, n) => {
    void s
      .update(q.tenant!.businessId, String(q.params.id), q.auth!.id, q.body as ExpenseInput)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  post: ((q, r, n) => {
    void s
      .post(q.tenant!.businessId, String(q.params.id), q.auth!.id)
      .then((x) => success(r, x))
      .catch(n);
  }) as RequestHandler,
  remove: ((q, r, n) => {
    void s
      .remove(q.tenant!.businessId, String(q.params.id), q.auth!.id)
      .then(() => success(r, { deleted: true }))
      .catch(n);
  }) as RequestHandler,
});
