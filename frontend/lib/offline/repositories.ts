import type { HelloShopOfflineDb } from './db';
import {
  assertSafeOfflinePayload,
  partitionKey,
  type IdMapping,
  type LocalEntity,
  type LocalPartition,
  type OutboxOperation,
  type SyncConflict,
  type SyncStatus,
} from './types';
export class LocalEntityRepository {
  constructor(private db: HelloShopOfflineDb) {}
  async save(entity: LocalEntity) {
    assertSafeOfflinePayload(entity.payload);
    await this.db.localEntities.put(entity);
    return entity;
  }
  list(scope: LocalPartition) {
    return this.db.localEntities
      .where('[userId+businessRef]')
      .equals([scope.userId, scope.businessRef])
      .toArray();
  }
  get(localId: string) {
    return this.db.localEntities.get(localId);
  }
  remove(localId: string) {
    return this.db.localEntities.delete(localId);
  }
}
export class SyncOutboxRepository {
  constructor(private db: HelloShopOfflineDb) {}
  async add(operation: OutboxOperation) {
    assertSafeOfflinePayload(operation.payload);
    await this.db.syncOutbox.add(operation);
    return operation;
  }
  list(scope: LocalPartition) {
    return this.db.syncOutbox
      .where('[userId+businessRef]')
      .equals([scope.userId, scope.businessRef])
      .toArray();
  }
  async pending(scope: LocalPartition) {
    const rows = await this.list(scope);
    return rows.filter((row) => row.status === 'PENDING' || row.status === 'FAILED');
  }
  async setStatus(id: string, status: SyncStatus, error?: string) {
    const update = {
      status,
      updatedAt: new Date().toISOString(),
      ...(error ? { lastErrorCode: error } : {}),
    };
    await this.db.syncOutbox.update(id, update);
  }
  get(id: string) {
    return this.db.syncOutbox.get(id);
  }
  remove(id: string) {
    return this.db.syncOutbox.delete(id);
  }
  async resetForRetry(id: string) {
    const operation = await this.db.syncOutbox.get(id);
    if (!operation) return;
    const { lastErrorCode: _lastErrorCode, ...clean } = operation;
    void _lastErrorCode;
    await this.db.syncOutbox.put({
      ...clean,
      status: 'PENDING',
      retryCount: 0,
      updatedAt: new Date().toISOString(),
    });
  }
  async retry(id: string, code: string) {
    const row = await this.db.syncOutbox.get(id);
    if (row)
      await this.db.syncOutbox.update(id, {
        status: 'FAILED',
        retryCount: row.retryCount + 1,
        lastErrorCode: code,
        updatedAt: new Date().toISOString(),
      });
  }
}
export class ConflictRepository {
  constructor(private db: HelloShopOfflineDb) {}
  add(value: SyncConflict) {
    return this.db.syncConflicts.put(value);
  }
  list(scope: LocalPartition) {
    return this.db.syncConflicts
      .where('[userId+businessRef]')
      .equals([scope.userId, scope.businessRef])
      .toArray();
  }
  async removeForOperation(operationId: string) {
    await this.db.syncConflicts.where('operationId').equals(operationId).delete();
  }
}
export class IdMappingRepository {
  constructor(private db: HelloShopOfflineDb) {}
  async save(scope: LocalPartition, mapping: Omit<IdMapping, keyof LocalPartition | 'key'>) {
    const value = { ...scope, ...mapping, key: `${partitionKey(scope)}::${mapping.localId}` };
    await this.db.idMappings.put(value);
    return value;
  }
  async resolve(scope: LocalPartition, localId: string) {
    return this.db.idMappings.get(`${partitionKey(scope)}::${localId}`);
  }
}
