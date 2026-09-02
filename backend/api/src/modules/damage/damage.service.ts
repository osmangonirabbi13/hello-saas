import type { DamageInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { DamageRepository } from './damage.repository.js';
import { Prisma } from '@hello-shop/database';
import { ApprovalRepository } from '../team-security/approval.repository.js';
import { approvalRequiredError } from '../team-security/approval-error.js';
export class DamageService {
  constructor(private r = new DamageRepository(), private approvals = new ApprovalRepository()) {}
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
  async post(b: string, id: string, u: string) {
    const source = await this.find(b, id);
    const payload = { totalDamageValue: source.totalDamageValue.toString(), warehouseId: source.warehouseId, damageDate: source.damageDate.toISOString() };
    const gate = await this.approvals.evaluateAndRequest(b, u, { actionType: 'DAMAGE_POST', sourceType: 'Damage', sourceId: id, sourceVersion: source.version, value: new Prisma.Decimal(source.totalDamageValue), reason: 'Damage posting meets the configured approval policy.', payload });
    if (gate.approvalRequired) throw approvalRequiredError(gate.request);
    if ('approvedRequest' in gate) return this.approvals.execute(b, gate.approvedRequest.id, source.version, payload, u, () => this.r.post(b, id, u));
    return this.r.post(b, id, u);
  }
  remove(b: string, id: string, u: string) {
    return this.r.remove(b, id, u);
  }
}
