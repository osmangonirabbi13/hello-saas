import type { plans } from './plans';

export type BillingPeriod = 'monthly' | 'yearly';

export function priceForPeriod(plan: (typeof plans)[number], period: BillingPeriod) {
  return period === 'yearly' ? plan.yearly : plan.monthly;
}
