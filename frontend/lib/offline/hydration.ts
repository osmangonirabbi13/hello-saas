import { getOfflineDb } from './db';
import { partitionKey, type EntityType, type LocalPartition } from './types';

const resources: Array<{ entityType: EntityType; path: string }> = [
  { entityType: 'PRODUCT', path: '/products' },
  { entityType: 'CUSTOMER', path: '/customers' },
  { entityType: 'SUPPLIER', path: '/suppliers' },
  { entityType: 'CATEGORY', path: '/categories' },
  { entityType: 'BRAND', path: '/brands' },
  { entityType: 'UNIT', path: '/units' },
];

export async function hydrateOfflineReferences(
  scope: LocalPartition,
  fetcher: typeof fetch = fetch,
) {
  if (!navigator.onLine) return;
  const token = sessionStorage.getItem('hello_shop_access');
  if (!token) return;
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const db = getOfflineDb();
  for (const resource of resources) {
    const response = await fetcher(`${base}${resource.path}?page=1&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => null);
    if (!response?.ok) continue;
    const envelope = (await response.json()) as { data?: { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> };
    const rows = Array.isArray(envelope.data) ? envelope.data : envelope.data?.rows ?? [];
    const now = new Date().toISOString();
    await db.transaction('rw', db.localEntities, db.snapshotMeta, async () => {
      for (const row of rows) {
        if (typeof row.id !== 'string') continue;
        const localId = `cache_${resource.entityType.toLowerCase()}_${row.id}`;
        const pending = await db.localEntities
          .where('serverId')
          .equals(row.id)
          .and((item) => item.userId === scope.userId && item.businessRef === scope.businessRef)
          .first();
        if (!pending)
          await db.localEntities.put({
            ...scope,
            localId,
            serverId: row.id,
            entityType: resource.entityType,
            payload: row,
            updatedAt: now,
          });
      }
      await db.snapshotMeta.put({
        ...scope,
        key: `${partitionKey(scope)}::${resource.entityType}`,
        entityType: resource.entityType,
        lastFetchedAt: now,
        lastSyncedAt: now,
        recordCount: rows.length,
      });
    });
  }
}
