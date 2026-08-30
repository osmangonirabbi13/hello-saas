import { Router } from 'express';
import { purchaseReturnSchema, saleReturnSchema } from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { returnController } from './return.controller.js';
import { ReturnService } from './return.service.js';
export function createReturnRouter(
  auth: AuthService,
  authRepository: AuthRepository,
  kind: 'PURCHASE' | 'SALE',
) {
  const router = Router();
  const prefix = kind === 'PURCHASE' ? 'purchase_return' : 'sale_return';
  const controller = returnController(new ReturnService(), kind);
  router.use(authenticate(auth), resolveTenant(authRepository));
  router.get('/', requirePermission(prefix + '.read'), controller.list);
  router.post(
    '/',
    requirePermission(prefix + '.create'),
    validateBody(kind === 'PURCHASE' ? purchaseReturnSchema : saleReturnSchema),
    controller.create,
  );
  router.get('/source/:id/returnable', requirePermission(prefix + '.read'), (req, res, next) => {
    const service = new ReturnService();
    void (
      kind === 'PURCHASE'
        ? service.purchaseReturnable(req.tenant!.businessId, String(req.params.id))
        : service.saleReturnable(req.tenant!.businessId, String(req.params.id))
    )
      .then((data) => res.json({ data }))
      .catch(next);
  });
  router.get('/:id', requirePermission(prefix + '.read'), controller.find);
  router.patch(
    '/:id',
    requirePermission(prefix + '.update'),
    validateBody(kind === 'PURCHASE' ? purchaseReturnSchema : saleReturnSchema),
    controller.update,
  );
  router.post('/:id/post', requirePermission(prefix + '.post'), controller.post);
  router.delete('/:id', requirePermission(prefix + '.delete_draft'), controller.remove);
  return router;
}
