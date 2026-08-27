import { Router } from 'express';
import {
  adjustmentCreateSchema,
  adjustmentListQuerySchema,
  movementListQuerySchema,
  serialListQuerySchema,
  stockListQuerySchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { inventoryController } from './inventory.controller.js';
import { InventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';
function secured(auth: AuthService, repository: AuthRepository) {
  const router = Router();
  router.use(authenticate(auth), resolveTenant(repository));
  return router;
}
export function createInventoryRouter(auth: AuthService, repository: AuthRepository) {
  const router = secured(auth, repository),
    controller = inventoryController(new InventoryService(new InventoryRepository()));
  router.get(
    '/stock',
    requirePermission('inventory.read'),
    validateQuery(stockListQuerySchema),
    controller.stock,
  );
  router.get('/stock/:productId', requirePermission('inventory.read'), controller.stockOne);
  router.get(
    '/movements',
    requirePermission('inventory.movement.read'),
    validateQuery(movementListQuerySchema),
    controller.movements,
  );
  router.get(
    '/adjustments',
    requirePermission('inventory.read'),
    validateQuery(adjustmentListQuerySchema),
    controller.adjustments,
  );
  router.post(
    '/adjustments',
    requirePermission('inventory.adjust'),
    validateBody(adjustmentCreateSchema),
    controller.createAdjustment,
  );
  router.get('/adjustments/:id', requirePermission('inventory.read'), controller.adjustment);
  router.get(
    '/low-stock',
    requirePermission('inventory.read'),
    validateQuery(stockListQuerySchema),
    controller.lowStock,
  );
  router.get(
    '/alerts',
    requirePermission('inventory.read'),
    validateQuery(stockListQuerySchema),
    controller.alerts,
  );
  return router;
}
export function createWarehouseRouter(auth: AuthService, repository: AuthRepository) {
  const router = secured(auth, repository),
    controller = inventoryController(new InventoryService(new InventoryRepository()));
  router.get('/', requirePermission('warehouse.read'), controller.warehouses);
  return router;
}
export function createSerialRouter(auth: AuthService, repository: AuthRepository) {
  const router = secured(auth, repository),
    controller = inventoryController(new InventoryService(new InventoryRepository()));
  router.get(
    '/',
    requirePermission('serial.read'),
    validateQuery(serialListQuerySchema),
    controller.serials,
  );
  router.get('/lookup', requirePermission('serial.read'), controller.lookupSerial);
  router.get('/:id', requirePermission('serial.read'), controller.serial);
  return router;
}
