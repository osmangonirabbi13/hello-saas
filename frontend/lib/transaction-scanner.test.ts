import { describe, expect, it } from 'vitest';
import { appendUniqueSerial, applyProductScan } from './transaction-scanner';

const ordinary = { id: 'mouse', name: 'Mouse', barcode: '100', serialized: false };
const serialized = { id: 'phone', name: 'Phone', barcode: '200', serialized: true };

describe('transaction scanner state', () => {
  it('adds an ordinary product and increments its existing line', () => {
    const added = applyProductScan([], ordinary);
    expect(added.outcome).toBe('added');
    expect(applyProductScan(added.lines, ordinary).lines[0]?.quantity).toBe(2);
  });

  it('never blindly increments a serialized product', () => {
    const first = applyProductScan([], serialized);
    const repeated = applyProductScan(first.lines, serialized);
    expect(repeated.outcome).toBe('serial-required');
    expect(repeated.lines[0]?.quantity).toBe(1);
  });

  it('rejects duplicate serial selection', () => {
    expect(appendUniqueSerial('IMEI-1', 'IMEI-1')).toEqual({ value: 'IMEI-1', added: false });
    expect(appendUniqueSerial('IMEI-1', 'IMEI-2')).toEqual({
      value: 'IMEI-1\nIMEI-2',
      added: true,
    });
  });
});
