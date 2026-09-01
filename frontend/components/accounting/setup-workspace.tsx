'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  accountingApi,
  type ChartAccount,
  type ExpenseCategory,
  type FinancialAccount,
  type FiscalPeriod,
} from '@/lib/api/accounting';
const label = 'block text-sm font-medium text-slate-700';
const control =
  'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
export function SetupWorkspace() {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]),
    [financial, setFinancial] = useState<FinancialAccount[]>([]),
    [categories, setCategories] = useState<ExpenseCategory[]>([]),
    [periods, setPeriods] = useState<FiscalPeriod[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = async () => {
    setError('');
    try {
      const [a, f, c, p] = await Promise.all([
        accountingApi.accounts(),
        accountingApi.financialAccounts(),
        accountingApi.expenseCategories(),
        accountingApi.periods(),
      ]);
      setAccounts(a);
      setFinancial(f);
      setCategories(c);
      setPeriods(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load accounting setup.');
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const assets = accounts.filter(
      (a) => a.accountType === 'ASSET' && a.isActive && a.allowManualPosting,
    ),
    expenses = accounts.filter(
      (a) => a.accountType === 'EXPENSE' && a.isActive && a.allowManualPosting,
    );
  const required = [
    'ACCOUNTS_RECEIVABLE',
    'INVENTORY',
    'ACCOUNTS_PAYABLE',
    'VAT_PAYABLE',
    'SALES_REVENUE',
    'COGS',
  ];
  const missing = required.filter(
    (key) => !accounts.some((a) => a.systemKey === key && a.isActive),
  );
  const unmappedFinancial = financial.filter((a) => !a.chartAccountId),
    unmappedCategories = categories.filter((a) => !a.chartAccountId),
    open = periods.filter((p) => p.status === 'OPEN');
  const ready =
    accounts.length > 0 &&
    !missing.length &&
    !unmappedFinancial.length &&
    !unmappedCategories.length &&
    open.length > 0;
  const initialize = async () => {
    setBusy(true);
    setError('');
    try {
      await accountingApi.initialize(1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Initialization failed.');
    } finally {
      setBusy(false);
    }
  };
  const map = async (kind: 'financial' | 'expense', id: string, value: string) => {
    if (!value) return;
    setBusy(true);
    try {
      if (kind === 'financial') await accountingApi.mapFinancial(id, value);
      else await accountingApi.mapExpense(id, value);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mapping failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <Header />
      <div aria-live="polite">
        {error ? (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            <AlertCircle size={18} />
            {error}
          </div>
        ) : null}
      </div>
      <Step n="1" title="Initialize Accounting" done={accounts.length > 0}>
        <p className="text-sm text-slate-600">
          Creates the default chart, settings, and current fiscal period without duplicating
          existing accounts.
        </p>
        <button
          disabled={busy}
          onClick={() => void initialize()}
          className="mt-3 min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="inline animate-spin" size={16} /> : null}{' '}
          {accounts.length ? 'Validate initialization' : 'Initialize Accounting'}
        </button>
      </Step>
      <Step n="2" title="Review Chart of Accounts" done={!missing.length && accounts.length > 0}>
        <p className="text-sm text-slate-600">
          {accounts.length} accounts configured.{' '}
          {missing.length
            ? `Missing required mappings: ${missing.join(', ')}`
            : 'Required control accounts are active.'}
        </p>
      </Step>
      <Step n="3" title="Map Financial Accounts" done={!unmappedFinancial.length}>
        <MappingRows rows={financial} accounts={assets} kind="financial" onMap={map} />
      </Step>
      <Step n="4" title="Map Expense Categories" done={!unmappedCategories.length}>
        <MappingRows rows={categories} accounts={expenses} kind="expense" onMap={map} />
      </Step>
      <Step n="5" title="Fiscal Period" done={open.length > 0}>
        <div className="space-y-2">
          {periods.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                <strong>{p.name}</strong> · {new Date(p.startDate).toLocaleDateString()}–
                {new Date(p.endDate).toLocaleDateString()}
              </span>
              <span className="font-medium">{p.status}</span>
            </div>
          ))}
        </div>
        <PeriodForm onSaved={load} />
      </Step>
      <Step n="6" title="Ready" done={ready}>
        <p className="text-sm text-slate-700">
          {ready
            ? 'Accounting is configured for authoritative posting.'
            : 'Complete every flagged mapping and open-period requirement before relying on automatic accounting.'}
        </p>
      </Step>
    </div>
  );
}
function Header() {
  return (
    <header>
      <p className="text-sm font-semibold text-emerald-700">Accounting control center</p>
      <h1 className="text-2xl font-semibold text-slate-950">Accounting Setup</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Review each server-authoritative requirement. Completion is never inferred from frontend
        state.
      </p>
    </header>
  );
}
function Step({
  n,
  title,
  done,
  children,
}: {
  n: string;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-sm font-semibold">
          {n}
        </span>
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium">
          {done ? (
            <>
              <CheckCircle2 size={16} className="text-emerald-700" />
              Complete
            </>
          ) : (
            <>
              <AlertCircle size={16} className="text-amber-700" />
              Action required
            </>
          )}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function MappingRows({
  rows,
  accounts,
  kind,
  onMap,
}: {
  rows: Array<FinancialAccount | ExpenseCategory>;
  accounts: ChartAccount[];
  kind: 'financial' | 'expense';
  onMap: (kind: 'financial' | 'expense', id: string, value: string) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      {rows.length ? (
        rows.map((row) => (
          <div
            key={row.id}
            className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1.5fr]"
          >
            <div>
              <p className="font-medium text-slate-900">{row.name}</p>
              <p className="text-xs text-slate-500">
                {row.chartAccountId ? 'Mapped' : 'Unmapped — posting blocked when required'}
              </p>
            </div>
            <label className={label}>
              Accounting account
              <select
                className={control}
                value={row.chartAccountId ?? ''}
                onChange={(e) => void onMap(kind, row.id, e.target.value)}
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-500">No records require mapping.</p>
      )}
    </div>
  );
}
function PeriodForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [name, setName] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [saving, setSaving] = useState(false);
  const valid = useMemo(
    () => name.trim().length >= 2 && start && end && end >= start,
    [name, start, end],
  );
  return (
    <form
      className="mt-4 grid gap-3 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        void accountingApi
          .createPeriod({ name, startDate: start, endDate: end })
          .then(() => {
            setName('');
            setStart('');
            setEnd('');
            return onSaved();
          })
          .finally(() => setSaving(false));
      }}
    >
      <label className={label}>
        Period name
        <input className={control} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={label}>
        Start date
        <input
          type="date"
          className={control}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label className={label}>
        End date
        <input
          type="date"
          className={control}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <button
        disabled={!valid || saving}
        className="min-h-11 self-end rounded-lg border border-slate-300 px-4 text-sm font-semibold disabled:opacity-50"
      >
        Create period
      </button>
    </form>
  );
}
