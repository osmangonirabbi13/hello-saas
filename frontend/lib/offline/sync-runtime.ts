import { getOfflineDb } from './db';
import { createApiSyncAdapter } from './api-adapter';
import {
  ConflictRepository,
  IdMappingRepository,
  LocalEntityRepository,
  SyncOutboxRepository,
} from './repositories';
import { SyncEngine } from './sync-engine';
import type { LocalPartition } from './types';

export function syncOfflineChanges(scope: LocalPartition) {
  const db = getOfflineDb();
  const mappings = new IdMappingRepository(db);
  return new SyncEngine(
    new SyncOutboxRepository(db),
    new ConflictRepository(db),
    mappings,
    createApiSyncAdapter(scope, mappings),
    new LocalEntityRepository(db),
  ).sync(scope);
}
