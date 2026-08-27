import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';

export const notFoundMiddleware: RequestHandler = (_request, _response, next) =>
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'));
