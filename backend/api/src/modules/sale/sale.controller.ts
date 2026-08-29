import type { RequestHandler } from 'express';
import { success } from '../../lib/response.js';
import type { SaleService } from './sale.service.js';
import type { SaleInput } from './sale.types.js';
import { expectedVersion, mutationIdentity } from '../sync/mutation-idempotency.js';

export function saleController(service: SaleService) {
  const list: RequestHandler = (req, res, next) => {
    void service
      .list(req.tenant!.businessId, req.query)
      .then((data) => success(res, data))
      .catch(next);
  };
  const createFor =
    (type: SaleInput['type']): RequestHandler =>
    (req, res, next) => {
      const input = { ...(req.body as SaleInput), type };
      void service
        .create(req.tenant!.businessId, req.auth!.id, input, mutationIdentity(req.headers['idempotency-key'], `SALE_DRAFT_${type}_CREATE`))
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
      .update(req.tenant!.businessId, String(req.params.id), req.body as SaleInput, expectedVersion(req.headers['if-match']))
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
  return {
    list,
    createRegular: createFor('REGULAR'),
    createVat: createFor('VAT'),
    createPos: createFor('POS'),
    find,
    update,
    post,
    remove,
  };
}
