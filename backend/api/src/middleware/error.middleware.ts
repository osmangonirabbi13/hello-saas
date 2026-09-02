import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@hello-shop/database';
import { AppError } from '../common/errors/app-error.js';

export const errorMiddleware: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  void _next;
  const normalized =
    error instanceof AppError
      ? error
      : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
        ? new AppError(409, 'UNIQUE_CONFLICT', 'A unique value is already in use.')
      : error instanceof ZodError
        ? new AppError(422, 'VALIDATION_ERROR', 'The submitted data is invalid.')
        : new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  if (normalized.statusCode >= 500)
    request.log?.error({ err: error, requestId: request.id }, 'request failed');
  response.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.fields ? { fields: normalized.fields } : {}),
      ...(normalized.details ? { details: normalized.details } : {}),
    },
    meta: { requestId: request.id },
  });
};
