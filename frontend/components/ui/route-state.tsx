'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button, TableSkeleton } from './primitives';

export function RouteLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white" role="status" aria-live="polite">
      <p className="px-4 pt-4 text-sm font-semibold text-slate-600">{label}…</p>
      <TableSkeleton />
    </div>
  );
}

export function RouteError({
  title = 'Unable to load this page',
  reset,
}: {
  title?: string;
  reset: () => void;
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl border border-rose-200 bg-white p-8 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-700">
          <AlertCircle aria-hidden size={21} />
        </span>
        <h2 className="mt-4 font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Please try again. Technical details have not been exposed.
        </p>
        <Button className="mt-5" type="button" onClick={reset}>
          <RotateCcw size={16} />
          Try again
        </Button>
      </div>
    </div>
  );
}
