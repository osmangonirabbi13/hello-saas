import { createHash } from 'node:crypto';
import { prisma, type Prisma } from '@hello-shop/database';
import { AppError } from '../../common/errors/app-error.js';

export type MutationIdentity = {
  operationId: string;
  operationScope: string;
};

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

export function requestHash(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}

export async function replayIdempotent<T>(
  businessId: string,
  identity: MutationIdentity | undefined,
  payload: unknown,
): Promise<T | undefined> {
  if (!identity) return undefined;
  const existing = await prisma.mutationIdempotency.findUnique({
    where: {
      businessId_operationId_operationScope: {
        businessId,
        operationId: identity.operationId,
        operationScope: identity.operationScope,
      },
    },
  });
  if (!existing) return undefined;
  if (existing.requestHash !== requestHash(payload))
    throw new AppError(
      409,
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'This operation key was already used with different data.',
    );
  if (existing.status !== 'COMPLETED' || !existing.responseData)
    throw new AppError(409, 'IDEMPOTENCY_IN_PROGRESS', 'This operation is still processing.');
  return existing.responseData as T;
}

export function mutationIdentity(header: string | string[] | undefined, scope: string) {
  if (header === undefined) return undefined;
  const operationId = Array.isArray(header) ? header[0] : header;
  if (!operationId || !/^op_[0-9a-f-]{36}$/i.test(operationId))
    throw new AppError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key is required.');
  return { operationId, operationScope: scope };
}

export async function executeIdempotent<T extends { id: string }>(input: {
  businessId: string;
  userId: string;
  identity?: MutationIdentity | undefined;
  payload: unknown;
  execute: (tx: Prisma.TransactionClient) => Promise<T>;
}) {
  if (!input.identity)
    return prisma.$transaction(input.execute, { isolationLevel: 'Serializable' });
  const hash = requestHash(input.payload);
  return prisma.$transaction(
    async (tx) => {
      const key = {
        businessId_operationId_operationScope: {
          businessId: input.businessId,
          operationId: input.identity!.operationId,
          operationScope: input.identity!.operationScope,
        },
      };
      const existing = await tx.mutationIdempotency.findUnique({ where: key });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new AppError(
            409,
            'IDEMPOTENCY_PAYLOAD_MISMATCH',
            'This operation key was already used with different data.',
          );
        if (existing.status !== 'COMPLETED' || !existing.responseData)
          throw new AppError(409, 'IDEMPOTENCY_IN_PROGRESS', 'This operation is still processing.');
        return existing.responseData as T;
      }
      await tx.mutationIdempotency.create({
        data: {
          businessId: input.businessId,
          userId: input.userId,
          operationId: input.identity!.operationId,
          operationScope: input.identity!.operationScope,
          requestHash: hash,
          status: 'PROCESSING',
        },
      });
      const result = await input.execute(tx);
      await tx.mutationIdempotency.update({
        where: key,
        data: {
          status: 'COMPLETED',
          resourceId: result.id,
          responseData: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return result;
    },
    { isolationLevel: 'Serializable' },
  );
}

export function expectedVersion(header: string | string[] | undefined) {
  if (header === undefined) return undefined;
  const value = Number(Array.isArray(header) ? header[0] : header);
  if (!Number.isInteger(value) || value < 1)
    throw new AppError(400, 'INVALID_VERSION', 'If-Match must contain a positive version.');
  return value;
}
