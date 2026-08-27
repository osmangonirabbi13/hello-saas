import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, registrationSchema } from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import type { AuthService } from './auth.service.js';
import { authController } from './auth.controller.js';

export function createAuthRouter(service: AuthService, cookieSecure: boolean): Router {
  const router = Router();
  const controller = authController(service, cookieSecure);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  router.post('/register', loginLimiter, validateBody(registrationSchema), controller.register);
  router.post('/login', loginLimiter, validateBody(loginSchema), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', authenticate(service), controller.logout);
  return router;
}
