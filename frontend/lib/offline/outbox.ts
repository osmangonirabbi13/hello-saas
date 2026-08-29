import { createOperationId } from './ids';
import type { EntityType, LocalPartition, OperationType, OutboxOperation } from './types';
export function createOutboxOperation(
  scope: LocalPartition,
  input: {
    entityType: EntityType;
    operationType: OperationType;
    localEntityId: string;
    payload: Record<string, unknown>;
    dependsOnOperationIds?: string[];
  },
): OutboxOperation {
  const now = new Date().toISOString();
  return {
    ...scope,
    ...input,
    operationId: createOperationId(),
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: 'PENDING',
    dependsOnOperationIds: input.dependsOnOperationIds ?? [],
  };
}
