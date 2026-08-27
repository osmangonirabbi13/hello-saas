import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Menu,
  PackageCheck,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { MarketingMotion } from './marketing-motion';
import { plans } from '@/lib/plans';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8"
        aria-label="Primary navigation"
      >
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-slate-950">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white">
            <Store size={18} />
          </span>
          Hello Shop
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <Link href="/features">Features</Link>
          <Link href="/#workflows">Solutions</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/features">Resources</Link>
          <Link href="/login">Sign in</Link>
        </div>
        <Link
          href="/register"
          className="hidden rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 sm:block"
        >
          Start free trial
        </Link>
        <details className="relative md:hidden">
          <summary
            className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-200"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </summary>
          <div className="absolute right-0 top-13 grid min-w-52 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <Link className="rounded-lg px-3 py-2" href="/features">
              Features
            </Link>
            <Link className="rounded-lg px-3 py-2" href="/#workflows">
              Solutions
            </Link>
            <Link className="rounded-lg px-3 py-2" href="/pricing">
              Pricing
            </Link>
            <Link className="rounded-lg px-3 py-2" href="/login">
              Sign in
            </Link>
            <Link
              className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white"
              href="/register"
            >
              Start free trial
            </Link>
          </div>
        </details>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t bg-slate-950 py-10 text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>© 2026 Hello Shop. Built for modern Bangladesh commerce.</p>
        <div className="flex gap-5">
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

const features = [
  {
    icon: Boxes,
    title: 'Inventory that stays accountable',
    text: 'Track stock by warehouse with auditable movements, low-stock signals, and server-side controls.',
  },
  {
    icon: ScanBarcode,
    title: 'Barcode and IMEI workflows',
    text: 'Move quickly at purchase, sale, and POS while keeping serialized items exact and traceable.',
  },
  {
    icon: BarChart3,
    title: 'Decisions from one workspace',
    text: 'See sales, dues, stock exposure, and operational actions without stitching together spreadsheets.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by business',
    text: 'Tenant context and permissions are resolved by the API—not trusted from the browser.',
  },
];

export function FeatureGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {features.map(({ icon: Icon, title, text }) => (
        <article
          data-reveal
          key={title}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Icon size={21} />
          </span>
          <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
          <p className="mt-2 leading-7 text-slate-600">{text}</p>
        </article>
      ))}
    </div>
  );
}

export function PricingGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <article
          data-reveal
          key={plan.name}
          className={`relative rounded-2xl border p-6 ${plan.featured ? 'border-emerald-500 bg-slate-950 text-white shadow-xl' : 'border-slate-200 bg-white text-slate-950 shadow-sm'}`}
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
          <p className="mt-6 text-3xl font-black">
            {plan.monthly}
            <span className="text-sm font-normal opacity-60">
              {' '}
              {plan.monthly.startsWith('৳') ? '/month' : ''}
            </span>
          </p>
          <p
            className={
              plan.featured ? 'mt-1 text-xs text-slate-300' : 'mt-1 text-xs text-slate-500'
            }
          >
            {plan.yearly} {plan.yearly.startsWith('৳') ? '/year' : ''} · {plan.users}
          </p>
          <Link
            href="/register"
            className={`mt-6 flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold ${plan.featured ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-600 text-white'}`}
          >
            Start 7-Day Free Trial
          </Link>
          <ul className="mt-6 space-y-3 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 shrink-0 text-emerald-500" size={16} />
                {feature}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-current/10 pt-4 text-xs opacity-70">
            No credit card · No installation fee at launch
          </p>
        </article>
      ))}
    </div>
  );
}

function ProductProof() {
  const workflows = [
    ['Dashboard', 'Sales, purchase, stock alerts and recent activity in one operational view.'],
    ['Fast POS', 'Barcode-first cart, walk-in customer, payment and due visibility.'],
    ['Purchase', 'Supplier receiving with warehouse, costs and Serial / IMEI capture.'],
    ['Inventory', 'Auditable warehouse stock movements and low-stock attention.'],
  ];
  return (
    <section
      id="workflows"
      className="scroll-mt-20 border-y border-slate-200 bg-slate-950 py-20 text-white"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div data-reveal className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-400">
            Real product workflows
          </p>
          <h2 className="mt-3 text-3xl font-black">See how work moves through Hello Shop.</h2>
          <p className="mt-3 leading-7 text-slate-300">
            These previews reflect currently implemented product areas—without invented customers,
            transaction claims, or unavailable modules.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {workflows.map(([title, text]) => (
            <article
              data-reveal
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="mb-5 h-24 rounded-xl border border-white/10 bg-[linear-gradient(145deg,rgba(16,185,129,.18),rgba(255,255,255,.03))] p-3">
                <div className="h-2 w-16 rounded bg-emerald-400/70" />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <i className="h-12 rounded bg-white/10" />
                  <i className="h-12 rounded bg-white/10" />
                  <i className="h-12 rounded bg-white/10" />
                </div>
              </div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScannerStory() {
  const steps = [
    [ScanBarcode, 'Scan', 'Barcode or IMEI received'],
    [PackageCheck, 'Add', 'Product and stock state resolved'],
    [ShoppingCart, 'Sell', 'Cart ready for secure posting'],
  ] as const;
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <div data-reveal className="text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          Scanner-first workflow
        </p>
        <h2 className="mt-3 text-4xl font-black text-slate-950">Scan. Add. Sell.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Standard keyboard scanners work with focused barcode fields; serialized sales require a
          sellable IN_STOCK Serial or IMEI.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map(([Icon, title, text], index) => (
          <article
            data-reveal
            className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            key={title}
          >
            <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon size={21} />
            </span>
            <span className="absolute right-5 top-5 text-xs font-black text-slate-300">
              0{index + 1}
            </span>
            <h3 className="mt-5 text-xl font-black">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MarketingPage({ kind = 'home' }: { kind?: 'home' | 'features' | 'pricing' }) {
  const title =
    kind === 'features'
      ? 'Everything your shop needs to operate with confidence.'
      : kind === 'pricing'
        ? 'Simple plans. Seven days to prove the value.'
        : 'আপনার ব্যবসার বিক্রয়, স্টক ও হিসাব—সব এক জায়গায়।';
  return (
    <MarketingMotion>
      <MarketingNav />
      <main>
        <section className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_#d1fae5,_transparent_35%)]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
            <div className="self-center">
              <p
                data-hero
                className="text-sm font-bold uppercase tracking-[.18em] text-emerald-700"
              >
                Bangladesh-ready ERP & POS
              </p>
              <h1
                data-hero
                className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-6xl"
              >
                {title}
              </h1>
              <p data-hero className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Modern ERP, POS, Inventory, Barcode and Serial/IMEI workflows—built for Bangladesh
                businesses.
              </p>
              <div data-hero className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white"
                >
                  ৭ দিনের ফ্রি ট্রায়াল শুরু করুন <ArrowRight size={17} />
                </Link>
                <Link
                  href="/features"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800"
                >
                  সফটওয়্যারটি দেখুন
                </Link>
              </div>
              <p data-hero className="mt-4 text-sm text-slate-500">
                7-day free trial · No credit card · Setup in minutes
              </p>
            </div>
            <div
              data-hero
              className="rounded-3xl border border-slate-200 bg-slate-950 p-4 shadow-2xl"
            >
              <div className="rounded-2xl bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Today
                    </p>
                    <h2 className="mt-1 text-xl font-bold">Business overview</h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    All systems ready
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Metric label="Net sales" value="৳128,450" />
                  <Metric label="Stock alerts" value="12" />
                  <Metric label="Receivables" value="৳31,200" />
                  <Metric label="Orders" value="84" />
                </div>
                <div className="mt-4 h-28 rounded-xl bg-[linear-gradient(135deg,#ecfdf5,#f8fafc)] p-4">
                  <div className="flex h-full items-end gap-2">
                    {[35, 55, 42, 76, 58, 88, 72, 94].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className="flex-1 rounded-t bg-emerald-500"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {kind === 'home' && <ProductProof />}
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div data-reveal className="mb-10 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
              Operational foundation
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              Less uncertainty. More control.
            </h2>
          </div>
          <FeatureGrid />
        </section>
        {kind === 'home' && <ScannerStory />}
        {kind !== 'features' && (
          <section className="bg-slate-50">
            <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
              <div data-reveal className="mb-10 text-center">
                <h2 className="text-3xl font-black text-slate-950">
                  Choose the pace that fits your business
                </h2>
                <p className="mt-3 text-slate-600">
                  All trials are created securely by the server and last seven days.
                </p>
              </div>
              <PricingGrid />
            </div>
          </section>
        )}
      </main>
      <MarketingFooter />
    </MarketingMotion>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
