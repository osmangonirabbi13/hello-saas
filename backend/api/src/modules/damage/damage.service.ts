import type { DamageInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { DamageRepository } from './damage.repository.js';
export class DamageService {
  constructor(private r = new DamageRepository()) {}
  list(b: string, q: Record<string, unknown>) {
    return this.r.list(b, q);
  }
  async find(b: string, id: string) {
    const x = await this.r.find(b, id);
    if (!x) throw new AppError(404, 'DAMAGE_NOT_FOUND', 'Damage was not found.');
    return x;
  }
  create(b: string, u: string, i: DamageInput) {
    return this.r.create(b, u, i);
  }
  update(b: string, id: string, u: string, i: DamageInput) {
    return this.r.update(b, id, u, i);
  }
  post(b: string, id: string, u: string) {
    return this.r.post(b, id, u);
  }
  remove(b: string, id: string, u: string) {
    return this.r.remove(b, id, u);
  }
}
