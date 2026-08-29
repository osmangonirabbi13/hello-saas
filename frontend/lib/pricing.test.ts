import { describe, expect, it } from 'vitest';
import { plans } from './plans';
import { priceForPeriod } from './pricing';

describe('centralized pricing periods', () => {
  it('uses monthly values from the centralized plan config', () => {
    expect(plans.slice(0, 3).map((plan) => priceForPeriod(plan, 'monthly'))).toEqual([
      '৳499',
      '৳999',
      '৳1,999',
    ]);
  });

  it('uses yearly values from the centralized plan config', () => {
    expect(plans.slice(0, 3).map((plan) => priceForPeriod(plan, 'yearly'))).toEqual([
      '৳4,990',
      '৳9,990',
      '৳19,990',
    ]);
    expect(priceForPeriod(plans[3], 'yearly')).toBe('Custom');
  });
});
