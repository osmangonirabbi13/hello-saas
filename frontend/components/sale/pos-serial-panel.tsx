'use client';

import { X } from 'lucide-react';
import { SerialEntry } from '@/components/scanner/serial-entry';
import type { SaleProduct } from '@/lib/api/sales';

export function PosSerialPanel({
  product,
  selected,
  onChange,
  onClose,
}: {
  product: SaleProduct;
  selected: string[];
  onChange: (serials: string[]) => void;
  onClose: () => void;
}) {
  const available = product.serials.filter((serial) => !selected.includes(serial));
  return (
    <section
      className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
      aria-label={`${product.name} serial selection`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-950">{product.name}</p>
          <p className="mt-0.5 text-sm font-semibold text-amber-700">Serial / IMEI required</p>
        </div>
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          aria-label="Close serial selection"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {available.length === 0 && selected.length === 0 ? (
        <p className="mt-3 rounded-lg bg-white p-3 text-sm text-amber-800" role="status">
          No available Serial / IMEI for this product.
        </p>
      ) : (
        <div className="mt-3">
          <SerialEntry
            mode="select"
            productName={product.name}
            required={selected.length + 1}
            available={available}
            value={selected.join('\n')}
            onChange={(value) => onChange(value.split(/\n/).filter(Boolean))}
          />
        </div>
      )}
      <p className="mt-3 text-xs text-slate-600">
        Each selected serial adds exactly one unit. Final availability, product, warehouse, tenant,
        and status are validated by the API.
      </p>
    </section>
  );
}
