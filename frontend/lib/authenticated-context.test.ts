import { describe, expect, it } from 'vitest';
import { businessInitial, formatRole } from './authenticated-context';

describe('authenticated business identity', () => {
  it.each([
    ['Hello Shop', 'H'],
    ['Rahman Computer', 'R'],
    [' NananGhor Electronics', 'N'],
    ['বাংলা ব্যবসা', 'ব'],
    ['', 'B'],
  ])('creates a deterministic initial for %s', (name, expected) => {
    expect(businessInitial(name)).toBe(expected);
  });

  it('formats access roles independently from the business name', () => {
    expect(formatRole('WAREHOUSE_MANAGER')).toBe('Warehouse Manager');
  });
});
