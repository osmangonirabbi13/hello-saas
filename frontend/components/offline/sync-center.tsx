'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { Cloud, CloudOff, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/primitives';
import {
  checkApiReachability,
  connectionTransition,
  type ConnectionState,
} from '@/lib/offline/connectivity';
import { getOfflineDb } from '@/lib/offline/db';
import { ConflictRepository, SyncOutboxRepository } from '@/lib/offline/repositories';
import type { LocalPartition, OutboxOperation, SyncConflict } from '@/lib/offline/types';
import { OfflineWorkflowRepository } from '@/lib/offline/workflows';

export function SyncCenter({
  scope,
  onSync,
}: {
  scope: LocalPartition;
  onSync?: () => Promise<void>;
}) {
  const [connection, setConnection] = useState<ConnectionState>('ONLINE');
  const [operations, setOperations] = useState<OutboxOperation[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>();
  const refresh = useCallback(async () => {
    const db = getOfflineDb();
    setOperations(await new SyncOutboxRepository(db).list(scope));
    setConflicts(await new ConflictRepository(db).list(scope));
  }, [scope]);
  useEffect(() => {
    const update = (attemptSync = false) => {
      const browserOnline = navigator.onLine;
      setConnection(connectionTransition(browserOnline));
      if (browserOnline)
        void checkApiReachability().then((ok) => {
          setConnection(connectionTransition(true, ok));
          if (ok && attemptSync && onSync) void onSync().finally(refresh);
        });
      void refresh();
    };
    update();
    const online = () => update(true);
    const offline = () => update(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [onSync, refresh]);
  const pending = operations.filter(
    (item) => item.status === 'PENDING' || item.status === 'FAILED',
  ).length;
  const failed = operations.filter((item) => item.status === 'FAILED').length;
  const conflictByOperation = new Map(conflicts.map((item) => [item.operationId, item]));
  async function sync() {
    if (syncing || connection !== 'ONLINE') return;
    setSyncing(true);
    try {
      await onSync?.();
      setLastSynced(new Date().toLocaleTimeString('en-BD', { hour: 'numeric', minute: '2-digit' }));
      await refresh();
    } finally {
      setSyncing(false);
    }
  }
  return (
    <>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            className="top-icon gap-1.5"
            aria-label={`Sync Center: ${connection}, ${pending} pending`}
          >
            {connection === 'ONLINE' ? <Cloud size={18} /> : <CloudOff size={18} />}
            <span className="hidden text-xs sm:inline">
              {connection === 'ONLINE'
                ? pending
                  ? `${pending} waiting`
                  : 'Synced'
                : connection === 'OFFLINE'
                  ? `Offline${pending ? ` · ${pending}` : ''}`
                  : 'API unavailable'}
            </span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-bold">Sync Center</Dialog.Title>
              <Dialog.Close
                className="grid size-11 place-items-center rounded-lg"
                aria-label="Close Sync Center"
              >
                <X />
              </Dialog.Close>
            </div>
            <p className="mt-2 text-sm text-slate-600" role="status">
              {connection === 'ONLINE'
                ? 'Online'
                : connection === 'OFFLINE'
                  ? "You're offline. Supported changes remain saved on this device."
                  : 'Internet is available, but the API cannot be reached.'}
            </p>
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Metric label="Pending" value={pending} />
              <Metric label="Failed" value={failed} />
              <Metric label="Conflicts" value={conflicts.length} />
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Last synced: {lastSynced ?? 'Not in this session'}
            </p>
            <section className="mt-6">
              <h3 className="text-sm font-bold">Pending changes</h3>
              {pending === 0 ? (
                <p className="mt-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  Everything is synced.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {operations
                    .filter((item) => item.status !== 'SYNCED')
                    .slice(0, 20)
                    .map((item) => (
                      <li className="rounded-lg border p-3 text-sm" key={item.operationId}>
                        <b>{entityLabel(item)}</b>
                        <span className="block text-xs text-slate-500">
                          {item.status === 'CONFLICT' ? 'Needs review' : 'Waiting to sync'}
                        </span>
                        {conflictByOperation.get(item.operationId) && (
                          <p className="mt-2 text-xs text-rose-700">{conflictByOperation.get(item.operationId)?.message}</p>
                        )}
                        {item.status === 'CONFLICT' && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a className="rounded-md border px-3 py-2 text-xs font-semibold" href={reviewHref(item)}>Review local change</a>
                            <button className="rounded-md border px-3 py-2 text-xs font-semibold" type="button" onClick={() => void (async () => {
                              const db = getOfflineDb();
                              await new ConflictRepository(db).removeForOperation(item.operationId);
                              await new SyncOutboxRepository(db).resetForRetry(item.operationId);
                              await refresh();
                            })()}>Retry after correction</button>
                            <button className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700" type="button" onClick={() => void (async () => {
                              await new OfflineWorkflowRepository(getOfflineDb()).discard(scope, item.operationId);
                              await refresh();
                            })()}>Discard local change</button>
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </section>
            <Button
              className="mt-6 w-full"
              disabled={syncing || connection !== 'ONLINE' || pending === 0}
              onClick={() => void sync()}
            >
              <RefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {connection !== 'ONLINE' && (
        <div
          className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg"
          role="status"
        >
          {connection === 'OFFLINE'
            ? "You're offline. Supported changes will be saved safely on this device."
            : 'The Hello Shop API is temporarily unreachable.'}
        </div>
      )}
    </>
  );
}
function reviewHref(operation: OutboxOperation) {
  const root =
    operation.entityType === 'PRODUCT'
      ? 'products'
      : operation.entityType === 'CUSTOMER'
        ? 'customers'
        : operation.entityType === 'SUPPLIER'
          ? 'suppliers'
          : operation.entityType === 'PURCHASE_DRAFT'
            ? 'purchases'
            : 'sales';
  return `/${root}/${operation.serverEntityId ?? operation.localEntityId}/edit`;
}
function entityLabel(operation: OutboxOperation) {
  const value = operation.payload.name ?? operation.payload.purchaseNumber ?? operation.payload.saleNumber;
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : operation.entityType.replaceAll('_', ' ');
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-black">{value}</dd>
    </div>
  );
}
