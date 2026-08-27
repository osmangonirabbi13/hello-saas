import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
import type { AuthRepository } from '../modules/auth/auth.types.js';

export function resolveTenant(repository: AuthRepository): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth)
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    void repository
      .resolveMembership(request.auth.sessionId, request.auth.id)
      .then((membership) => {
        if (!membership || membership.status !== 'ACTIVE' || !membership.businessActive) {
          return next(
            new AppError(403, 'INVALID_MEMBERSHIP', 'The active business membership is invalid.'),
          );
        }
        request.tenant = {
          businessId: membership.businessId,
          membershipId: membership.id,
          permissions: new Set(membership.permissions),
          businessName: membership.businessName,
          ...(membership.businessSlug ? { businessSlug: membership.businessSlug } : {}),
          ...(membership.businessLogoUrl !== undefined
            ? { businessLogoUrl: membership.businessLogoUrl }
            : {}),
          ...(membership.userDisplayName ? { userDisplayName: membership.userDisplayName } : {}),
          ...(membership.roleName ? { roleName: membership.roleName } : {}),
        };
        next();
      })
      .catch(next);
  };
}
