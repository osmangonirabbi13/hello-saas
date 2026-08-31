import type {
  ExpenseCategoryCreateInput,
  ExpenseCategoryUpdateInput,
  ExpenseInput,
} from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { ExpenseRepository } from './expense.repository.js';
export class ExpenseService {
  constructor(private r = new ExpenseRepository()) {}
  categories(b: string) {
    return this.r.categories(b);
  }
  createCategory(b: string, u: string, i: ExpenseCategoryCreateInput) {
    return this.r.createCategory(b, u, i);
  }
  updateCategory(b: string, id: string, i: ExpenseCategoryUpdateInput) {
    return this.r.updateCategory(b, id, i);
  }
  list(b: string, q: Record<string, unknown>) {
    return this.r.list(b, q);
  }
  async find(b: string, id: string) {
    const x = await this.r.find(b, id);
    if (!x) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense was not found.');
    return x;
  }
  create(b: string, u: string, i: ExpenseInput) {
    return this.r.create(b, u, i);
  }
  update(b: string, id: string, u: string, i: ExpenseInput) {
    return this.r.update(b, id, u, i);
  }
  post(b: string, id: string, u: string) {
    return this.r.post(b, id, u);
  }
  remove(b: string, id: string, u: string) {
    return this.r.remove(b, id, u);
  }
}
