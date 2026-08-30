import type { RequestHandler } from 'express';
import type { RmaStatus } from '@hello-shop/database';
import type { RmaCreateInput, RmaUpdateInput } from '@hello-shop/validation';
import { success } from '../../lib/response.js';
import type { RmaService } from './rma.service.js';
export function rmaController(service: RmaService) {
  const eligibility: RequestHandler = (q, r, n) => {
    void service
      .eligibility(q.tenant!.businessId, q.query as { serial?: string; saleLineId?: string })
      .then((d) => success(r, d))
      .catch(n);
  };
  const list: RequestHandler = (q, r, n) => {
    void service
      .list(q.tenant!.businessId, q.query as never)
      .then((d) => success(r, d))
      .catch(n);
  };
  const find: RequestHandler = (q, r, n) => {
    void service
      .find(q.tenant!.businessId, String(q.params.id))
      .then((d) => success(r, d))
      .catch(n);
  };
  const create: RequestHandler = (q, r, n) => {
    void service
      .create(q.tenant!.businessId, q.auth!.id, q.body as RmaCreateInput)
      .then((d) => success(r, d, 201))
      .catch(n);
  };
  const update: RequestHandler = (q, r, n) => {
    void service
      .update(q.tenant!.businessId, String(q.params.id), q.auth!.id, q.body as RmaUpdateInput)
      .then((d) => success(r, d))
      .catch(n);
  };
  const transition =
    (status: RmaStatus): RequestHandler =>
    (q, r, n) => {
      void service
        .transition(
          q.tenant!.businessId,
          String(q.params.id),
          q.auth!.id,
          status,
          (q.body as { note?: string | null }).note,
        )
        .then((d) => success(r, d))
        .catch(n);
    };
  const track: RequestHandler = (q, r, n) => {
    void service
      .publicTrack(String(q.params.token))
      .then((d) => success(r, d))
      .catch(n);
  };
  const history: RequestHandler = (q, r, n) => {
    void service
      .serialHistory(q.tenant!.businessId, String(q.params.id))
      .then((d) => success(r, d))
      .catch(n);
  };
  return { eligibility, list, find, create, update, transition, track, history };
}
