import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { offlineCapability } from './capabilities';
import { connectionTransition } from './connectivity';
import { HelloShopOfflineDb } from './db';
import { createLocalId, createOperationId } from './ids';
import { createOutboxOperation } from './outbox';
import {
  ConflictRepository,
  IdMappingRepository,
  LocalEntityRepository,
  SyncOutboxRepository,
} from './repositories';
import { SyncEngine, SyncFailure } from './sync-engine';
import { OfflineWorkflowRepository } from './workflows';

const databases: HelloShopOfflineDb[] = [];
function setup() {
  const db = new HelloShopOfflineDb(`test-${crypto.randomUUID()}`);
  databases.push(db);
  return {
    db,
    entities: new LocalEntityRepository(db),
    outbox: new SyncOutboxRepository(db),
    conflicts: new ConflictRepository(db),
    mappings: new IdMappingRepository(db),
  };
}
const scopeA = { userId: 'user-a', businessRef: 'business-a' };
const scopeB = { userId: 'user-b', businessRef: 'business-b' };
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

describe('offline persistence and partition safety', () => {
  it('creates collision-safe local and operation ids', () => {
    expect(createLocalId()).not.toBe(createLocalId());
    expect(createOperationId()).not.toBe(createOperationId());
  });
  it('saves local entities and outbox intent only inside its user/business partition', async () => {
    const { entities, outbox } = setup();
    const localId = createLocalId();
    await entities.save({
      ...scopeA,
      localId,
      entityType: 'PRODUCT',
      payload: { name: 'Mouse' },
      updatedAt: new Date().toISOString(),
    });
    await outbox.add(
      createOutboxOperation(scopeA, {
        entityType: 'PRODUCT',
        operationType: 'CREATE',
        localEntityId: localId,
        payload: { name: 'Mouse' },
      }),
    );
    expect(await entities.list(scopeA)).toHaveLength(1);
    expect(await entities.list(scopeB)).toHaveLength(0);
    expect(await outbox.list(scopeB)).toHaveLength(0);
  });
  it('rejects tokens and secrets in offline payloads', async () => {
    const { entities } = setup();
    await expect(
      entities.save({
        ...scopeA,
        localId: createLocalId(),
        entityType: 'CUSTOMER',
        payload: { accessToken: 'secret' },
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Sensitive/);
  });
});

describe('sync engine', () => {
  it('syncs once, maps ids, and prevents concurrent duplicate execution', async () => {
    const { outbox, conflicts, mappings } = setup();
    const operation = createOutboxOperation(scopeA, {
      entityType: 'PRODUCT',
      operationType: 'CREATE',
      localEntityId: createLocalId(),
      payload: { name: 'Mouse' },
    });
    await outbox.add(operation);
    const adapter = vi.fn(async () => ({ serverId: 'server-1' }));
    const engine = new SyncEngine(outbox, conflicts, mappings, adapter);
    await Promise.all([engine.sync(scopeA), engine.sync(scopeA)]);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect((await outbox.list(scopeA))[0]?.status).toBe('SYNCED');
    expect((await mappings.resolve(scopeA, operation.localEntityId))?.serverId).toBe('server-1');
    await engine.sync(scopeA);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it('keeps network failures retryable and records understandable conflicts', async () => {
    const first = setup();
    const network = createOutboxOperation(scopeA, {
      entityType: 'CUSTOMER',
      operationType: 'CREATE',
      localEntityId: createLocalId(),
      payload: { name: 'A' },
    });
    await first.outbox.add(network);
    await new SyncEngine(first.outbox, first.conflicts, first.mappings, async () => {
      throw new SyncFailure('NETWORK_ERROR', 'NETWORK', 'Saved locally');
    }).sync(scopeA);
    expect((await first.outbox.list(scopeA))[0]).toMatchObject({
      status: 'FAILED',
      retryCount: 1,
      lastErrorCode: 'NETWORK_ERROR',
    });
    const second = setup();
    const conflict = createOutboxOperation(scopeA, {
      entityType: 'PRODUCT',
      operationType: 'CREATE',
      localEntityId: createLocalId(),
      payload: { sku: 'DUP' },
    });
    await second.outbox.add(conflict);
    await new SyncEngine(second.outbox, second.conflicts, second.mappings, async () => {
      throw new SyncFailure('SKU_TAKEN', 'CONFLICT', 'SKU is already in use', 'UNIQUE_CONFLICT');
    }).sync(scopeA);
    expect((await second.conflicts.list(scopeA))[0]?.type).toBe('UNIQUE_CONFLICT');
  });
  it('waits for unresolved dependencies and stops after authentication failure', async () => {
    const { outbox, conflicts, mappings } = setup();
    const dependency = createOperationId();
    await outbox.add(
      createOutboxOperation(scopeA, {
        entityType: 'SALE_DRAFT',
        operationType: 'CREATE',
        localEntityId: createLocalId(),
        payload: {},
        dependsOnOperationIds: [dependency],
      }),
    );
    const adapter = vi.fn();
    await new SyncEngine(outbox, conflicts, mappings, adapter).sync(scopeA);
    expect(adapter).not.toHaveBeenCalled();
  });
});

describe('offline policy and deterministic connectivity', () => {
  it('classifies drafts versus authoritative posting', () => {
    expect(offlineCapability('products.create')).toBe('OFFLINE_SAFE');
    expect(offlineCapability('customers.create')).toBe('OFFLINE_SAFE');
    expect(offlineCapability('suppliers.update')).toBe('OFFLINE_SAFE');
    expect(offlineCapability('purchases.draft')).toBe('OFFLINE_SAFE');
    expect(offlineCapability('purchases.post')).toBe('ONLINE_REQUIRED');
    expect(offlineCapability('sales.draft')).toBe('OFFLINE_SAFE');
    expect(offlineCapability('sales.post')).toBe('ONLINE_REQUIRED');
    expect(offlineCapability('pos.checkout')).toBe('ONLINE_REQUIRED');
    expect(offlineCapability('inventory.adjust')).toBe('ONLINE_REQUIRED');
  });
  it('models offline, reconnected, and API-unreachable states', () => {
    expect(connectionTransition(false)).toBe('OFFLINE');
    expect(connectionTransition(true, true)).toBe('ONLINE');
    expect(connectionTransition(true, false)).toBe('API_UNREACHABLE');
  });
});

describe('actual offline workflow composition', () => {
  it('atomically saves a Product create, exposes it locally, then deduplicates its server mapping', async () => {
    const { db } = setup();
    const workflow = new OfflineWorkflowRepository(db);
    const saved = await workflow.saveCreate(scopeA, 'PRODUCT', { name: 'Offline mouse' });
    expect(await db.syncOutbox.get(saved.operation.operationId)).toMatchObject({
      localEntityId: saved.entity.localId,
      status: 'PENDING',
    });
    expect((await workflow.effectiveList(scopeA, 'PRODUCT'))[0]?.payload.name).toBe('Offline mouse');
    await db.localEntities.put({
      ...saved.entity,
      serverId: 'product-server',
      payload: { name: 'Authoritative mouse', id: 'product-server' },
    });
    const effective = await workflow.effectiveList(scopeA, 'PRODUCT', [{
      ...scopeA,
      localId: 'cache-product-server',
      serverId: 'product-server',
      entityType: 'PRODUCT',
      payload: { name: 'Server duplicate' },
      updatedAt: new Date().toISOString(),
    }]);
    expect(effective).toHaveLength(1);
    expect(effective[0]?.payload.name).toBe('Authoritative mouse');
  });

  it('orders a local Supplier before its dependent Purchase Draft', async () => {
    const { db } = setup();
    const workflow = new OfflineWorkflowRepository(db);
    const supplier = await workflow.saveCreate(scopeA, 'SUPPLIER', { name: 'Local supplier' });
    const purchase = await workflow.saveCreate(scopeA, 'PURCHASE_DRAFT', {
      supplierId: supplier.entity.localId,
      lines: [],
    });
    expect(purchase.operation.dependsOnOperationIds).toEqual([supplier.operation.operationId]);
  });

  it('keeps tenant partitions isolated and safely discards a conflicted create', async () => {
    const { db } = setup();
    const workflow = new OfflineWorkflowRepository(db);
    const saved = await workflow.saveCreate(scopeA, 'CUSTOMER', { name: 'Rahim' });
    expect(await workflow.discard(scopeB, saved.operation.operationId)).toBe(false);
    expect(await workflow.discard(scopeA, saved.operation.operationId)).toBe(true);
    expect(await db.localEntities.get(saved.entity.localId)).toBeUndefined();
  });

  it('records stale update conflicts without retrying them endlessly', async () => {
    const { db, outbox, conflicts, mappings, entities } = setup();
    const update = await new OfflineWorkflowRepository(db).saveUpdate(
      scopeA,
      'PRODUCT',
      'local-product',
      'server-product',
      { sku: 'TAKEN' },
      3,
    );
    const adapter = vi.fn(async () => {
      throw new SyncFailure('RECORD_CHANGED', 'CONFLICT', 'Changed elsewhere', 'RECORD_CHANGED');
    });
    const engine = new SyncEngine(outbox, conflicts, mappings, adapter, entities);
    await engine.sync(scopeA);
    await engine.sync(scopeA);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect((await outbox.get(update.operation.operationId))?.status).toBe('CONFLICT');
  });
});
