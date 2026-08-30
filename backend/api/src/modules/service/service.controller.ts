import type { RequestHandler } from 'express';
import type { ServiceStatus } from '@hello-shop/database';
import type { ServiceCreateInput, ServiceUpdateInput } from '@hello-shop/validation';
import { success } from '../../lib/response.js';
import type { ServiceService } from './service.service.js';
export const serviceController = (s: ServiceService) => {
  const list: RequestHandler = (q, r, n) => {
    void s
      .list(q.tenant!.businessId, q.query)
      .then((d) => success(r, d))
      .catch(n);
  };
  const find: RequestHandler = (q, r, n) => {
    void s
      .find(q.tenant!.businessId, String(q.params.id))
      .then((d) => success(r, d))
      .catch(n);
  };
  const assignees: RequestHandler = (q, r, n) => {
    void s
      .assignees(q.tenant!.businessId)
      .then((d) => success(r, d))
      .catch(n);
  };
  const create: RequestHandler = (q, r, n) => {
    void s
      .create(q.tenant!.businessId, q.auth!.id, q.body as ServiceCreateInput)
      .then((d) => success(r, d, 201))
      .catch(n);
  };
  const update: RequestHandler = (q, r, n) => {
    void s
      .update(q.tenant!.businessId, String(q.params.id), q.auth!.id, q.body as ServiceUpdateInput)
      .then((d) => success(r, d))
      .catch(n);
  };
  const transition =
    (st: ServiceStatus): RequestHandler =>
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
  return { list, assignees, find, create, update, transition };
};
