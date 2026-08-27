import type { Response } from 'express';

export function success<T>(response: Response, data: T, statusCode = 200): void {
  response.status(statusCode).json({ success: true, data, meta: { requestId: response.req.id } });
}
