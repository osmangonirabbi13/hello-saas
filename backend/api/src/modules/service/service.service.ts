import type { ServiceStatus } from '@hello-shop/database';
import type { ServiceCreateInput, ServiceUpdateInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { ServiceRepository } from './service.repository.js';
export class ServiceService {
  constructor(private readonly repo = new ServiceRepository()) {}
  create(b: string, u: string, i: ServiceCreateInput) {
    return this.repo.create(b, u, i);
  }
  list(b: string, q: Record<string, unknown>) {
    return this.repo.list(b, q);
  }
  assignees(b: string) {
    return this.repo.assignees(b);
  }
  async find(b: string, id: string) {
    const x = await this.repo.find(b, id);
    if (!x) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service job was not found.');
    return x;
  }
  update(b: string, id: string, u: string, i: ServiceUpdateInput) {
    return this.repo.update(b, id, u, i);
  }
  transition(b: string, id: string, u: string, s: ServiceStatus, n?: string | null) {
    return this.repo.transition(b, id, u, s, n);
  }
}
