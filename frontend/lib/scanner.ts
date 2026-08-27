export type ScannerOutcome =
  { kind: 'idle' } | { kind: 'buffer'; value: string } | { kind: 'scan'; value: string };

export function consumeScannerKey(buffer: string, key: string): ScannerOutcome {
  if (key === 'Enter') {
    const value = buffer.trim();
    return value ? { kind: 'scan', value } : { kind: 'idle' };
  }
  if (key === 'Escape') return { kind: 'idle' };
  if (key.length !== 1 || key === '\n' || key === '\r') return { kind: 'buffer', value: buffer };
  return { kind: 'buffer', value: buffer + key };
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
