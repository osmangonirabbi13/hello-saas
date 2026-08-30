import type { QuotationStatus } from '@hello-shop/database';
import type { QuotationInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { QuotationRepository } from './quotation.repository.js';
export class QuotationService {
  constructor(private readonly r = new QuotationRepository()) {}
  create(b: string, u: string, i: QuotationInput) {
    return this.r.create(b, u, i);
  }
  list(b: string, q: Record<string, unknown>) {
    return this.r.list(b, q);
  }
  async find(b: string, id: string) {
    const x = await this.r.find(b, id);
    if (!x) throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation was not found.');
    return x;
  }
  update(b: string, id: string, u: string, i: QuotationInput) {
    return this.r.update(b, id, u, i);
  }
  transition(b: string, id: string, u: string, s: QuotationStatus, n?: string | null) {
    return this.r.transition(b, id, u, s, n);
  }
  remove(b: string, id: string, u: string) {
    return this.r.remove(b, id, u);
  }
  convert(b: string, id: string, u: string) {
    return this.r.convert(b, id, u);
  }
}
