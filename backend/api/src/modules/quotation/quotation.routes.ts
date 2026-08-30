import { Router } from 'express';
import {
  quotationCreateSchema,
  quotationListQuerySchema,
  transitionNoteSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { quotationController } from './quotation.controller.js';
import { QuotationService } from './quotation.service.js';
export function createQuotationRouter(auth: AuthService, repo: AuthRepository) {
  const r = Router(),
    c = quotationController(new QuotationService());
  r.use(authenticate(auth), resolveTenant(repo));
  r.get('/', requirePermission('quotation.read'), validateQuery(quotationListQuerySchema), c.list);
  r.post('/', requirePermission('quotation.create'), validateBody(quotationCreateSchema), c.create);
  r.get('/:id', requirePermission('quotation.read'), c.find);
  r.patch(
    '/:id',
    requirePermission('quotation.update'),
    validateBody(quotationCreateSchema),
    c.update,
  );
  r.delete('/:id', requirePermission('quotation.delete_draft'), c.remove);
  r.post(
    '/:id/send',
    requirePermission('quotation.send'),
    validateBody(transitionNoteSchema),
    c.transition('SENT'),
  );
  r.post(
    '/:id/accept',
    requirePermission('quotation.accept'),
    validateBody(transitionNoteSchema),
    c.transition('ACCEPTED'),
  );
  r.post(
    '/:id/reject',
    requirePermission('quotation.reject'),
    validateBody(transitionNoteSchema),
    c.transition('REJECTED'),
  );
  r.post(
    '/:id/cancel',
    requirePermission('quotation.update'),
    validateBody(transitionNoteSchema),
    c.transition('CANCELLED'),
  );
  r.post('/:id/convert-to-sale', requirePermission('quotation.convert'), c.convert);
  return r;
}
