'use client';

import { useCallback, useEffect, useRef } from 'react';
import { consumeScannerKey, isEditableTarget } from '@/lib/scanner';

type Options = { onScan: (value: string) => void; enabled?: boolean; captureGlobal?: boolean };

export function useBarcodeScanner({ onScan, enabled = true, captureGlobal = false }: Options) {
  const buffer = useRef('');
  const callback = useRef(onScan);
  callback.current = onScan;

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const outcome = consumeScannerKey(buffer.current, event.key);
    if (event.key === 'Enter') event.preventDefault();
    if (outcome.kind === 'scan') callback.current(outcome.value);
    buffer.current = outcome.kind === 'buffer' ? outcome.value : '';
  }, []);

  useEffect(() => {
    if (!enabled || !captureGlobal) return;
    const listener = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const outcome = consumeScannerKey(buffer.current, event.key);
      if (event.key === 'Enter' && buffer.current) event.preventDefault();
      if (outcome.kind === 'scan') callback.current(outcome.value);
      buffer.current = outcome.kind === 'buffer' ? outcome.value : '';
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [captureGlobal, enabled]);

  return { onKeyDown, reset: () => (buffer.current = '') };
}
