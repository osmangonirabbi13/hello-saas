import type { RmaStatus } from '@hello-shop/database';
import type { RmaCreateInput, RmaUpdateInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { RmaRepository } from './rma.repository.js';
export class RmaService {
  constructor(private readonly repository = new RmaRepository()) {}
  eligibility(b: string, q: { serial?: string; saleLineId?: string }) {
    return this.repository.eligibility(b, q);
  }
  list(b: string, q: Parameters<RmaRepository['list']>[1]) {
    return this.repository.list(b, q);
  }
  async find(b: string, id: string) {
    const item = await this.repository.find(b, id);
    if (!item) throw new AppError(404, 'RMA_NOT_FOUND', 'RMA was not found.');
    return item;
  }
  create(b: string, u: string, i: RmaCreateInput) {
    return this.repository.create(b, u, i);
  }
  update(b: string, id: string, u: string, i: RmaUpdateInput) {
    return this.repository.update(b, id, u, i);
  }
  transition(b: string, id: string, u: string, s: RmaStatus, n?: string | null) {
    return this.repository.transition(b, id, u, s, n);
  }
  publicTrack(token: string) {
    return this.repository.publicTrack(token);
  }
  serialHistory(b: string, id: string) {
    return this.repository.serialHistory(b, id);
  }
}
