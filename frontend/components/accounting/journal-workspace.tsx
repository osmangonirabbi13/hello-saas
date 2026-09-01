'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  accountingApi,
  type ChartAccount,
  type FiscalPeriod,
  type Journal,
} from '@/lib/api/accounting';
type DraftLine = {
  accountId: string;
  accountSearch: string;
  description: string;
  debit: string;
  credit: string;
};
const control =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const money = (v: string) => {
  const [w = '0', f = ''] = v.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0').slice(0, 2));
};
const fmt = (c: number) => (c / 100).toFixed(2);
export function JournalWorkspace() {
  const [rows, setRows] = useState<Journal[]>([]),
    [accounts, setAccounts] = useState<ChartAccount[]>([]),
    [periods, setPeriods] = useState<FiscalPeriod[]>([]),
    [editor, setEditor] = useState(false),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [source, setSource] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const load = async (query = '') => {
    const [j, a, p] = await Promise.all([
      accountingApi.journals(query),
      accountingApi.accounts(),
      accountingApi.periods(),
    ]);
    setRows(j);
    setAccounts(a);
    setPeriods(p);
  };
  useEffect(() => {
    void load();
  }, []);
  const shown = rows;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Journals</h1>
          <p className="text-sm text-slate-600">
            Balanced accounting history and controlled manual entries.
          </p>
        </div>
        <button
          onClick={() => setEditor(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white"
        >
          <Plus size={17} />
          Manual journal
        </button>
      </header>
      {editor ? (
        <JournalEditor
          accounts={accounts}
          periods={periods}
          onClose={() => setEditor(false)}
          onSaved={() => load()}
        />
      ) : null}
      <div className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs font-medium">
          Search
          <input
            className={'mt-1 ' + control}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="JRN or memo"
          />
        </label>
        <label className="text-xs font-medium">
          From date
          <input
            type="date"
            className={'mt-1 ' + control}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          To date
          <input
            type="date"
            className={'mt-1 ' + control}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white"
            onClick={() => {
              const query = new URLSearchParams();
              if (search) query.set('search', search);
              if (status) query.set('status', status);
              if (source) query.set('sourceType', source);
              if (from) query.set('dateFrom', from);
              if (to) query.set('dateTo', to);
              void load('?' + query.toString());
            }}
          >
            Apply
          </button>
          <button
            className="min-h-11 rounded-lg border px-3 text-sm"
            onClick={() => {
              setSearch('');
              setStatus('');
              setSource('');
              setFrom('');
              setTo('');
              void load();
            }}
          >
            Reset
          </button>
        </div>
        <label className="text-xs font-medium">
          Status
          <select
            className={'mt-1 ' + control}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option>DRAFT</option>
            <option>POSTED</option>
            <option>REVERSED</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          Source type
          <select
            className={'mt-1 ' + control}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">All</option>
            {[...new Set(rows.map((r) => r.sourceType))].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[850px] w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-3">JRN No</th>
              <th>Date</th>
              <th>Source</th>
              <th>Memo</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
              <th>Status</th>
              <th>Created by</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const debit = r.lines.reduce((s, l) => s + money(l.debit), 0),
                credit = r.lines.reduce((s, l) => s + money(l.credit), 0);
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      className="font-mono font-semibold text-emerald-800 underline-offset-2 hover:underline"
                      href={'/accounting/journals/' + r.id}
                    >
                      {r.journalNumber}
                    </Link>
                  </td>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>{r.sourceType}</td>
                  <td className="max-w-72 truncate">{r.memo}</td>
                  <td className="text-right font-mono tabular-nums">{fmt(debit)}</td>
                  <td className="text-right font-mono tabular-nums">{fmt(credit)}</td>
                  <td>{r.status}</td>
                  <td>{r.createdBy?.displayName ?? 'â€”'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No journals match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
function JournalEditor({
  accounts,
  periods,
  onClose,
  onSaved,
  journal,
}: {
  accounts: ChartAccount[];
  periods: FiscalPeriod[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  journal?: Journal;
}) {
  const [date, setDate] = useState(
      journal?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    ),
    [fiscalPeriodId, setFiscalPeriodId] = useState(
      journal?.fiscalPeriodId ?? periods.find((p) => p.status === 'OPEN')?.id ?? '',
    ),
    [memo, setMemo] = useState(journal?.memo ?? ''),
    [lines, setLines] = useState<DraftLine[]>(
      journal?.lines.map((line) => ({
        accountId: line.accountId,
        accountSearch: '',
        description: line.description ?? '',
        debit: line.debit,
        credit: line.credit,
      })) ?? [
        { accountId: '', accountSearch: '', description: '', debit: '0', credit: '0' },
        { accountId: '', accountSearch: '', description: '', debit: '0', credit: '0' },
      ],
    ),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const debit = lines.reduce((s, l) => s + money(l.debit), 0),
    credit = lines.reduce((s, l) => s + money(l.credit), 0),
    difference = debit - credit,
    selectedPeriod = periods.find((period) => period.id === fiscalPeriodId),
    periodMatches =
      Boolean(selectedPeriod) &&
      date >= selectedPeriod!.startDate.slice(0, 10) &&
      date <= selectedPeriod!.endDate.slice(0, 10),
    valid =
      periodMatches &&
      memo.trim().length >= 2 &&
      lines.length >= 2 &&
      debit > 0 &&
      difference === 0 &&
      lines.every((l) => l.accountId && money(l.debit) > 0 !== money(l.credit) > 0);
  const set = (i: number, key: keyof DraftLine, value: string) =>
    setLines((old) => old.map((line, n) => (n === i ? { ...line, [key]: value } : line)));
  return (
    <section className="rounded-xl border border-emerald-200 bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">New manual journal</h2>
        <p className="text-xs text-slate-500">
          Save as draft first. Posting remains server-authoritative.
        </p>
      </div>
      <form
        className="p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          setSaving(true);
          setError('');
          const payload = {
            fiscalPeriodId,
            date,
            memo,
            lines: lines.map(({ accountId, description, debit, credit }) => ({
              accountId,
              description,
              debit,
              credit,
            })),
          };
          void (
            journal
              ? accountingApi.updateJournal(journal.id, payload)
              : accountingApi.createJournal(payload)
          )
            .then(onSaved)
            .then(onClose)
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Unable to save journal.');
            })
            .finally(() => setSaving(false));
        }}
      >
        {error ? (
          <div
            role="alert"
            tabIndex={-1}
            className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
          >
            {error}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Date
            <input
              type="date"
              className={'mt-1 ' + control}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Fiscal Period
            <select
              className={'mt-1 ' + control}
              value={fiscalPeriodId}
              onChange={(e) => setFiscalPeriodId(e.target.value)}
              required
            >
              <option value="">Select open period</option>
              {periods
                .filter((period) => period.status === 'OPEN')
                .map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Memo
            <input
              className={'mt-1 ' + control}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>
        {!periodMatches && fiscalPeriodId ? (
          <p role="alert" className="mt-2 text-sm font-medium text-rose-700">
            Journal date must fall inside the selected open fiscal period.
          </p>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-600">
                <th>Account</th>
                <th>Description</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input
                      role="combobox"
                      aria-expanded="true"
                      aria-controls={'account-options-' + i}
                      aria-label={'Search account line ' + (i + 1)}
                      placeholder="Search code or account"
                      className={control + ' mb-1'}
                      value={line.accountSearch}
                      onChange={(e) => set(i, 'accountSearch', e.target.value)}
                    />
                    <select
                      id={'account-options-' + i}
                      aria-label={'Account line ' + (i + 1)}
                      className={control}
                      value={line.accountId}
                      onChange={(e) => set(i, 'accountId', e.target.value)}
                    >
                      <option value="">Select account</option>
                      {accounts
                        .filter((a) => {
                          const query = line.accountSearch.toLowerCase();
                          return (
                            a.isActive &&
                            a.allowManualPosting &&
                            (!query || (a.code + ' ' + a.name).toLowerCase().includes(query))
                          );
                        })
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} â€” {a.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label={'Description line ' + (i + 1)}
                      className={control}
                      value={line.description}
                      onChange={(e) => set(i, 'description', e.target.value)}
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label={'Debit line ' + (i + 1)}
                      inputMode="decimal"
                      className={control + ' text-right font-mono'}
                      value={line.debit}
                      onChange={(e) => set(i, 'debit', e.target.value)}
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label={'Credit line ' + (i + 1)}
                      inputMode="decimal"
                      className={control + ' text-right font-mono'}
                      value={line.credit}
                      onChange={(e) => set(i, 'credit', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={lines.length <= 2}
                      aria-label={'Remove journal line ' + (i + 1)}
                      onClick={() => setLines((old) => old.filter((_, n) => n !== i))}
                      className="min-h-11 min-w-11 rounded-lg p-2 disabled:opacity-30"
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() =>
            setLines((old) => [
              ...old,
              { accountId: '', accountSearch: '', description: '', debit: '0', credit: '0' },
            ])
          }
          className="mt-2 min-h-11 rounded-lg border px-3 text-sm font-medium"
        >
          Add line
        </button>
        <div
          aria-live="polite"
          className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3"
        >
          <span>
            Total Debit <strong className="float-right font-mono">{fmt(debit)}</strong>
          </span>
          <span>
            Total Credit <strong className="float-right font-mono">{fmt(credit)}</strong>
          </span>
          <span>
            Difference{' '}
            <strong className="float-right font-mono">{fmt(Math.abs(difference))}</strong>
          </span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border px-4 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={!valid || saving}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Savingâ€¦' : journal ? 'Update Draft' : 'Save Draft'}
          </button>
        </div>
      </form>
    </section>
  );
}
export function JournalDetail({ id }: { id: string }) {
  const [row, setRow] = useState<Journal | null>(null),
    [accounts, setAccounts] = useState<ChartAccount[]>([]),
    [periods, setPeriods] = useState<FiscalPeriod[]>([]),
    [editing, setEditing] = useState(false),
    [error, setError] = useState('');
  const load = () =>
    accountingApi
      .journal(id)
      .then(setRow)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load journal.'));
  useEffect(() => {
    void load();
    void accountingApi.accounts().then(setAccounts);
    void accountingApi.periods().then(setPeriods);
  }, [id]);
  if (error) return <div role="alert">{error}</div>;
  if (!row) return <div aria-live="polite">Loading journalâ€¦</div>;
  const debit = row.lines.reduce((s, l) => s + money(l.debit), 0),
    credit = row.lines.reduce((s, l) => s + money(l.credit), 0);
  return (
    <div className="space-y-4">
      {editing && row.status === 'DRAFT' ? (
        <JournalEditor
          accounts={accounts}
          periods={periods}
          journal={row}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await load();
            setEditing(false);
          }}
        />
      ) : null}
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-emerald-800">{row.journalNumber}</p>
          <h1 className="text-2xl font-semibold">{row.memo}</h1>
          <p className="text-sm text-slate-600">
            {new Date(row.date).toLocaleDateString()} Â· {row.sourceType} Â· {row.status}
          </p>
        </div>
        {row.status === 'DRAFT' ? (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="min-h-11 rounded-lg border px-4 text-sm font-semibold"
            >
              Edit Draft
            </button>
            <button
              onClick={() => {
                void accountingApi.postJournal(row.id).then(load);
              }}
              className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white"
            >
              Post journal
            </button>
          </div>
        ) : row.status === 'POSTED' ? (
          <button
            onClick={() => {
              if (
                confirm('Create an exact reversing journal? Posted history will remain immutable.')
              ) {
                void accountingApi.reverseJournal(row.id).then(load);
              }
            }}
            className="min-h-11 rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-800"
          >
            Reverse journal
          </button>
        ) : null}
      </header>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[650px] w-full text-sm">
          <thead className="border-b bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-3">Account</th>
              <th>Description</th>
              <th className="text-right">Debit</th>
              <th className="pr-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {row.lines.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-3 py-2">
                  {l.account?.code} â€” {l.account?.name}
                </td>
                <td>{l.description ?? 'â€”'}</td>
                <td className="text-right font-mono">{l.debit}</td>
                <td className="pr-3 text-right font-mono">{l.credit}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-3 py-3" colSpan={2}>
                {debit === credit ? 'Balanced' : 'Integrity warning: imbalance'}
              </td>
              <td className="text-right font-mono">{fmt(debit)}</td>
              <td className="pr-3 text-right font-mono">{fmt(credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
