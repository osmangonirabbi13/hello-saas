import { Router } from 'express';
import { damageInputSchema, damageListSchema } from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { damageController } from './damage.controller.js';
export function createDamageRouter(a: AuthService, repo: AuthRepository) {
  const r = Router(),
    c = damageController();
  r.use(authenticate(a), resolveTenant(repo));
  r.get('/', requirePermission('damage.read'), validateQuery(damageListSchema), c.list);
  r.post('/', requirePermission('damage.create'), validateBody(damageInputSchema), c.create);
  r.get('/:id', requirePermission('damage.read'), c.find);
  r.patch('/:id', requirePermission('damage.update'), validateBody(damageInputSchema), c.update);
  r.post('/:id/post', requirePermission('damage.post'), c.post);
  r.delete('/:id', requirePermission('damage.delete_draft'), c.remove);
  return r;
}
