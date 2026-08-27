import { describe, expect, it } from 'vitest';
import { consumeScannerKey } from './scanner';

describe('keyboard scanner input', () => {
  it('emits a trimmed scan only when Enter terminates the buffer', () => {
    let buffer = '';
    for (const key of ' 890123 ') {
      const outcome = consumeScannerKey(buffer, key);
      buffer = outcome.kind === 'buffer' ? outcome.value : '';
    }
    expect(consumeScannerKey(buffer, 'Enter')).toEqual({ kind: 'scan', value: '890123' });
  });

  it('ignores control keys and clears on Escape', () => {
    expect(consumeScannerKey('12', 'Shift')).toEqual({ kind: 'buffer', value: '12' });
    expect(consumeScannerKey('12', 'Escape')).toEqual({ kind: 'idle' });
  });
});
