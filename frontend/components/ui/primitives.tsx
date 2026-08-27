'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Inbox, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Button({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-emerald-700 text-white hover:bg-emerald-800',
        variant === 'secondary' &&
          'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        className,
      )}
      {...props}
    />
  );
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function CurrencyDisplay({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <span className="tabular-nums">
      {new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 0,
        notation: compact ? 'compact' : 'standard',
      }).format(value)}
    </span>
  );
}
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        size={17}
      />
      <input
        {...props}
        className={cn(
          'h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
          props.className,
        )}
      />
    </label>
  );
}
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
      {children}
    </div>
  );
}
export function DateRangeFilter() {
  return (
    <Button variant="secondary">
      <CalendarDays size={16} />
      01 Aug — 26 Aug
    </Button>
  );
}
export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'success' && 'bg-emerald-50 text-emerald-700',
        tone === 'warning' && 'bg-amber-50 text-amber-700',
        tone === 'danger' && 'bg-rose-50 text-rose-700',
        tone === 'info' && 'bg-blue-50 text-blue-700',
        tone === 'neutral' && 'bg-slate-100 text-slate-600',
      )}
    >
      {children}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <Inbox size={21} />
        </span>
        <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
export function Pagination({ total = 0 }: { total?: number }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        Showing 1–{Math.min(total, 10)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="secondary" className="size-9 p-0" disabled>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="secondary" className="size-9 p-0">
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
export function TableSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-label="Loading table">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="h-11 animate-pulse rounded-lg bg-slate-100" key={index} />
      ))}
    </div>
  );
}
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
export function DashboardChartCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ConfirmDialog({
  trigger,
  title,
  description,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  onConfirm?: () => void;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <Dialog.Title className="font-semibold text-slate-950">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-slate-500">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button variant="danger" onClick={onConfirm}>
                Confirm
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Sheet({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close">
              <X />
            </Dialog.Close>
          </div>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
