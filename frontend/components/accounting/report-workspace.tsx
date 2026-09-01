'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { accountingApi, type ChartAccount, type FiscalPeriod } from '@/lib/api/accounting';
const taka = (v: string | number) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(Number(v));
const input = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm';
export function LedgerWorkspace() {
  const [data, setData] = useState<Awaited<ReturnType<typeof accountingApi.ledger>> | null>(null),
    [accounts, setAccounts] = useState<ChartAccount[]>([]),
    [periods, setPeriods] = useState<FiscalPeriod[]>([]),
    [account, setAccount] = useState(''),
    [period, setPeriod] = useState(''),
    [source, setSource] = useState(''),
    [search, setSearch] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const load = async () => {
    const q = new URLSearchParams();
    if (account) q.set('accountId', account);
    if (period) q.set('fiscalPeriodId', period);
    if (source) q.set('sourceType', source);
    if (search) q.set('search', search);
    if (from) q.set('dateFrom', from);
    if (to) q.set('dateTo', to);
    const [r, a, p] = await Promise.all([
      accountingApi.ledger('?' + q.toString()),
      accountingApi.accounts(),
      accountingApi.periods(),
    ]);
    setData(r);
    setAccounts(a);
    setPeriods(p);
  };
  useEffect(() => {
    void load();
  }, [account, period, source, search, from, to]);
  const opening = account ? (data?.openingBalances[account] ?? '0') : '0';
  const closing = account ? (data?.closingBalances[account] ?? opening) : '0';
  return (
    <Report
      title="General Ledger"
      description="Posted journal lines with natural-balance running totals."
    >
      <div className="sticky top-0 z-10 grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Filter label="Account">
          <select
            className={'w-full ' + input}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Fiscal Period">
          <select
            className={'w-full ' + input}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="">All periods</option>
            {periods.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} Â· {item.status}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Source type">
          <input
            className={'w-full ' + input}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="SALE, PURCHASE…"
          />
        </Filter>
        <Filter label="Search">
          <input
            className={'w-full ' + input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="JRN, source or description"
          />
        </Filter>
        <Filter label="From">
          <input
            type="date"
            className={'w-full ' + input}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Filter>
        <Filter label="To">
          <input
            type="date"
            className={'w-full ' + input}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Filter>
        <div className="flex items-end">
          <button
            onClick={() => {
              setAccount('');
              setPeriod('');
              setSource('');
              setSearch('');
              setFrom('');
              setTo('');
            }}
            className="min-h-11 rounded-lg border px-4 text-sm"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-500">Opening Balance</p>
          <p className="font-mono font-semibold tabular-nums">
            {account ? taka(opening) : 'Select one account'}
          </p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-500">Closing Balance</p>
          <p className="font-mono font-semibold tabular-nums">
            {account ? taka(closing) : 'Select one account'}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="border-b bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th>JRN</th>
              <th>Source</th>
              <th>Description</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
              <th className="pr-3 text-right">Running</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2">{new Date(r.journalEntry.date).toLocaleDateString()}</td>
                <td>
                  <Link
                    className="font-mono text-emerald-800 hover:underline"
                    href={'/accounting/journals/' + r.journalEntry.id}
                  >
                    {r.journalEntry.journalNumber}
                  </Link>
                </td>
                <td>{r.journalEntry.sourceType}</td>
                <td>{r.description ?? r.journalEntry.memo}</td>
                <td className="text-right font-mono">{taka(r.debit)}</td>
                <td className="text-right font-mono">{taka(r.credit)}</td>
                <td className="pr-3 text-right font-mono font-semibold">
                  {taka(r.runningBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Report>
  );
}
export function TrialBalanceWorkspace() {
  const [data, setData] = useState<Awaited<ReturnType<typeof accountingApi.trial>> | null>(null);
  useEffect(() => {
    void accountingApi.trial().then(setData);
  }, []);
  return (
    <Report title="Trial Balance" description="Control totals from posted journal lines only.">
      {data ? (
        <>
          {' '}
          {!data.balanced ? (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900"
            >
              <AlertTriangle size={18} />
              Accounting integrity warning: total debits and credits differ.
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[650px] w-full text-sm">
              <thead className="border-b bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-3">Code</th>
                  <th>Account</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="pr-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.account.id} className="border-b">
                    <td className="px-3 py-2 font-mono">{r.account.code}</td>
                    <td>{r.account.name}</td>
                    <td className="text-right font-mono">{taka(r.debit)}</td>
                    <td className="text-right font-mono">{taka(r.credit)}</td>
                    <td className="pr-3 text-right font-mono">
                      {taka(Number(r.debit) - Number(r.credit))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="px-3 py-3" colSpan={2}>
                    Totals · Difference {taka(Number(data.totalDebit) - Number(data.totalCredit))}
                  </td>
                  <td className="text-right font-mono">{taka(data.totalDebit)}</td>
                  <td className="text-right font-mono">{taka(data.totalCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <p aria-live="polite">Loading trial balance…</p>
      )}
    </Report>
  );
}
export function ProfitLossWorkspace() {
  const [data, setData] = useState<Awaited<ReturnType<typeof accountingApi.pnl>> | null>(null);
  useEffect(() => {
    void accountingApi.pnl().then(setData);
  }, []);
  if (!data) return <p aria-live="polite">Loading Profit & Loss…</p>;
  const revenues = data.rows.filter((r) => r.account.accountType === 'REVENUE'),
    expenses = data.rows.filter(
      (r) => r.account.accountType === 'EXPENSE' && r.account.systemKey !== 'COGS',
    );
  return (
    <Report
      title="Profit & Loss"
      description="Ledger-derived financial statement; no raw Sale, Purchase, or Expense totals."
    >
      <StatementSection
        title="Revenue"
        rows={revenues}
        value={(r) => Number(r.credit) - Number(r.debit)}
        totalLabel="Total Revenue"
        total={data.revenue}
      />
      <StatementLine label="Cost of Goods Sold" value={-Number(data.cogs)} />
      <StatementLine label="Gross Profit" value={Number(data.grossProfit)} strong />
      <StatementSection
        title="Operating Expenses"
        rows={expenses}
        value={(r) => -(Number(r.debit) - Number(r.credit))}
        totalLabel="Total Operating Expenses"
        total={-Number(data.operatingExpenses)}
      />
      <StatementLine label="Net Profit" value={Number(data.netProfit)} strong />
    </Report>
  );
}
function Report({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </header>
      {children}
    </div>
  );
}
function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
function StatementSection({
  title,
  rows,
  value,
  totalLabel,
  total,
}: {
  title: string;
  rows: Array<{ account: ChartAccount; debit: string; credit: string }>;
  value: (row: { account: ChartAccount; debit: string; credit: string }) => number;
  totalLabel: string;
  total: string | number;
}) {
  return (
    <section className="rounded-xl border bg-white">
      <h2 className="border-b bg-slate-50 px-4 py-3 font-semibold">{title}</h2>
      {rows.map((r) => (
        <StatementLine key={r.account.id} label={r.account.name} value={value(r)} />
      ))}
      <StatementLine label={totalLabel} value={Number(total)} strong />
    </section>
  );
}
function StatementLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={
        'flex justify-between border-b px-4 py-2 last:border-0 ' +
        (strong ? 'font-semibold text-slate-950' : 'text-sm text-slate-700')
      }
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">
        {value < 0 ? '(' + taka(Math.abs(value)) + ')' : taka(value)}
      </span>
    </div>
  );
}
