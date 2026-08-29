import { CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import type { SyncStatus } from '@/lib/offline/types';

export function OfflineSaveIndicator({ status }: { status: SyncStatus }) {
  const view = status === 'SYNCED' ? { label: 'Synced', icon: CheckCircle2, style: 'text-emerald-700' } : status === 'CONFLICT' ? { label: 'Needs review', icon: AlertTriangle, style: 'text-amber-700' } : status === 'FAILED' ? { label: 'Saved locally · Retry needed', icon: AlertTriangle, style: 'text-amber-700' } : { label: status === 'SYNCING' ? 'Syncing…' : 'Waiting to sync', icon: Clock3, style: 'text-slate-600' };
  const Icon = view.icon;
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${view.style}`} role="status"><Icon aria-hidden size={14}/>{view.label}</span>;
}
