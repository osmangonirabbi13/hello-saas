export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';
export type EntityType =
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'CATEGORY'
  | 'BRAND'
  | 'UNIT'
  | 'PURCHASE_DRAFT'
  | 'SALE_DRAFT';
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type ConflictType =
  | 'UNIQUE_CONFLICT'
  | 'RECORD_CHANGED'
  | 'RECORD_DELETED'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_CHANGED'
  | 'SERIAL_CONFLICT'
  | 'STOCK_CONFLICT';
export type LocalPartition = { userId: string; businessRef: string };
export type LocalEntity = LocalPartition & {
  localId: string;
  entityType: EntityType;
  serverId?: string;
  payload: Record<string, unknown>;
  updatedAt: string;
};
export type OutboxOperation = LocalPartition & {
  operationId: string;
  entityType: EntityType;
  operationType: OperationType;
  localEntityId: string;
  serverEntityId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  status: SyncStatus;
  lastErrorCode?: string;
  baseVersion?: string;
  dependsOnOperationIds: string[];
};
export type SyncConflict = LocalPartition & {
  conflictId: string;
  operationId: string;
  type: ConflictType;
  message: string;
  createdAt: string;
};
export type IdMapping = LocalPartition & {
  key: string;
  localId: string;
  serverId: string;
  entityType: EntityType;
};
export const partitionKey = ({ userId, businessRef }: LocalPartition) =>
  `${userId}::${businessRef}`;
export function assertSafeOfflinePayload(payload: Record<string, unknown>) {
  const forbidden = /token|password|secret|apiKey|privateKey|cookie/i;
  if (Object.keys(payload).some((key) => forbidden.test(key)))
    throw new Error('Sensitive authentication data cannot be stored offline.');
}
