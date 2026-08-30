import type { RequestHandler } from 'express';
import type { QuotationStatus } from '@hello-shop/database';
import type { QuotationInput } from '@hello-shop/validation';
import { success } from '../../lib/response.js';
import type { QuotationService } from './quotation.service.js';
export const quotationController = (s: QuotationService) => {
  const list: RequestHandler = (q, r, n) => {
      void s
        .list(q.tenant!.businessId, q.query)
        .then((d) => success(r, d))
        .catch(n);
    },
    find: RequestHandler = (q, r, n) => {
      void s
        .find(q.tenant!.businessId, String(q.params.id))
        .then((d) => success(r, d))
        .catch(n);
    },
    create: RequestHandler = (q, r, n) => {
      void s
        .create(q.tenant!.businessId, q.auth!.id, q.body as QuotationInput)
        .then((d) => success(r, d, 201))
        .catch(n);
    },
    update: RequestHandler = (q, r, n) => {
      void s
        .update(q.tenant!.businessId, String(q.params.id), q.auth!.id, q.body as QuotationInput)
        .then((d) => success(r, d))
        .catch(n);
    },
    remove: RequestHandler = (q, r, n) => {
      void s
        .remove(q.tenant!.businessId, String(q.params.id), q.auth!.id)
        .then((d) => success(r, d))
        .catch(n);
    },
    convert: RequestHandler = (q, r, n) => {
      void s
        .convert(q.tenant!.businessId, String(q.params.id), q.auth!.id)
        .then((d) => success(r, d))
        .catch(n);
    },
    transition =
      (st: QuotationStatus): RequestHandler =>
      (q, r, n) => {
        void s
          .transition(
            q.tenant!.businessId,
            String(q.params.id),
            q.auth!.id,
            st,
            (q.body as { note?: string | null }).note,
          )
          .then((d) => success(r, d))
          .catch(n);
      };
  return { list, find, create, update, remove, convert, transition };
};
