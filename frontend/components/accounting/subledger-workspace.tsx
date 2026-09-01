'use client';
import { useEffect, useState } from 'react';
import {
  accountingApi,
  type FinancialAccount,
  type PartyCredit,
  type Payable,
  type Receivable,
  type SubledgerPage,
} from '@/lib/api/accounting';
const input =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const taka = (v: string | number) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(Number(v));
export function SubledgerWorkspace({ kind }: { kind: 'receivable' | 'payable' }) {
  const [data, setData] = useState<SubledgerPage<Receivable | Payable> | null>(null),
    [financial, setFinancial] = useState<FinancialAccount[]>([]),
    [status, setStatus] = useState(''),
    [bucket, setBucket] = useState(''),
    [search, setSearch] = useState(''),
    [partyId, setPartyId] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [selected, setSelected] = useState<Receivable | Payable | null>(null),
    [selectedCredit, setSelectedCredit] = useState<PartyCredit | null>(null),
    [statement, setStatement] = useState<{ rows: unknown[]; availableCredit: string } | null>(null),
    [error, setError] = useState('');
  const load = async () => {
    setError('');
    try {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (bucket) query.set('ageBucket', bucket);
      if (search) query.set('search', search);
      if (partyId) query.set(kind === 'receivable' ? 'customerId' : 'supplierId', partyId);
      if (from) query.set('dateFrom', from);
      if (to) query.set('dateTo', to);
      const [d, f] = await Promise.all([
        kind === 'receivable'
          ? accountingApi.receivables('?' + query.toString())
          : accountingApi.payables('?' + query.toString()),
        accountingApi.financialAccounts(),
      ]);
      setData(d);
      setFinancial(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load subledger.');
    }
  };
  useEffect(() => {
    void load();
  }, [kind, status, bucket, search, partyId, from, to]);
  const title = kind === 'receivable' ? 'Receivables' : 'Payables';
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-600">
          Authoritative open items, allocations, and aging. Missing due dates fall back to the
          document date.
        </p>
      </header>
      {error ? (
        <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            {(
              [
                ['Total', 'total'],
                ['Current', 'CURRENT'],
                ['1â€“30', '1_30'],
                ['31â€“60', '31_60'],
                ['61â€“90', '61_90'],
                ['90+', '90_PLUS'],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {taka(data.summary[key])}
                </p>
              </div>
            ))}
          </div>
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-800">
                  {kind === 'receivable'
                    ? 'Available Customer Credit'
                    : 'Available Supplier Credit'}
                </p>
                <p className="font-mono text-lg font-semibold tabular-nums text-emerald-950">
                  {taka(data.availableCredit)}
                </p>
              </div>
              <p className="text-xs text-emerald-900">Credits are excluded from overdue aging.</p>
            </div>
            {data.credits.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-emerald-900">
                      <th>Document</th>
                      <th>Party</th>
                      <th className="text-right">Original</th>
                      <th className="text-right">Available</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.credits.map((credit) => (
                      <tr key={credit.id} className="border-t border-emerald-200">
                        <td className="py-2 font-mono">{credit.documentNumber}</td>
                        <td>
                          {credit.customer?.name ?? credit.supplier?.name ?? 'Walk-in sale credit'}
                        </td>
                        <td className="text-right font-mono">{taka(credit.originalAmount)}</td>
                        <td className="text-right font-mono font-semibold">
                          {taka(Number(credit.originalAmount) - Number(credit.appliedAmount))}
                        </td>
                        <td>{credit.status.replaceAll('_', ' ')}</td>
                        <td className="text-right">
                          <button
                            onClick={() => setSelectedCredit(credit)}
                            className="min-h-11 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold"
                          >
                            Apply Credit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-emerald-900">No available credits.</p>
            )}
          </section>
          <div className="sticky top-0 z-10 grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="text-xs font-medium">
              Search
              <input
                className={'mt-1 w-full ' + input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Document or party"
              />
            </label>
            <label className="text-xs font-medium">
              {kind === 'receivable' ? 'Customer' : 'Supplier'}
              <select
                className={'mt-1 w-full ' + input}
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
              >
                <option value="">All</option>
                {data.rows.map((row) => {
                  const receivable = 'sale' in row;
                  const id = receivable ? row.customerId : row.supplierId;
                  const name = receivable ? row.customer?.name : row.supplier.name;
                  return id && name ? (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ) : null;
                })}
              </select>
            </label>
            <label className="text-xs font-medium">
              Status
              <select
                className={'mt-1 w-full ' + input}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option>OPEN</option>
                <option>PARTIALLY_PAID</option>
                <option>PAID</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              From date
              <input
                type="date"
                className={'mt-1 w-full ' + input}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium">
              To date
              <input
                type="date"
                className={'mt-1 w-full ' + input}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                onClick={() => void load()}
                className="min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setSearch('');
                  setPartyId('');
                  setStatus('');
                  setBucket('');
                  setFrom('');
                  setTo('');
                }}
                className="min-h-11 rounded-lg border px-3 text-xs"
              >
                Reset
              </button>
            </div>
            <label className="text-xs font-medium">
              Age bucket
              <select
                className={'mt-1 w-full ' + input}
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
              >
                <option value="">All</option>
                <option value="CURRENT">Current</option>
                <option value="1_30">1â€“30</option>
                <option value="31_60">31â€“60</option>
                <option value="61_90">61â€“90</option>
                <option value="90_PLUS">90+</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[950px] w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">
                    {kind === 'receivable' ? 'Customer / Walk-in' : 'Supplier'}
                  </th>
                  <th>Document</th>
                  <th>Date / Due</th>
                  <th className="text-right">Original</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const receivable = 'sale' in row;
                  const name = receivable
                    ? (row.customer?.name ?? 'Walk-in customer')
                    : row.supplier.name;
                  const document = receivable
                    ? row.sale.invoiceNumber
                    : row.purchase.purchaseNumber;
                  const date = receivable ? row.sale.saleDate : row.purchase.purchaseDate;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{name}</td>
                      <td>{document}</td>
                      <td>
                        {new Date(date).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-slate-500">
                          Due{' '}
                          {row.dueDate
                            ? new Date(row.dueDate).toLocaleDateString()
                            : 'document date fallback'}
                        </span>
                      </td>
                      <td className="text-right font-mono">{taka(row.originalAmount)}</td>
                      <td className="text-right font-mono">{taka(row.settledAmount)}</td>
                      <td className="text-right font-mono font-semibold">
                        {taka(row.outstanding)}
                      </td>
                      <td>
                        {row.bucket.replaceAll('_', 'â€“')} Â· {row.ageDays}d
                      </td>
                      <td>{row.status}</td>
                      <td className="pr-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              void (
                                receivable
                                  ? accountingApi.receivableStatement(row.id)
                                  : accountingApi.payableStatement(row.id)
                              ).then(setStatement);
                            }}
                            className="min-h-10 rounded-lg border px-3 text-xs"
                          >
                            Statement
                          </button>
                          {Number(row.outstanding) > 0 ? (
                            <button
                              onClick={() => setSelected(row)}
                              className="min-h-10 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white"
                            >
                              {receivable ? 'Receive' : 'Pay'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div aria-live="polite">Loading {title.toLowerCase()}â€¦</div>
      )}
      {selected ? (
        <PaymentDialog
          kind={kind}
          row={selected}
          accounts={financial}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            await load();
          }}
        />
      ) : null}
      {selectedCredit && data ? (
        <CreditDialog
          kind={kind}
          credit={selectedCredit}
          rows={data.rows}
          onClose={() => setSelectedCredit(null)}
          onSaved={async () => {
            setSelectedCredit(null);
            await load();
          }}
        />
      ) : null}
      {statement ? (
        <StatementDialog
          rows={statement.rows}
          availableCredit={statement.availableCredit}
          onClose={() => setStatement(null)}
        />
      ) : null}
    </div>
  );
}
function PaymentDialog({
  kind,
  row,
  accounts,
  onClose,
  onSaved,
}: {
  kind: 'receivable' | 'payable';
  row: Receivable | Payable;
  accounts: FinancialAccount[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [financialAccountId, setAccount] = useState(''),
    [amount, setAmount] = useState(row.outstanding),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [reference, setReference] = useState(''),
    [notes, setNotes] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const remaining = Number(row.outstanding) - Number(amount),
    valid = financialAccountId && Number(amount) > 0 && remaining >= 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          setSaving(true);
          const payload = {
            financialAccountId,
            amount,
            date,
            reference: reference || null,
            notes: notes || null,
          };
          const request =
            kind === 'receivable'
              ? accountingApi.receivePayment(row.id, payload)
              : accountingApi.paySupplier(row.id, payload);
          void request
            .then(onSaved)
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Payment failed.');
            })
            .finally(() => setSaving(false));
        }}
        className="w-full max-w-xl rounded-xl bg-white p-5"
      >
        <h2 id="payment-title" className="text-lg font-semibold">
          {kind === 'receivable' ? 'Receive Customer Payment' : 'Pay Supplier'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Outstanding {taka(row.outstanding)}. This creates operational and accounting history.
        </p>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Financial account">
            <select
              className={'w-full ' + input}
              value={financialAccountId}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Select mapped account</option>
              {accounts
                .filter((a) => a.isActive && a.chartAccountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} Â· {taka(a.balance)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              inputMode="decimal"
              className={'w-full text-right font-mono ' + input}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={'w-full ' + input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Reference">
            <input
              className={'w-full ' + input}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <label className="sm:col-span-2 text-sm font-medium">
            Notes
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border p-3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <p
          aria-live="polite"
          className={
            'mt-3 text-sm font-medium ' + (remaining < 0 ? 'text-rose-700' : 'text-slate-700')
          }
        >
          Remaining after payment: {taka(remaining)}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-4">
            Cancel
          </button>
          <button
            disabled={!valid || saving}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Postingâ€¦' : 'Post Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
function CreditDialog({
  kind,
  credit,
  rows,
  onClose,
  onSaved,
}: {
  kind: 'receivable' | 'payable';
  credit: PartyCredit;
  rows: Array<Receivable | Payable>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [targetId, setTargetId] = useState(''),
    [amount, setAmount] = useState(
      String(Number(credit.originalAmount) - Number(credit.appliedAmount)),
    ),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [notes, setNotes] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const eligible = rows.filter((row) => {
    if (Number(row.outstanding) <= 0) return false;
    return kind === 'receivable'
      ? 'sale' in row && Boolean(credit.customerId) && row.customerId === credit.customerId
      : 'purchase' in row && row.supplierId === credit.supplierId;
  });
  const target = eligible.find((row) => row.id === targetId);
  const available = Number(credit.originalAmount) - Number(credit.appliedAmount);
  const valid =
    Boolean(target) &&
    Number(amount) > 0 &&
    Number(amount) <= available &&
    Number(amount) <= Number(target?.outstanding ?? 0);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
    >
      <form
        className="w-full max-w-xl rounded-xl bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          setSaving(true);
          setError('');
          const payload = {
            ...(kind === 'receivable'
              ? { receivableItemId: targetId }
              : { payableItemId: targetId }),
            amount,
            date,
            notes: notes || null,
          };
          const request =
            kind === 'receivable'
              ? accountingApi.applyCustomerCredit(credit.id, payload)
              : accountingApi.applySupplierCredit(credit.id, payload);
          void request
            .then(onSaved)
            .catch((reason: unknown) =>
              setError(reason instanceof Error ? reason.message : 'Unable to apply credit.'),
            )
            .finally(() => setSaving(false));
        }}
      >
        <h2 id="credit-title" className="text-lg font-semibold">
          Apply {kind === 'receivable' ? 'Customer' : 'Supplier'} Credit
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Available {taka(available)}. Applying credit moves no cash and creates a balanced
          accounting allocation.
        </p>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={kind === 'receivable' ? 'Target receivable' : 'Target payable'}>
            <select
              className={'w-full ' + input}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
            >
              <option value="">Select open item</option>
              {eligible.map((row) => (
                <option key={row.id} value={row.id}>
                  {'sale' in row ? row.sale.invoiceNumber : row.purchase.purchaseNumber} Â·{' '}
                  {taka(row.outstanding)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              className={'w-full text-right font-mono ' + input}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={'w-full ' + input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <input
              className={'w-full ' + input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        {!eligible.length ? (
          <p role="alert" className="mt-3 text-sm text-amber-800">
            No same-party open item is eligible for this credit.
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-4">
            Cancel
          </button>
          <button
            disabled={!valid || saving}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Applyingâ€¦' : 'Apply Credit'}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatementDialog({
  rows,
  availableCredit,
  onClose,
}: {
  rows: unknown[];
  availableCredit: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
    >
      <section className="max-h-[85dvh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5">
        <div className="flex justify-between">
          <h2 id="statement-title" className="text-lg font-semibold">
            Accounting Statement
          </h2>
          <button onClick={onClose} className="min-h-11 rounded-lg border px-3">
            Close
          </button>
        </div>
        <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-950">
          Available party credit:{' '}
          <span className="font-mono tabular-nums">{taka(availableCredit)}</span>
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[700px] w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th>Date</th>
                <th>Document</th>
                <th>Reference</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Running</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((raw, i) => {
                const r = raw as {
                  date: string;
                  document: string;
                  reference: string;
                  debit: string;
                  credit: string;
                  runningOutstanding: string;
                  status: string;
                };
                return (
                  <tr key={i} className="border-b">
                    <td className="py-2">{new Date(r.date).toLocaleDateString()}</td>
                    <td>{r.document}</td>
                    <td>{r.reference}</td>
                    <td className="text-right font-mono">{taka(r.debit)}</td>
                    <td className="text-right font-mono">{taka(r.credit)}</td>
                    <td className="text-right font-mono font-semibold">
                      {taka(r.runningOutstanding)}
                    </td>
                    <td>{r.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
