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
        user: {
          id: request.auth?.id,
          displayName: request.tenant?.userDisplayName,
        },
        business: {
          id: request.tenant?.businessId,
          name: request.tenant?.businessName,
          slug: request.tenant?.businessSlug,
          logoUrl: request.tenant?.businessLogoUrl ?? null,
        },
        membership: {
          id: request.tenant?.membershipId,
          role: request.tenant?.roleName,
          permissions: [...(request.tenant?.permissions ?? [])],
        },
      });
    },
  );
  return router;
}
