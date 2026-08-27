import type { RequestHandler } from 'express';
import { success } from '../../lib/response.js';
import type { ProductService } from './product.service.js';
import type { ProductInput } from './product.types.js';
export function productController(service: ProductService) {
  const list: RequestHandler = (req, res, next) => {
    void service
      .list(req.tenant!.businessId, req.query)
      .then((result) => success(res, result))
      .catch(next);
  };
  const lookupBarcode: RequestHandler = (req, res, next) => {
    const barcode = typeof req.query.barcode === 'string' ? req.query.barcode : '';
    void service
      .lookupBarcode(req.tenant!.businessId, barcode)
      .then((result) => success(res, result))
      .catch(next);
  };
  const create: RequestHandler = (req, res, next) => {
    void service
      .create(req.tenant!.businessId, req.auth!.id, req.body as ProductInput)
      .then((result) => success(res, result, 201))
      .catch(next);
  };
  const find: RequestHandler = (req, res, next) => {
    void service
      .find(req.tenant!.businessId, String(req.params.id))
      .then((result) => success(res, result))
      .catch(next);
  };
  const update: RequestHandler = (req, res, next) => {
    void service
      .update(req.tenant!.businessId, String(req.params.id), req.body as Partial<ProductInput>)
      .then((result) => success(res, result))
      .catch(next);
  };
  const remove: RequestHandler = (req, res, next) => {
    void service
      .deactivate(req.tenant!.businessId, String(req.params.id))
      .then((result) => success(res, result))
      .catch(next);
  };
  return { list, lookupBarcode, create, find, update, remove };
}
