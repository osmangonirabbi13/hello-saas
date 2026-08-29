'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, ScanBarcode, X } from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { appendUniqueSerial, parseSerials } from '@/lib/transaction-scanner';

type SerialEntryProps = {
  value: string;
  onChange: (value: string) => void;
  required: number;
  productName?: string;
  available?: readonly string[];
  mode: 'receive' | 'select';
};

export function SerialEntry({
  value,
  onChange,
  required,
  productName,
  available,
  mode,
}: SerialEntryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState('');
  const serials = parseSerials(value);
  const add = (raw: string) => {
    const serial = raw.trim();
    if (!serial) return;
    if (required > 0 && serials.length >= required) {
      setFeedback(`Required count reached. Remove a serial before adding ${serial}.`);
      return;
    }
    const next = appendUniqueSerial(value, serial);
    if (!next.added) {
      setFeedback(`${serial} is already selected.`);
      return;
    }
    if (mode === 'select' && available && !available.includes(serial)) {
      setFeedback(`${serial} is unavailable for this product and warehouse.`);
      return;
    }
    onChange(next.value);
    setFeedback(`${serial} ${mode === 'receive' ? 'received' : 'selected'}.`);
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.focus();
  };
  const scanner = useBarcodeScanner({ onScan: add });
  const complete = required > 0 && serials.length === required;
  return (
    <section className="space-y-3" aria-label={`${productName ?? 'Product'} Serial or IMEI entry`}>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {mode === 'receive' ? 'Receive' : 'Select'} Serial / IMEI
            </p>
            <p className="text-xs text-slate-500">Scan or type one value, then press Enter.</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {serials.length} / {required} {complete ? 'complete' : 'required'}
          </span>
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">Serial or IMEI</span>
          <ScanBarcode
            className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700"
            size={18}
          />
          <input
            ref={inputRef}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="Serial / IMEI + Enter"
            onKeyDown={scanner.onKeyDown}
          />
        </label>
        {feedback && (
          <p aria-live="polite" className="mt-2 text-xs text-slate-700">
            {feedback}
          </p>
        )}
      </div>
      {available && available.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Available in stock
          </p>
          <div className="flex flex-wrap gap-2">
            {available.map((serial) => (
              <button
                key={serial}
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:border-emerald-500"
                onClick={() => add(serial)}
              >
                {serial}
              </button>
            ))}
          </div>
        </div>
      )}
      {serials.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {serials.map((serial) => (
            <span
              key={serial}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800"
            >
              {complete && <CheckCircle2 size={13} />}
              {serial}
              <button
                type="button"
                aria-label={`Remove ${serial}`}
                onClick={() => onChange(serials.filter((item) => item !== serial).join('\n'))}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
