import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const supplied = request.header('x-request-id');
  request.id =
    supplied && /^[a-zA-Z0-9_-]{8,128}$/.test(supplied) ? supplied : `req_${randomUUID()}`;
  response.setHeader('x-request-id', request.id);
  next();
};
