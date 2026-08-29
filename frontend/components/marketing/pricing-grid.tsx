'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { plans } from '@/lib/plans';
import { priceForPeriod, type BillingPeriod } from '@/lib/pricing';

export function PricingPeriodGrid() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  return (
    <div>
      <div className="mb-7 flex justify-center">
        <div
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          role="group"
          aria-label="Billing period"
        >
          {(['monthly', 'yearly'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`min-h-10 rounded-lg px-4 text-sm font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${period === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {value}
              {value === 'yearly' && (
                <span className="ml-2 text-xs text-emerald-600">Save 2 months</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const price = priceForPeriod(plan, period);
          const priced = price.startsWith('৳');
          return (
            <article
              key={plan.name}
              className={`relative flex h-full flex-col rounded-2xl border p-6 ${plan.featured ? 'border-emerald-500 bg-slate-950 text-white shadow-xl' : 'border-slate-200 bg-white text-slate-950 shadow-sm'}`}
            >
              {plan.featured && (
                <span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p
                className={`mt-2 min-h-12 text-sm leading-6 ${plan.featured ? 'text-slate-300' : 'text-slate-600'}`}
              >
                {plan.description}
              </p>
              <p className="mt-6 min-h-10 text-3xl font-black">
                {price}
                <span className="text-sm font-normal opacity-60">
                  {priced ? `/${period === 'yearly' ? 'year' : 'month'}` : ''}
                </span>
              </p>
              <p
                className={`mt-1 min-h-5 text-xs ${plan.featured ? 'text-slate-300' : 'text-slate-500'}`}
              >
                {period === 'yearly' && priced ? 'Save 2 months · ' : ''}
                {plan.users}
              </p>
              <Link
                href="/register"
                className={`mt-6 flex min-h-11 items-center justify-center rounded-xl px-4 py-3 text-sm font-bold ${plan.featured ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-600 text-white'}`}
              >
                Start 7-Day Free Trial
              </Link>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 shrink-0 text-emerald-500" size={16} />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-current/10 pt-4 text-xs opacity-70">
                No credit card required · No installation fee at launch
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
