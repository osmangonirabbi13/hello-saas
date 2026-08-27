import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
import type { AuthService } from '../modules/auth/auth.service.js';

export function authenticate(authService: AuthService): RequestHandler {
  return (request, _response, next) => {
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer '))
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    void authService
      .verifyAccessToken(authorization.slice(7))
      .then((claims) => {
        request.auth = { id: claims.userId, email: '', sessionId: claims.sessionId };
        next();
      })
      .catch(next);
  };
}
