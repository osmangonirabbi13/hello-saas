import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadRootEnv } from '@hello-shop/config';

loadRootEnv();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL is required.');
const parsed = new URL(redisUrl);
if (!['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(parsed.hostname))
  throw new Error('Redis lifecycle verification requires a local Redis URL.');
const queueName = 'foundation-verify-' + randomUUID();
const redisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  connectTimeout: 2_000,
  retryStrategy: () => null,
} as const;
const connection = new Redis(redisUrl, redisOptions);
const producerConnection = new Redis(redisUrl, redisOptions);
const eventsConnection = new Redis(redisUrl, redisOptions);
const connections = [connection, producerConnection, eventsConnection];
for (const client of connections) client.on('error', () => undefined);
try {
  await Promise.all(connections.map((client) => client.connect()));
} catch (error) {
  for (const client of connections) client.disconnect();
  throw error;
}
const queue = new Queue<{ correlationId: string }, { correlationId: string; processed: boolean }>(
  queueName,
  { connection: producerConnection },
);
const events = new QueueEvents(queueName, { connection: eventsConnection });
const worker = new Worker<{ correlationId: string }, { correlationId: string; processed: boolean }>(
  queueName,
  (job) => Promise.resolve({ correlationId: job.data.correlationId, processed: true }),
  { connection, concurrency: 1 },
);
await events.waitUntilReady();
await worker.waitUntilReady();
const job = await queue.add(
  'lifecycle',
  { correlationId: randomUUID() },
  {
    attempts: 2,
    backoff: { type: 'exponential', delay: 100 },
    removeOnComplete: true,
    removeOnFail: true,
  },
);
const result = (await job.waitUntilFinished(events, 10_000)) as { processed: boolean };
if (!result.processed) throw new Error('BullMQ lifecycle job did not complete.');
process.stdout.write(
  JSON.stringify({ redis: await producerConnection.ping(), bullmq: 'processed' }) + '\n',
);
await Promise.all([worker.close(), events.close(), queue.close()]);
connection.disconnect();
producerConnection.disconnect();
eventsConnection.disconnect();
