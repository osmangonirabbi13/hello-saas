import { Router } from 'express';
import type { AuthService } from './modules/auth/auth.service.js';
import type { AuthRepository } from './modules/auth/auth.types.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createBrandRouter } from './modules/brand/brand.routes.js';
import { createCategoryRouter } from './modules/category/category.routes.js';
import { createProductRouter } from './modules/product/product.routes.js';
import { createSubCategoryRouter } from './modules/subcategory/subcategory.routes.js';
import { createUnitRouter } from './modules/unit/unit.routes.js';
import { createCustomerRouter } from './modules/customer/customer.routes.js';
import { createSupplierRouter } from './modules/supplier/supplier.routes.js';
import {
  createInventoryRouter,
  createSerialRouter,
  createWarehouseRouter,
} from './modules/inventory/inventory.routes.js';
import { createPurchaseRouter } from './modules/purchase/purchase.routes.js';
import { createSaleRouter } from './modules/sale/sale.routes.js';

export function createApiRouter(dependencies: {
  authService: AuthService;
  authRepository: AuthRepository;
  cookieSecure: boolean;
}): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(dependencies.authService, dependencies.cookieSecure));
  router.use(
    '/dashboard',
    createDashboardRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use(
    '/categories',
    createCategoryRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use(
    '/sub-categories',
    createSubCategoryRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use('/brands', createBrandRouter(dependencies.authService, dependencies.authRepository));
  router.use('/units', createUnitRouter(dependencies.authService, dependencies.authRepository));
  router.use(
    '/products',
    createProductRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use(
    '/customers',
    createCustomerRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use(
    '/suppliers',
    createSupplierRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use(
    '/inventory',
    createInventoryRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use(
    '/warehouses',
    createWarehouseRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use('/serials', createSerialRouter(dependencies.authService, dependencies.authRepository));
  router.use(
    '/purchases',
    createPurchaseRouter(dependencies.authService, dependencies.authRepository),
  );
  router.use('/sales', createSaleRouter(dependencies.authService, dependencies.authRepository));
  return router;
}
