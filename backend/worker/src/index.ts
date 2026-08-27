import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { loadRootEnv, parseWorkerEnv } from '@hello-shop/config';
import { prisma } from '@hello-shop/database';

loadRootEnv();
const env = parseWorkerEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL, redact: ['*.token', '*.cookie', '*.password'] });
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const cleanupWorker = new Worker(
  'cleanup',
  async (job) => {
    if (job.name !== 'expired-sessions') throw new Error('Unsupported cleanup job');
    const retentionDate = new Date(Date.now() - 90 * 86_400_000);
    const result = await prisma.loginSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: retentionDate } }, { revokedAt: { lt: retentionDate } }] },
    });
    return { removedSessions: result.count };
  },
  { connection, concurrency: 2, lockDuration: 30_000 },
);

cleanupWorker.on('completed', (job) =>
  logger.info({ jobId: job.id, queue: job.queueName }, 'job completed'),
);
cleanupWorker.on('failed', (job, error) =>
  logger.error({ jobId: job?.id, queue: job?.queueName, err: error }, 'job failed'),
);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'worker shutdown started');
  await cleanupWorker.close();
  connection.disconnect();
  await prisma.$disconnect();
}
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
