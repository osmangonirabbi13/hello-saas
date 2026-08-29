import type { HelloShopOfflineDb } from './db';
import { createLocalId } from './ids';
import { createOutboxOperation } from './outbox';
import type { EffectiveEntity, EntityType, LocalEntity, LocalPartition } from './types';
import { assertSafeOfflinePayload } from './types';

export class OfflineWorkflowRepository {
  constructor(private readonly db: HelloShopOfflineDb) {}

  async saveCreate(
    scope: LocalPartition,
    entityType: EntityType,
    payload: Record<string, unknown>,
    dependencies?: string[],
  ) {
    assertSafeOfflinePayload(payload);
    const localId = createLocalId();
    const entity: LocalEntity = {
      ...scope,
      localId,
      entityType,
      payload,
      updatedAt: new Date().toISOString(),
    };
    const localReferences: string[] = [
      ...(JSON.stringify(payload).match(/local_[0-9a-f-]{36}/gi) ?? []),
    ];
    const partitionOperations = await this.db.syncOutbox
      .where('[userId+businessRef]')
      .equals([scope.userId, scope.businessRef])
      .toArray();
    const resolvedDependencies =
      dependencies ??
      partitionOperations
        .filter((item) => localReferences.includes(item.localEntityId))
        .map((item) => item.operationId);
    const operation = createOutboxOperation(scope, {
      entityType,
      operationType: 'CREATE',
      localEntityId: localId,
      payload,
      dependsOnOperationIds: resolvedDependencies,
    });
    await this.db.transaction('rw', this.db.localEntities, this.db.syncOutbox, async () => {
      await this.db.localEntities.add(entity);
      await this.db.syncOutbox.add(operation);
    });
    return { entity, operation };
  }

  async saveUpdate(
    scope: LocalPartition,
    entityType: EntityType,
    localId: string,
    serverId: string,
    payload: Record<string, unknown>,
    baseVersion: number,
  ) {
    assertSafeOfflinePayload(payload);
    const current = await this.db.localEntities.get(localId);
    const entity: LocalEntity = {
      ...scope,
      localId,
      serverId,
      entityType,
      payload: { ...(current?.payload ?? {}), ...payload },
      updatedAt: new Date().toISOString(),
    };
    const operation = {
      ...createOutboxOperation(scope, {
        entityType,
        operationType: 'UPDATE',
        localEntityId: localId,
        payload,
      }),
      serverEntityId: serverId,
      baseVersion: String(baseVersion),
    };
    await this.db.transaction('rw', this.db.localEntities, this.db.syncOutbox, async () => {
      await this.db.localEntities.put(entity);
      await this.db.syncOutbox.add(operation);
    });
    return { entity, operation };
  }

  async effectiveList(scope: LocalPartition, entityType: EntityType, server: LocalEntity[] = []) {
    const local = await this.db.localEntities
      .where('[userId+businessRef]')
      .equals([scope.userId, scope.businessRef])
      .filter((entity) => entity.entityType === entityType)
      .toArray();
    const operations = await this.db.syncOutbox
      .where('[userId+businessRef]')
      .equals([scope.userId, scope.businessRef])
      .toArray();
    const status = new Map(operations.map((item) => [item.localEntityId, item.status]));
    const localServerIds = new Set(local.flatMap((item) => (item.serverId ? [item.serverId] : [])));
    return [
      ...server.filter((item) => !localServerIds.has(item.serverId ?? item.localId)),
      ...local,
    ].map((item): EffectiveEntity => {
      const syncStatus = status.get(item.localId);
      return { ...item, ...(syncStatus ? { syncStatus } : {}) };
    });
  }

  async discard(scope: LocalPartition, operationId: string) {
    const operation = await this.db.syncOutbox.get(operationId);
    if (!operation || operation.userId !== scope.userId || operation.businessRef !== scope.businessRef)
      return false;
    await this.db.transaction(
      'rw',
      this.db.localEntities,
      this.db.syncOutbox,
      this.db.syncConflicts,
      async () => {
        await this.db.syncOutbox.delete(operationId);
        await this.db.syncConflicts.where('operationId').equals(operationId).delete();
        if (operation.operationType === 'CREATE')
          await this.db.localEntities.delete(operation.localEntityId);
      },
    );
    return true;
  }
}

export function currentOfflineScope(): LocalPartition {
  const fallback = { userId: 'demo-user', businessRef: 'demo-business' };
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    return JSON.parse(sessionStorage.getItem('hello_shop_offline_scope') ?? '') as LocalPartition;
  } catch {
    return fallback;
  }
}
