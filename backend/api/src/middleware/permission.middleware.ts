import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';

export function requirePermission(permission: string): RequestHandler {
  return (request, _response, next) => {
    if (!request.tenant)
      return next(new AppError(403, 'TENANT_REQUIRED', 'An active business is required.'));
    if (!request.tenant.permissions.has(permission))
      return next(
        new AppError(
          403,
          'PERMISSION_DENIED',
          'You do not have permission to perform this action.',
        ),
      );
    next();
  };
}
