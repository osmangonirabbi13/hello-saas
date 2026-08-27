import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const rootEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url));

export function loadRootEnv(): void {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  CORS_ORIGINS: z.string().transform((value) => value.split(',').map((item) => item.trim())),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(30),
  COOKIE_SECURE: booleanString.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export const workerEnvSchema = apiEnvSchema.pick({
  NODE_ENV: true,
  REDIS_URL: true,
  LOG_LEVEL: true,
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return apiEnvSchema.parse(source);
}

export function parseWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  return workerEnvSchema.parse(source);
}
