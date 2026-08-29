import { describe, expect, it } from 'vitest';
import { findProductForSerial, selectPosSerial, serializedCartQuantity } from './pos-serial';

const phone = {
  id: 'phone',
  name: 'Phone',
  serialized: true,
  available: 2,
  serials: ['IMEI-1', 'IMEI-2'],
};

describe('POS serialized selection', () => {
  it('resolves an IMEI to the correct product', () => {
    expect(findProductForSerial([phone], 'IMEI-2')?.id).toBe('phone');
  });

  it('requires unique serials and derives quantity from them', () => {
    const first = selectPosSerial({}, phone, 'IMEI-1');
    expect(first.outcome).toBe('selected');
    expect(serializedCartQuantity(first.selected, phone.id)).toBe(1);
    expect(selectPosSerial(first.selected, phone, 'IMEI-1').outcome).toBe('duplicate');
    const second = selectPosSerial(first.selected, phone, 'IMEI-2');
    expect(serializedCartQuantity(second.selected, phone.id)).toBe(2);
  });

  it('rejects serials absent from the server-provided sellable set', () => {
    expect(selectPosSerial({}, phone, 'SOLD-1').outcome).toBe('unavailable');
    expect(selectPosSerial({}, phone, 'DAMAGED-1').outcome).toBe('unavailable');
    expect(selectPosSerial({}, phone, 'RMA-1').outcome).toBe('unavailable');
    expect(selectPosSerial({}, phone, 'OTHER-WAREHOUSE-1').outcome).toBe('unavailable');
  });
});
