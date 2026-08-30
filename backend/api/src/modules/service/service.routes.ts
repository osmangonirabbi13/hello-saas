import { Router } from 'express';
import {
  serviceCreateSchema,
  serviceListQuerySchema,
  serviceUpdateSchema,
  transitionNoteSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { serviceController } from './service.controller.js';
import { ServiceService } from './service.service.js';
export function createServiceRouter(auth: AuthService, repo: AuthRepository) {
  const r = Router(),
    c = serviceController(new ServiceService());
  r.use(authenticate(auth), resolveTenant(repo));
  r.get('/', requirePermission('service.read'), validateQuery(serviceListQuerySchema), c.list);
  r.post('/', requirePermission('service.create'), validateBody(serviceCreateSchema), c.create);
  r.get('/options/assignees', requirePermission('service.read'), c.assignees);
  r.get('/:id', requirePermission('service.read'), c.find);
  r.patch('/:id', requirePermission('service.update'), validateBody(serviceUpdateSchema), c.update);
  const a: [string, string, Parameters<typeof c.transition>[0]][] = [
    ['start-diagnosis', 'service.diagnose', 'DIAGNOSING'],
    ['request-approval', 'service.approve', 'WAITING_FOR_APPROVAL'],
    ['approve', 'service.approve', 'IN_PROGRESS'],
    ['start', 'service.work', 'IN_PROGRESS'],
    ['waiting-parts', 'service.work', 'WAITING_FOR_PARTS'],
    ['ready', 'service.ready', 'READY_FOR_DELIVERY'],
    ['deliver', 'service.deliver', 'DELIVERED'],
    ['cancel', 'service.cancel', 'CANCELLED'],
  ];
  a.forEach(([p, permission, status]) =>
    r.post(
      `/:id/${p}`,
      requirePermission(permission),
      validateBody(transitionNoteSchema),
      c.transition(status),
    ),
  );
  return r;
}
