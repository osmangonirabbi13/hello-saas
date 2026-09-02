import type {
  ExpenseCategoryCreateInput,
  ExpenseCategoryUpdateInput,
  ExpenseInput,
} from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { ExpenseRepository } from './expense.repository.js';
import { Prisma } from '@hello-shop/database';
import { ApprovalRepository } from '../team-security/approval.repository.js';
import { approvalRequiredError } from '../team-security/approval-error.js';
export class ExpenseService {
  constructor(private r = new ExpenseRepository(), private approvals = new ApprovalRepository()) {}
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
  async post(b: string, id: string, u: string) {
    const source = await this.find(b, id);
    const payload = { amount: source.amount.toString(), categoryId: source.categoryId, expenseDate: source.expenseDate.toISOString() };
    const gate = await this.approvals.evaluateAndRequest(b, u, { actionType: 'EXPENSE_POST', sourceType: 'Expense', sourceId: id, sourceVersion: source.version, value: new Prisma.Decimal(source.amount), reason: 'Expense posting meets the configured approval policy.', payload });
    if (gate.approvalRequired) throw approvalRequiredError(gate.request);
    if ('approvedRequest' in gate) return this.approvals.execute(b, gate.approvedRequest.id, source.version, payload, u, () => this.r.post(b, id, u));
    return this.r.post(b, id, u);
  }
  remove(b: string, id: string, u: string) {
    return this.r.remove(b, id, u);
  }
}
