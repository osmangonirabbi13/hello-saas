import type { RequestHandler } from 'express';
import type { PurchaseReturnInput, SaleReturnInput } from '@hello-shop/validation';
import { success } from '../../lib/response.js';
import type { ReturnService } from './return.service.js';
export function returnController(service: ReturnService, kind: 'PURCHASE' | 'SALE') {
  const list: RequestHandler = (req, res, next) => {
    void (
      kind === 'PURCHASE'
        ? service.listPurchase(req.tenant!.businessId)
        : service.listSale(req.tenant!.businessId)
    )
      .then((d) => success(res, d))
      .catch(next);
  };
  const create: RequestHandler = (req, res, next) => {
    void (
      kind === 'PURCHASE'
        ? service.createPurchase(
            req.tenant!.businessId,
            req.auth!.id,
            req.body as PurchaseReturnInput,
          )
        : service.createSale(req.tenant!.businessId, req.auth!.id, req.body as SaleReturnInput)
    )
      .then((d) => success(res, d, 201))
      .catch(next);
  };
  const find: RequestHandler = (req, res, next) => {
    void (
      kind === 'PURCHASE'
        ? service.findPurchase(req.tenant!.businessId, String(req.params.id))
        : service.findSale(req.tenant!.businessId, String(req.params.id))
    )
      .then((d) => success(res, d))
      .catch(next);
  };
  const update: RequestHandler = (req, res, next) => {
    void (
      kind === 'PURCHASE'
        ? service.updatePurchase(
            req.tenant!.businessId,
            String(req.params.id),
            req.auth!.id,
            req.body as PurchaseReturnInput,
          )
        : service.updateSale(
            req.tenant!.businessId,
            String(req.params.id),
            req.auth!.id,
            req.body as SaleReturnInput,
          )
    )
      .then((d) => success(res, d))
      .catch(next);
  };
  const post: RequestHandler = (req, res, next) => {
    void (
      kind === 'PURCHASE'
        ? service.postPurchase(req.tenant!.businessId, String(req.params.id), req.auth!.id)
        : service.postSale(req.tenant!.businessId, String(req.params.id), req.auth!.id)
    )
      .then((d) => success(res, d))
      .catch(next);
  };
  const remove: RequestHandler = (req, res, next) => {
    void (
      kind === 'PURCHASE'
        ? service.deletePurchase(req.tenant!.businessId, String(req.params.id), req.auth!.id)
        : service.deleteSale(req.tenant!.businessId, String(req.params.id), req.auth!.id)
    )
      .then((d) => success(res, d))
      .catch(next);
  };
  return { list, create, find, update, post, remove };
}
