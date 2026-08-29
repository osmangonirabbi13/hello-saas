import type { IdMappingRepository } from './repositories';
import { SyncFailure, type SyncAdapter } from './sync-engine';
import type { EntityType, LocalPartition, OutboxOperation } from './types';

const createPath: Record<EntityType, string> = {
  PRODUCT: '/products',
  CUSTOMER: '/customers',
  SUPPLIER: '/suppliers',
  CATEGORY: '/categories',
  BRAND: '/brands',
  UNIT: '/units',
  PURCHASE_DRAFT: '/purchases',
  SALE_DRAFT: '/sales',
};

async function resolveLocalReferences(
  value: unknown,
  scope: LocalPartition,
  mappings: IdMappingRepository,
): Promise<unknown> {
  if (typeof value === 'string' && value.startsWith('local_')) {
    const mapping = await mappings.resolve(scope, value);
    if (!mapping)
      throw new SyncFailure(
        'DEPENDENCY_NOT_READY',
        'NETWORK',
        'A related offline record must sync first.',
      );
    return mapping.serverId;
  }
  if (Array.isArray(value))
    return Promise.all(value.map((item) => resolveLocalReferences(item, scope, mappings)));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(
        async ([key, item]) =>
          [key, await resolveLocalReferences(item, scope, mappings)] as const,
      ),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

function classify(status: number, code: string) {
  if (status === 401) return new SyncFailure('AUTH_REQUIRED', 'AUTH', 'Sign in again to sync.');
  if (status === 403)
    return new SyncFailure(
      'PERMISSION_CHANGED',
      'CONFLICT',
      'You no longer have permission to save this change.',
      'PERMISSION_CHANGED',
    );
  const type =
    code === 'RECORD_CHANGED'
      ? 'RECORD_CHANGED'
      : code.includes('NOT_FOUND')
        ? 'RECORD_DELETED'
        : code.includes('DUPLICATE') || code.includes('MISMATCH')
          ? 'UNIQUE_CONFLICT'
          : 'VALIDATION_ERROR';
  return new SyncFailure(code, 'CONFLICT', 'This change needs review before it can sync.', type);
}

export function createApiSyncAdapter(
  scope: LocalPartition,
  mappings: IdMappingRepository,
  fetcher: typeof fetch = fetch,
): SyncAdapter {
  return async (operation: OutboxOperation) => {
    const token = sessionStorage.getItem('hello_shop_access');
    if (!token) throw new SyncFailure('AUTH_REQUIRED', 'AUTH', 'Sign in again to sync.');
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const path =
      operation.operationType === 'CREATE'
        ? createPath[operation.entityType]
        : `${createPath[operation.entityType]}/${operation.serverEntityId ?? ''}`;
    const body = await resolveLocalReferences(operation.payload, scope, mappings);
    let response: Response;
    try {
      response = await fetcher(base + path, {
        method: operation.operationType === 'CREATE' ? 'POST' : 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(operation.operationType === 'CREATE'
            ? { 'Idempotency-Key': operation.operationId }
            : operation.baseVersion
              ? { 'If-Match': operation.baseVersion }
              : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new SyncFailure('NETWORK_ERROR', 'NETWORK', 'Could not reach Hello Shop.');
    }
    const parsed = (await response.json().catch(() => null)) as
      | { data?: Record<string, unknown>; error?: { code?: string; message?: string } }
      | null;
    if (!response.ok) {
      const failure = classify(response.status, parsed?.error?.code ?? 'VALIDATION_ERROR');
      if (parsed?.error?.message) failure.message = parsed.error.message;
      throw failure;
    }
    const data = parsed?.data;
    return {
      ...(typeof data?.id === 'string' ? { serverId: data.id } : {}),
      ...(data ? { data } : {}),
    };
  };
}
