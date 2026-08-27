import { Router } from 'express';
import {
  supplierCreateSchema,
  supplierListQuerySchema,
  supplierUpdateSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { PartyRepository, PartyService, partyController } from '../party/party.js';
export function createSupplierRouter(auth: AuthService, repository: AuthRepository) {
  const router = Router(),
    controller = partyController(new PartyService('supplier', new PartyRepository()));
  router.use(authenticate(auth), resolveTenant(repository));
  router.get(
    '/',
    requirePermission('supplier.read'),
    validateQuery(supplierListQuerySchema),
    controller.list,
  );
  router.post(
    '/',
    requirePermission('supplier.create'),
    validateBody(supplierCreateSchema),
    controller.create,
  );
  router.get('/:id', requirePermission('supplier.read'), controller.find);
  router.patch(
    '/:id',
    requirePermission('supplier.update'),
    validateBody(supplierUpdateSchema),
    controller.update,
  );
  router.delete('/:id', requirePermission('supplier.delete'), controller.remove);
  return router;
}
