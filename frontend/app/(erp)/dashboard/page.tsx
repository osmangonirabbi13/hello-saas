import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  Boxes,
  ClipboardList,
  CreditCard,
  HandCoins,
  PackageSearch,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { DashboardAddMenu } from '@/components/dashboard-actions';
import { FinancialDistributionChart, TrendChart } from '@/components/dashboard-charts';
import {
  DashboardChartCard,
  DateRangeFilter,
  PageHeader,
  StatusBadge,
} from '@/components/ui/primitives';
import { StatCard } from '@/components/ui/stat-card';
import { demoDashboard } from '@/lib/demo/dashboard';

const quickActions = [
  ['New Sale', '/sales/new', ShoppingCart],
  ['POS', '/sales/pos', CreditCard],
  ['New Purchase', '/purchases/new', Boxes],
  ['Product', '/products', PackageSearch],
  ['Customer', '/customers', Users],
  ['Supplier', '/suppliers', HandCoins],
  ['Stock List', '/reports/stock-list', ShoppingBag],
  ['Reports', '/reports/stock-list', ClipboardList],
] as const;
const statIcons = [ShoppingCart, Boxes, ArrowUpRight, Banknote];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Sales, stock movement and payments that need your attention today."
        actions={
          <>
            <DateRangeFilter />
            <DashboardAddMenu />
          </>
        }
      />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Quick actions
          </h2>
          <span className="text-xs text-slate-400">Asia/Dhaka · BDT</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {quickActions.map(([label, href, Icon], index) => (
            <Link
              className={index < 2 ? 'group flex min-h-20 flex-col justify-between rounded-xl border border-emerald-700 bg-emerald-700 p-3 text-white transition hover:bg-emerald-800' : 'group flex min-h-20 flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-300 hover:shadow-sm'}
              href={href}
              key={label}
            >
              <Icon className={index < 2 ? 'text-emerald-100' : 'text-slate-400 transition group-hover:text-emerald-700'} size={19} />
              <span className={index < 2 ? 'text-xs font-bold text-white' : 'text-xs font-semibold text-slate-700'}>{label}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {demoDashboard.stats.map((stat, index) => (
          <StatCard {...stat} icon={statIcons[index]!} key={stat.title} />
        ))}
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {demoDashboard.secondary.map((metric) => (
          <article
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            key={metric.label}
          >
            <p className="text-xs text-slate-500">{metric.label}</p>
            <div className="mt-1.5 flex items-end justify-between">
              <strong className="text-lg text-slate-900">{metric.value}</strong>
              <small
                className={metric.delta.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}
              >
                {metric.delta}
              </small>
            </div>
          </article>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[.85fr_1.4fr]">
        <DashboardChartCard
          title="Financial distribution"
          description="Share of total movement this month"
        >
          <FinancialDistributionChart />
        </DashboardChartCard>
        <DashboardChartCard
          title="Last 30 days trend"
          description="Sales and purchase movement in thousands"
          action={
            <div className="flex gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full bg-emerald-600" />
                Sales
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full bg-blue-500" />
                Purchase
              </span>
            </div>
          }
        >
          <TrendChart />
        </DashboardChartCard>
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Needs attention</p><h2 className="mt-1 text-lg font-bold text-slate-950">Operational follow-up</h2></div><span className="text-xs text-slate-400">Demo data</span></div>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {demoDashboard.insights.map((item, index) => {
            const Icon = [CreditCard, ArrowDownToLine, PackageSearch, RotateCcw][index]!;
            return (
              <article className="rounded-xl border border-slate-200 bg-white p-4" key={item.label}>
                <Icon className="text-slate-400" size={18} />
                <p className="mt-4 text-xs text-slate-500">{item.label}</p>
                <strong className="mt-1 block text-lg text-slate-950">{item.value}</strong>
                <small className="text-[11px] text-slate-400">{item.note}</small>
              </article>
            );
          })}
        </div>
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <StatusBadge tone="success">Demo activity</StatusBadge>
          </div>
          <div className="divide-y divide-slate-100">
            {demoDashboard.activity.map((activity) => (
              <div className="flex gap-3 px-4 py-3" key={activity.title}>
                <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{activity.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{activity.meta}</p>
                </div>
                <time className="text-[10px] text-slate-400">{activity.time}</time>
              </div>
            ))}
          </div>
        </section>
        </div>
      </section>
    </div>
  );
}
