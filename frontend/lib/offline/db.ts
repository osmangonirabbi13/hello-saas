import Dexie, { type EntityTable } from 'dexie';
import type { IdMapping, LocalEntity, OutboxOperation, SyncConflict } from './types';
export class HelloShopOfflineDb extends Dexie {
  localEntities!: EntityTable<LocalEntity, 'localId'>;
  syncOutbox!: EntityTable<OutboxOperation, 'operationId'>;
  syncConflicts!: EntityTable<SyncConflict, 'conflictId'>;
  idMappings!: EntityTable<IdMapping, 'key'>;
  constructor(name = 'hello-shop-offline') {
    super(name);
    this.version(1).stores({
      localEntities: '&localId,[userId+businessRef],entityType,serverId',
      syncOutbox: '&operationId,[userId+businessRef],status,createdAt,*dependsOnOperationIds',
      syncConflicts: '&conflictId,[userId+businessRef],operationId,type',
      idMappings: '&key,[userId+businessRef],localId,serverId',
    });
  }
}
let browserDb: HelloShopOfflineDb | undefined;
export function getOfflineDb() {
  if (typeof indexedDB === 'undefined')
    throw new Error('Offline storage is available only in the browser.');
  return (browserDb ??= new HelloShopOfflineDb());
}
