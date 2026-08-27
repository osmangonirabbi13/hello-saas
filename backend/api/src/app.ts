import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import type { AuthService } from './modules/auth/auth.service.js';
import type { AuthRepository } from './modules/auth/auth.types.js';
import { createApiRouter } from './routes.js';

export type ReadinessCheck = () => Promise<{ database: boolean; redis: boolean }>;

export function createApp(dependencies: {
  authService: AuthService;
  authRepository: AuthRepository;
  logger: Logger;
  corsOrigins: string[];
  cookieSecure: boolean;
  readinessCheck: ReadinessCheck;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger: dependencies.logger }));
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || dependencies.corsOrigins.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/health/ready', (_request, response, next) => {
    void dependencies
      .readinessCheck()
      .then((checks) => {
        const ready = checks.database && checks.redis;
        response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
      })
      .catch(next);
  });
  app.use('/api/v1', createApiRouter(dependencies));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
