import { Router } from 'express';
import { success } from '../../lib/response.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';

export function createDashboardRouter(service: AuthService, repository: AuthRepository): Router {
  const router = Router();
  router.get(
    '/context',
    authenticate(service),
    resolveTenant(repository),
    requirePermission('dashboard.read'),
    (request, response) => {
      success(response, {
        businessId: request.tenant?.businessId,
        membershipId: request.tenant?.membershipId,
      });
    },
  );
  return router;
}
