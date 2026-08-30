import { Router } from 'express';
import {
  rmaCreateSchema,
  rmaListQuerySchema,
  rmaTransitionSchema,
  rmaUpdateSchema,
  warrantyLookupQuerySchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { rmaController } from './rma.controller.js';
import { RmaService } from './rma.service.js';
export function createPublicRmaRouter() {
  const r = Router(),
    c = rmaController(new RmaService());
  r.get('/:token', c.track);
  return r;
}
export function createRmaRouter(auth: AuthService, repository: AuthRepository) {
  const r = Router(),
    c = rmaController(new RmaService());
  r.use(authenticate(auth), resolveTenant(repository));
  r.get(
    '/warranty/lookup',
    requirePermission('warranty.check'),
    validateQuery(warrantyLookupQuerySchema),
    c.eligibility,
  );
  r.get('/serials/:id/history', requirePermission('warranty.read'), c.history);
  r.get('/', requirePermission('rma.read'), validateQuery(rmaListQuerySchema), c.list);
  r.post('/', requirePermission('rma.create'), validateBody(rmaCreateSchema), c.create);
  r.get('/:id', requirePermission('rma.read'), c.find);
  r.patch('/:id', requirePermission('rma.update'), validateBody(rmaUpdateSchema), c.update);
  const routes: [string, string, Parameters<typeof c.transition>[0]][] = [
    ['inspect', 'rma.inspect', 'INSPECTING'],
    ['approve', 'rma.inspect', 'APPROVED'],
    ['reject', 'rma.inspect', 'REJECTED'],
    ['send-supplier', 'rma.send_supplier', 'SENT_TO_SUPPLIER'],
    ['supplier-processing', 'rma.send_supplier', 'SUPPLIER_PROCESSING'],
    ['receive-supplier', 'rma.receive_supplier', 'SUPPLIER_RETURNED'],
    ['ready', 'rma.ready', 'READY_FOR_CUSTOMER'],
    ['deliver', 'rma.deliver', 'DELIVERED'],
    ['cancel', 'rma.cancel', 'CANCELLED'],
  ];
  routes.forEach(([path, permission, status]) =>
    r.post(
      `/:id/${path}`,
      requirePermission(permission),
      validateBody(rmaTransitionSchema),
      c.transition(status),
    ),
  );
  return r;
}
