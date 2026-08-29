import { Router } from 'express';
import { saleCreateSchema, saleListQuerySchema, saleUpdateSchema } from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { InventoryRepository } from '../inventory/inventory.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { saleController } from './sale.controller.js';
import { SaleRepository } from './sale.repository.js';
import { SaleService } from './sale.service.js';

export function createSaleRouter(auth: AuthService, authRepository: AuthRepository) {
  const router = Router();
  const controller = saleController(
    new SaleService(new SaleRepository(), new InventoryService(new InventoryRepository())),
  );
  router.use(authenticate(auth), resolveTenant(authRepository));
  router.get(
    '/',
    requirePermission('sale.read'),
    validateQuery(saleListQuerySchema),
    controller.list,
  );
  router.post(
    '/',
    requirePermission('sale.create'),
    validateBody(saleCreateSchema),
    controller.createRegular,
  );
  router.post(
    '/vat',
    requirePermission('sale.vat.create'),
    validateBody(saleCreateSchema),
    controller.createVat,
  );
  router.post(
    '/pos',
    requirePermission('pos.use'),
    validateBody(saleCreateSchema),
    controller.createPos,
  );
  router.get('/:id/invoice', requirePermission('sale.read'), controller.invoice);
  router.get('/:id', requirePermission('sale.read'), controller.find);
  router.patch(
    '/:id',
    requirePermission('sale.update'),
    validateBody(saleUpdateSchema),
    controller.update,
  );
  router.post('/:id/post', requirePermission('sale.post'), controller.post);
  router.delete('/:id', requirePermission('sale.delete_draft'), controller.remove);
  return router;
}
