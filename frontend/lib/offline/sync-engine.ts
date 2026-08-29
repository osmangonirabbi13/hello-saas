import { createOperationId } from './ids';
import type { ConflictRepository, IdMappingRepository, SyncOutboxRepository } from './repositories';
import type { ConflictType, LocalPartition, OutboxOperation } from './types';
export type SyncResult = { serverId?: string };
export type SyncAdapter = (operation: OutboxOperation) => Promise<SyncResult>;
export class SyncFailure extends Error {
  constructor(
    public code: string,
    public kind: 'NETWORK' | 'AUTH' | 'CONFLICT',
    message: string,
    public conflictType: ConflictType = 'VALIDATION_ERROR',
  ) {
    super(message);
  }
}
export class SyncEngine {
  private running: Promise<void> | undefined;
  constructor(
    private outbox: SyncOutboxRepository,
    private conflicts: ConflictRepository,
    private mappings: IdMappingRepository,
    private adapter: SyncAdapter,
  ) {}
  sync(scope: LocalPartition) {
    if (this.running) return this.running;
    this.running = this.run(scope).finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async run(scope: LocalPartition) {
    const operations = await this.outbox.pending(scope);
    const completed = new Set(
      (await this.outbox.list(scope))
        .filter((x) => x.status === 'SYNCED')
        .map((x) => x.operationId),
    );
    for (const op of operations) {
      if (op.dependsOnOperationIds.some((id) => !completed.has(id))) continue;
      await this.outbox.setStatus(op.operationId, 'SYNCING');
      try {
        const result = await this.adapter(op);
        if (result.serverId)
          await this.mappings.save(scope, {
            localId: op.localEntityId,
            serverId: result.serverId,
            entityType: op.entityType,
          });
        await this.outbox.setStatus(op.operationId, 'SYNCED');
        completed.add(op.operationId);
      } catch (reason) {
        const error =
          reason instanceof SyncFailure
            ? reason
            : new SyncFailure('NETWORK_ERROR', 'NETWORK', 'Could not connect.');
        if (error.kind === 'CONFLICT') {
          await this.outbox.setStatus(op.operationId, 'CONFLICT', error.code);
          await this.conflicts.add({
            ...scope,
            conflictId: createOperationId(),
            operationId: op.operationId,
            type: error.conflictType,
            message: error.message,
            createdAt: new Date().toISOString(),
          });
        } else {
          await this.outbox.retry(op.operationId, error.code);
        }
        if (error.kind === 'AUTH') break;
      }
    }
  }
}
