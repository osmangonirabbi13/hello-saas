import { Router } from 'express';
import {
  purchaseCreateSchema,
  purchaseListQuerySchema,
  purchaseUpdateSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { InventoryRepository } from '../inventory/inventory.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { purchaseController } from './purchase.controller.js';
import { PurchaseRepository } from './purchase.repository.js';
import { PurchaseService } from './purchase.service.js';
export function createPurchaseRouter(auth: AuthService, authRepository: AuthRepository) {
  const router = Router(),
    controller = purchaseController(
      new PurchaseService(
        new PurchaseRepository(),
        new InventoryService(new InventoryRepository()),
      ),
    );
  router.use(authenticate(auth), resolveTenant(authRepository));
  router.get(
    '/',
    requirePermission('purchase.read'),
    validateQuery(purchaseListQuerySchema),
    controller.list,
  );
  router.post(
    '/',
    requirePermission('purchase.create'),
    validateBody(purchaseCreateSchema),
    controller.create,
  );
  router.get('/:id', requirePermission('purchase.read'), controller.find);
  router.patch(
    '/:id',
    requirePermission('purchase.update'),
    validateBody(purchaseUpdateSchema),
    controller.update,
  );
  router.post('/:id/post', requirePermission('purchase.post'), controller.post);
  router.delete('/:id', requirePermission('purchase.delete_draft'), controller.remove);
  return router;
}
