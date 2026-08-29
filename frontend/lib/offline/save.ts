import { getOfflineDb } from './db';
import { LocalEntityRepository, SyncOutboxRepository } from './repositories';
import { syncOfflineChanges } from './sync-runtime';
import type { EntityType } from './types';
import { currentOfflineScope, OfflineWorkflowRepository } from './workflows';

export async function saveOfflineCapable(input: {
  entityType: EntityType;
  payload: Record<string, unknown>;
  serverId?: string;
  baseVersion?: number;
}) {
  const scope = currentOfflineScope();
  const db = getOfflineDb();
  const workflows = new OfflineWorkflowRepository(db);
  const existing = input.serverId
    ? (await new LocalEntityRepository(db).list(scope)).find(
        (item) => item.serverId === input.serverId && item.entityType === input.entityType,
      )
    : undefined;
  const saved =
    input.serverId && input.baseVersion
      ? await workflows.saveUpdate(
          scope,
          input.entityType,
          existing?.localId ?? input.serverId,
          input.serverId,
          input.payload,
          input.baseVersion,
        )
      : await workflows.saveCreate(scope, input.entityType, input.payload);
  if (navigator.onLine) await syncOfflineChanges(scope);
  const operation = await new SyncOutboxRepository(db).get(saved.operation.operationId);
  return operation?.status === 'SYNCED' ? 'Saved' : 'Saved offline — waiting to sync';
}
