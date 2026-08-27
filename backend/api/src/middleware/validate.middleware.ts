import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../common/errors/app-error.js';

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'body';
        (fields[key] ??= []).push(issue.message);
      }
      return next(new AppError(422, 'VALIDATION_ERROR', 'The submitted data is invalid.', fields));
    }
    request.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'query';
        (fields[key] ??= []).push(issue.message);
      }
      return next(new AppError(422, 'VALIDATION_ERROR', 'The query parameters are invalid.', fields));
    }
    request.query = result.data as typeof request.query;
    next();
  };
}
