import type { LucideIcon } from 'lucide-react';
import { CurrencyDisplay } from './primitives';
import { cn } from '@/lib/utils';
export function StatCard({
  title,
  amount,
  icon: Icon,
  metrics,
  tone = 'emerald',
}: {
  title: string;
  amount: number;
  icon: LucideIcon;
  metrics: string[][];
  tone?: string;
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-600'
      : tone === 'violet'
        ? 'bg-violet-50 text-violet-600'
        : tone === 'amber'
          ? 'bg-amber-50 text-amber-600'
          : 'bg-emerald-50 text-emerald-700';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <strong className="mt-2 block text-2xl tracking-tight text-slate-950">
            <CurrencyDisplay value={amount} compact />
          </strong>
        </div>
        <span className={cn('grid size-10 place-items-center rounded-xl', toneClass)}>
          <Icon size={19} />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <span className="block truncate text-[10px] text-slate-400">{label}</span>
            <b className="mt-0.5 block truncate text-[11px] text-slate-700">{value}</b>
          </div>
        ))}
      </div>
    </article>
  );
}
