import { Router } from 'express';
import {
  customerCreateSchema,
  customerListQuerySchema,
  customerUpdateSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { PartyRepository, PartyService, partyController } from '../party/party.js';
export function createCustomerRouter(auth: AuthService, repository: AuthRepository) {
  const router = Router(),
    controller = partyController(new PartyService('customer', new PartyRepository()));
  router.use(authenticate(auth), resolveTenant(repository));
  router.get(
    '/',
    requirePermission('customer.read'),
    validateQuery(customerListQuerySchema),
    controller.list,
  );
  router.post(
    '/',
    requirePermission('customer.create'),
    validateBody(customerCreateSchema),
    controller.create,
  );
  router.get('/:id', requirePermission('customer.read'), controller.find);
  router.patch(
    '/:id',
    requirePermission('customer.update'),
    validateBody(customerUpdateSchema),
    controller.update,
  );
  router.delete('/:id', requirePermission('customer.delete'), controller.remove);
  return router;
}
