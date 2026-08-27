import { createClient } from 'redis';
import { loadRootEnv, parseApiEnv } from '@hello-shop/config';
import { prisma } from '@hello-shop/database';
import { createApp } from './app.js';
import { createLogger } from './config/logger.js';
import { PrismaAuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';

loadRootEnv();
const env = parseApiEnv(process.env);
const logger = createLogger(env.LOG_LEVEL);
const redis = createClient({ url: env.REDIS_URL });
redis.on('error', (error) => logger.error({ err: error }, 'redis error'));
await redis.connect();
const repository = new PrismaAuthRepository();
const authService = new AuthService(repository, {
  secret: env.ACCESS_TOKEN_SECRET,
  accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
  refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
});
const app = createApp({
  authService,
  authRepository: repository,
  logger,
  corsOrigins: env.CORS_ORIGINS,
  cookieSecure: env.COOKIE_SECURE,
  readinessCheck: async () => {
    const [database, redisReady] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis
        .ping()
        .then(() => true)
        .catch(() => false),
    ]);
    return { database, redis: redisReady };
  },
});
const server = app.listen(env.API_PORT, () => logger.info({ port: env.API_PORT }, 'api listening'));

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown started');
  server.close(() => {
    void Promise.allSettled([redis.quit(), prisma.$disconnect()]).then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
