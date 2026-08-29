import type { RequestHandler } from 'express';
import { success } from '../../lib/response.js';
import type { PurchaseService } from './purchase.service.js';
import type { PurchaseInput } from './purchase.types.js';
import { expectedVersion, mutationIdentity } from '../sync/mutation-idempotency.js';
export function purchaseController(service: PurchaseService) {
  const list: RequestHandler = (req, res, next) => {
    void service
      .list(req.tenant!.businessId, req.query)
      .then((data) => success(res, data))
      .catch(next);
  };
  const create: RequestHandler = (req, res, next) => {
    void service
      .create(req.tenant!.businessId, req.auth!.id, req.body as PurchaseInput, mutationIdentity(req.headers['idempotency-key'], 'PURCHASE_DRAFT_CREATE'))
      .then((data) => success(res, data, 201))
      .catch(next);
  };
  const find: RequestHandler = (req, res, next) => {
    void service
      .find(req.tenant!.businessId, String(req.params.id))
      .then((data) => success(res, data))
      .catch(next);
  };
  const update: RequestHandler = (req, res, next) => {
    void service
      .update(req.tenant!.businessId, String(req.params.id), req.body as PurchaseInput, expectedVersion(req.headers['if-match']))
      .then((data) => success(res, data))
      .catch(next);
  };
  const post: RequestHandler = (req, res, next) => {
    void service
      .post(req.tenant!.businessId, String(req.params.id), req.auth!.id)
      .then((data) => success(res, data))
      .catch(next);
  };
  const remove: RequestHandler = (req, res, next) => {
    void service
      .deleteDraft(req.tenant!.businessId, String(req.params.id), req.auth!.id)
      .then((data) => success(res, data))
      .catch(next);
  };
  return { list, create, find, update, post, remove };
}
