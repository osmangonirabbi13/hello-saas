'use client';
import Link from 'next/link';
import { ArrowDownLeft, ArrowRight, Banknote, Building2, Landmark, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  controlClass,
  CurrencyDisplay,
  EmptyState,
  FieldLabel,
  FilterBar,
  FormActions,
  PageHeader,
  StatusBadge,
  TableSkeleton,
  textAreaClass,
} from '@/components/ui/primitives';
import {
  financeApi,
  type FinancialAccount,
  type FinancialTransaction,
  type FinancialTransfer,
} from '@/lib/api/finance';
import { accountingApi, type ChartAccount } from '@/lib/api/accounting';

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string) => <CurrencyDisplay value={Number(value)} />;
const accountIcon = (type: string) =>
  type === 'BANK'
    ? Landmark
    : type === 'BKASH' || type === 'NAGAD'
      ? Smartphone
      : type === 'CASH'
        ? Banknote
        : Building2;
function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
    >
      <p>{message}</p>
      <Button className="mt-3" size="small" variant="secondary" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}
function useAccounts() {
  const [rows, setRows] = useState<FinancialAccount[] | null>(null),
    [error, setError] = useState('');
  const load = (query = '') => {
    setError('');
    void financeApi
      .accounts(query)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load accounts.'));
  };
  useEffect(load, []);
  return { rows, error, load };
}

export function AccountList() {
  const { rows, error, load } = useAccounts();
  const totals = useMemo(
    () => (rows ?? []).reduce((sum, row) => sum + Number(row.balance), 0),
    [rows],
  );
  return (
    <>
      <PageHeader
        title="Financial Accounts"
        description="Operational cash, bank, and mobile-wallet balances from posted history."
        actions={
          <>
            <Link href="/finance/transactions/money-in">
              <Button variant="secondary">
                <ArrowDownLeft size={16} />
                Money In
              </Button>
            </Link>
            <Link href="/finance/transfers/new">
              <Button variant="secondary">Transfer</Button>
            </Link>
            <Link href="/finance/accounts/new">
              <Button>Add Account</Button>
            </Link>
          </>
        }
      />
      {rows && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total available funds
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
              {money(String(totals))}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Across active and disabled accounts. Transfers do not change this total.
            </p>
          </div>
          {['CASH', 'BANK', 'BKASH', 'NAGAD'].map((type) => (
            <div className="rounded-xl border bg-white p-4" key={type}>
              <p className="text-xs font-semibold text-slate-500">{type}</p>
              <p className="mt-1 font-bold tabular-nums">
                {money(
                  String(
                    rows
                      .filter((x) => x.type === type)
                      .reduce((sum, x) => sum + Number(x.balance), 0),
                  ),
                )}
              </p>
            </div>
          ))}
        </section>
      )}
      <FilterBar>
        <form
          className="grid w-full gap-2 sm:grid-cols-[1fr_180px_160px_auto]"
          action={(form) => {
            const p = new URLSearchParams();
            for (const key of ['search', 'type', 'active']) {
              const value = form.get(key);
              if (typeof value === 'string' && value) p.set(key, value);
            }
            load(`?${p}`);
          }}
        >
          <input
            name="search"
            aria-label="Search accounts"
            placeholder="Name, code or bank"
            className={controlClass}
          />
          <select name="type" aria-label="Account type" className={controlClass}>
            <option value="">All types</option>
            {['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select name="active" aria-label="Account status" className={controlClass}>
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Disabled</option>
          </select>
          <div className="flex gap-2">
            <Button size="small">Filter</Button>
            <Button type="reset" size="small" variant="ghost" onClick={() => load()}>
              Reset
            </Button>
          </div>
        </form>
      </FilterBar>
      {error ? (
        <ErrorState message={error} retry={load} />
      ) : !rows ? (
        <TableSkeleton />
      ) : rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((account) => {
            const Icon = accountIcon(account.type);
            return (
              <Link
                key={account.id}
                href={`/finance/accounts/${account.id}`}
                className="group rounded-xl border bg-white p-4 transition-colors hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon size={19} />
                  </span>
                  <StatusBadge tone={account.isActive ? 'success' : 'neutral'}>
                    {account.isActive ? 'ACTIVE' : 'DISABLED'}
                  </StatusBadge>
                </div>
                <p className="mt-4 font-semibold text-slate-950">{account.name}</p>
                <p className="text-xs text-slate-500">
                  {account.accountCode} · {account.type}
                </p>
                <p className="mt-4 text-xl font-bold tabular-nums">{money(account.balance)}</p>
                <p className="mt-1 text-xs text-slate-500">Available balance</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No financial accounts"
          description="Create a cash, bank, or mobile-wallet account to begin operational money tracking."
        />
      )}
    </>
  );
}

export function AccountForm({ id }: { id?: string }) {
  const [account, setAccount] = useState<FinancialAccount | null>(null),
    [type, setType] = useState('CASH'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (id)
      void financeApi
        .account(id)
        .then((x) => {
          setAccount(x);
          setType(x.type);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load account.'));
  }, [id]);
  const submit = (form: FormData) => {
    const value = (key: string) => {
      const entry = form.get(key);
      return typeof entry === 'string' ? entry.trim() : '';
    };
    const body = {
      name: value('name'),
      ...(id ? {} : { type, openingBalance: value('openingBalance') || undefined }),
      description: value('description') || null,
      bankName: value('bankName') || null,
      accountHolder: value('accountHolder') || null,
      accountNumber: value('accountNumber') || null,
      branch: value('branch') || null,
      mobileNumber: value('mobileNumber') || null,
    };
    setBusy(true);
    setError('');
    void (id ? financeApi.updateAccount(id, body) : financeApi.createAccount(body))
      .then((x) => location.assign(`/finance/accounts/${x.id}`))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to save account.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeader
        title={id ? 'Edit Financial Account' : 'Create Financial Account'}
        description="Account metadata is editable; posted financial history and balances are not."
      />
      <form action={submit} className="space-y-4">
        <section className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <FieldLabel label="Account name">
            <input
              name="name"
              required
              defaultValue={account?.name ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          {!id && (
            <FieldLabel label="Type">
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={'mt-1.5 ' + controlClass}
              >
                {['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </FieldLabel>
          )}
          {!id && (
            <FieldLabel
              label="Opening balance"
              helper="Optional. Creates one immutable posted opening-balance transaction."
            >
              <input
                name="openingBalance"
                inputMode="decimal"
                className={'mt-1.5 text-right ' + controlClass}
              />
            </FieldLabel>
          )}
          {type === 'BANK' && (
            <>
              <FieldLabel label="Bank name">
                <input
                  name="bankName"
                  required
                  defaultValue={account?.bankName ?? ''}
                  className={'mt-1.5 ' + controlClass}
                />
              </FieldLabel>
              <FieldLabel label="Account holder">
                <input
                  name="accountHolder"
                  defaultValue={account?.accountHolder ?? ''}
                  className={'mt-1.5 ' + controlClass}
                />
              </FieldLabel>
              <FieldLabel label="Account number">
                <input
                  name="accountNumber"
                  required
                  defaultValue={account?.accountNumber ?? ''}
                  className={'mt-1.5 ' + controlClass}
                />
              </FieldLabel>
              <FieldLabel label="Branch">
                <input
                  name="branch"
                  defaultValue={account?.branch ?? ''}
                  className={'mt-1.5 ' + controlClass}
                />
              </FieldLabel>
            </>
          )}
          {(type === 'BKASH' || type === 'NAGAD') && (
            <>
              <FieldLabel label="Account or merchant name">
                <input
                  name="accountHolder"
                  defaultValue={account?.accountHolder ?? ''}
                  className={'mt-1.5 ' + controlClass}
                />
              </FieldLabel>
              <FieldLabel label="Mobile number">
                <input
                  name="mobileNumber"
                  required
                  defaultValue={account?.mobileNumber ?? ''}
                  className={'mt-1.5 ' + controlClass}
                />
              </FieldLabel>
            </>
          )}
          <FieldLabel label="Description">
            <textarea
              name="description"
              defaultValue={account?.description ?? ''}
              className={'mt-1.5 ' + textAreaClass}
            />
          </FieldLabel>
        </section>
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        <FormActions>
          <Link href={id ? `/finance/accounts/${id}` : '/finance/accounts'}>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </Link>
          <Button busy={busy}>{id ? 'Save Changes' : 'Create Account'}</Button>
        </FormActions>
      </form>
    </>
  );
}

export function AccountDetail({ id }: { id: string }) {
  const [account, setAccount] = useState<FinancialAccount | null>(null),
    [statement, setStatement] = useState<{
      rows: FinancialTransaction[];
      openingBalance: string;
      closingBalance: string;
    } | null>(null),
    [error, setError] = useState('');
  const load = (query = '') => {
    setError('');
    void Promise.all([financeApi.account(id), financeApi.statement(id, query)])
      .then(([a, s]) => {
        setAccount(a);
        setStatement(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load account.'));
  };
  useEffect(load, [id]);
  if (error) return <ErrorState message={error} retry={load} />;
  if (!account || !statement) return <TableSkeleton />;
  return (
    <>
      <PageHeader
        title={account.name}
        description={`${account.accountCode} · ${account.type}`}
        actions={
          <>
            <Link href={`/finance/transactions/money-in?accountId=${id}`}>
              <Button variant="secondary">Money In</Button>
            </Link>
            <Link href={`/finance/transactions/money-out?accountId=${id}`}>
              <Button variant="secondary">Money Out</Button>
            </Link>
            <Link href={`/finance/transfers/new?sourceAccountId=${id}`}>
              <Button>Transfer</Button>
            </Link>
          </>
        }
      />
      <section className="rounded-xl border bg-white p-5">
        <p className="text-sm text-slate-500">Available Balance</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-950">
          {money(account.balance)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/finance/accounts/${id}/edit`}>
            <Button size="small" variant="secondary">
              Edit
            </Button>
          </Link>
          <Link href={`/finance/transactions/adjustment?accountId=${id}`}>
            <Button size="small" variant="secondary">
              Adjust
            </Button>
          </Link>
          <ConfirmDialog
            trigger={
              <Button size="small" variant="ghost">
                {account.isActive ? 'Disable' : 'Enable'}
              </Button>
            }
            title={`${account.isActive ? 'Disable' : 'Enable'} account?`}
            description={
              account.isActive
                ? 'History remains readable, but new transactions will be blocked.'
                : 'This account will accept new financial transactions again.'
            }
            onConfirm={() =>
              void (
                account.isActive ? financeApi.disableAccount(id) : financeApi.enableAccount(id)
              ).then(setAccount)
            }
          />
        </div>
      </section>
      <FilterBar>
        <form
          className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-6"
          action={(form) => {
            const p = new URLSearchParams();
            for (const key of ['search', 'type', 'direction', 'dateFrom', 'dateTo']) {
              const value = form.get(key);
              if (typeof value === 'string' && value) p.set(key, value);
            }
            load(`?${p}`);
          }}
        >
          <input
            name="search"
            aria-label="Search statement"
            placeholder="TXN, description or reference"
            className={controlClass}
          />
          <select name="type" aria-label="Transaction type" className={controlClass}>
            <option value="">All types</option>
            {[
              'OPENING_BALANCE',
              'MONEY_IN',
              'MONEY_OUT',
              'TRANSFER_IN',
              'TRANSFER_OUT',
              'ADJUSTMENT_IN',
              'ADJUSTMENT_OUT',
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select name="direction" aria-label="Direction" className={controlClass}>
            <option value="">All directions</option>
            <option>IN</option>
            <option>OUT</option>
          </select>
          <input name="dateFrom" aria-label="From date" type="date" className={controlClass} />
          <input name="dateTo" aria-label="To date" type="date" className={controlClass} />
          <div className="flex gap-2">
            <Button size="small">Filter</Button>
            <Button type="reset" size="small" variant="ghost" onClick={() => load()}>
              Reset
            </Button>
          </div>
        </form>
      </FilterBar>
      <StatementTable rows={statement.rows} />
    </>
  );
}
function StatementTable({ rows }: { rows: FinancialTransaction[] }) {
  return rows.length ? (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {[
              'Date',
              'TXN No',
              'Type',
              'Description',
              'Money In',
              'Money Out',
              'Running Balance',
              'Reference',
            ].map((x) => (
              <th className="px-3 py-3" key={x}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="p-3">{new Date(row.transactionDate).toLocaleDateString('en-BD')}</td>
              <td>
                <Link
                  className="font-semibold text-emerald-700"
                  href={`/finance/transactions/${row.id}`}
                >
                  {row.transactionNo}
                </Link>
              </td>
              <td>{row.type.replaceAll('_', ' ')}</td>
              <td>{row.description}</td>
              <td className="text-right tabular-nums">
                {row.direction === 'IN' ? money(row.amount) : '—'}
              </td>
              <td className="text-right tabular-nums">
                {row.direction === 'OUT' ? money(row.amount) : '—'}
              </td>
              <td className="text-right font-semibold tabular-nums">
                {money(row.runningBalance ?? '0')}
              </td>
              <td>{row.reference ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title="No transactions" description="Posted account history will appear here." />
  );
}

export function TransactionList() {
  const [data, setData] = useState<{ rows: FinancialTransaction[] } | null>(null),
    [error, setError] = useState('');
  const load = (query = '') => {
    setError('');
    void financeApi
      .transactions(query)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load transactions.'));
  };
  useEffect(load, []);
  return (
    <>
      <PageHeader
        title="Financial Transactions"
        description="Immutable posted operational account history."
        actions={
          <>
            <Link href="/finance/transactions/money-in">
              <Button variant="secondary">Money In</Button>
            </Link>
            <Link href="/finance/transactions/money-out">
              <Button>Money Out</Button>
            </Link>
          </>
        }
      />
      <FilterBar>
        <form
          className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-6"
          action={(form) => {
            const p = new URLSearchParams();
            for (const key of ['search', 'type', 'direction', 'dateFrom', 'dateTo']) {
              const value = form.get(key);
              if (typeof value === 'string' && value) p.set(key, value);
            }
            load(`?${p}`);
          }}
        >
          <input
            name="search"
            aria-label="Search transactions"
            placeholder="TXN, description or reference"
            className={controlClass}
          />
          <select name="type" aria-label="Type" className={controlClass}>
            <option value="">All types</option>
            {[
              'OPENING_BALANCE',
              'MONEY_IN',
              'MONEY_OUT',
              'TRANSFER_IN',
              'TRANSFER_OUT',
              'ADJUSTMENT_IN',
              'ADJUSTMENT_OUT',
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select name="direction" aria-label="Direction" className={controlClass}>
            <option value="">All directions</option>
            <option>IN</option>
            <option>OUT</option>
          </select>
          <input name="dateFrom" aria-label="From date" type="date" className={controlClass} />
          <input name="dateTo" aria-label="To date" type="date" className={controlClass} />
          <div className="flex gap-2">
            <Button size="small">Filter</Button>
            <Button type="reset" size="small" variant="ghost" onClick={() => load()}>
              Reset
            </Button>
          </div>
        </form>
      </FilterBar>
      {error ? (
        <ErrorState message={error} retry={load} />
      ) : !data ? (
        <TableSkeleton />
      ) : (
        <StatementTable rows={data.rows} />
      )}
    </>
  );
}

export function MoneyForm({ kind }: { kind: 'in' | 'out' | 'adjustment' }) {
  const { rows: accounts, error: accountError, load } = useAccounts();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  useEffect(() => {
    void accountingApi.accounts().then(setChartAccounts).catch(() => setChartAccounts([]));
  }, []);
  const label = kind === 'in' ? 'Money In' : kind === 'out' ? 'Money Out' : 'Account Adjustment';
  const submit = (form: FormData) => {
    const value = (key: string) => {
      const entry = form.get(key);
      return typeof entry === 'string' ? entry.trim() : '';
    };
    const body = {
      accountId: value('accountId'),
      amount: value('amount').replaceAll(',', ''),
      transactionDate: new Date(value('transactionDate')).toISOString(),
      description: value('description'),
      counterparty: value('counterparty') || null,
      reference: value('reference') || null,
      notes: value('notes') || null,
      offsetAccountId: value('offsetAccountId'),
      ...(kind === 'adjustment' ? { direction: value('direction'), reason: value('reason') } : {}),
    };
    setBusy(true);
    setError('');
    const request =
      kind === 'in'
        ? financeApi.moneyIn(body)
        : kind === 'out'
          ? financeApi.moneyOut(body)
          : financeApi.adjustment(body);
    void request
      .then((x) => location.assign(`/finance/transactions/${x.id}`))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to record transaction.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeader
        title={label}
        description={
          kind === 'adjustment'
            ? 'A controlled correction to operational account history.'
            : 'Record a posted operational account transaction.'
        }
      />
      {accountError ? (
        <ErrorState message={accountError} retry={load} />
      ) : (
        <form action={submit} className="space-y-4">
          {accounts?.some((account) => account.isActive && !account.chartAccountId) ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Active financial accounts without Accounting mappings are unavailable. Complete
              Accounting Setup before transferring with them.
            </p>
          ) : null}
          <section className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
            <FieldLabel label="Account">
              <select name="accountId" required className={'mt-1.5 ' + controlClass}>
                <option value="">Select account</option>
                {accounts
                  ?.filter((x) => x.isActive && x.chartAccountId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} — {Number(x.balance).toLocaleString('en-BD')} BDT
                    </option>
                  ))}
              </select>
            </FieldLabel>
            <FieldLabel
              label={'Accounting Offset Account'}
              helper={kind === 'in' ? 'Choose the source or meaning of incoming money; it is not automatically Revenue.' : 'Choose the economic meaning of this outgoing amount.'}
            >
              <select name={'offsetAccountId'} required className={'mt-1.5 ' + controlClass}>
                <option value={''}>Select accounting classification</option>
                {chartAccounts.filter((x) => x.isActive && x.allowManualPosting).map((x) => (
                  <option key={x.id} value={x.id}>{x.code} — {x.name} ({x.accountType})</option>
                ))}
              </select>
            </FieldLabel>
            {kind === 'adjustment' && (
              <FieldLabel label="Direction">
                <select name="direction" className={'mt-1.5 ' + controlClass}>
                  <option value="IN">Adjustment In</option>
                  <option value="OUT">Adjustment Out</option>
                </select>
              </FieldLabel>
            )}
            <FieldLabel label="Amount (BDT)">
              <input
                name="amount"
                inputMode="decimal"
                required
                className={'mt-1.5 text-right ' + controlClass}
              />
            </FieldLabel>
            <FieldLabel label="Date">
              <input
                name="transactionDate"
                type="date"
                required
                defaultValue={today()}
                className={'mt-1.5 ' + controlClass}
              />
            </FieldLabel>
            <FieldLabel label="Description">
              <input name="description" required className={'mt-1.5 ' + controlClass} />
            </FieldLabel>
            {kind === 'adjustment' && (
              <FieldLabel label="Reason" helper="Required for audit review.">
                <input name="reason" required className={'mt-1.5 ' + controlClass} />
              </FieldLabel>
            )}
            <FieldLabel label="Counterparty">
              <input name="counterparty" className={'mt-1.5 ' + controlClass} />
            </FieldLabel>
            <FieldLabel label="Reference">
              <input name="reference" className={'mt-1.5 ' + controlClass} />
            </FieldLabel>
            <FieldLabel label="Notes">
              <textarea name="notes" className={'mt-1.5 ' + textAreaClass} />
            </FieldLabel>
          </section>
          <p className={'rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900'}>
            This action creates linked operational and accounting history. It does not directly edit a balance.
          </p>
          {kind === 'adjustment' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Adjustment directly changes the operational account balance history.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <FormActions>
            <Link href="/finance/transactions">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button busy={busy}>
              {kind === 'adjustment'
                ? 'Confirm Adjustment'
                : kind === 'in'
                  ? 'Record Money In'
                  : 'Record Money Out'}
            </Button>
          </FormActions>
        </form>
      )}
    </>
  );
}

export function TransactionDetail({ id }: { id: string }) {
  const [row, setRow] = useState<FinancialTransaction | null>(null),
    [error, setError] = useState('');
  const load = () =>
    void financeApi
      .transaction(id)
      .then(setRow)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load transaction.'));
  useEffect(load, [id]);
  if (error) return <ErrorState message={error} retry={load} />;
  if (!row) return <TableSkeleton />;
  return (
    <>
      <PageHeader title={row.transactionNo} description="Posted financial transaction" />
      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <StatusBadge tone={row.direction === 'IN' ? 'success' : 'warning'}>
            {row.direction}
          </StatusBadge>
          <p className="text-2xl font-bold tabular-nums">{money(row.amount)}</p>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Account', row.account.name],
            ['Type', row.type.replaceAll('_', ' ')],
            ['Date', new Date(row.transactionDate).toLocaleDateString('en-BD')],
            ['Description', row.description],
            ['Counterparty', row.counterparty ?? '—'],
            ['Reference', row.reference ?? '—'],
            ['Created by', row.createdBy.displayName],
            ['Status', row.status],
          ].map(([a, b]) => (
            <div key={a}>
              <dt className="text-xs font-semibold uppercase text-slate-500">{a}</dt>
              <dd className="mt-1 text-sm text-slate-900">{b}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

export function TransferList() {
  const [data, setData] = useState<{ rows: FinancialTransfer[] } | null>(null),
    [error, setError] = useState('');
  const load = (query = '') => {
    setError('');
    void financeApi
      .transfers(query)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load transfers.'));
  };
  useEffect(load, []);
  return (
    <>
      <PageHeader
        title="Transfers"
        description="Two-sided account transfers posted atomically."
        actions={
          <Link href="/finance/transfers/new">
            <Button>New Transfer</Button>
          </Link>
        }
      />
      <FilterBar>
        <form
          className="grid w-full gap-2 sm:grid-cols-4"
          action={(form) => {
            const p = new URLSearchParams();
            for (const key of ['search', 'dateFrom', 'dateTo']) {
              const value = form.get(key);
              if (typeof value === 'string' && value) p.set(key, value);
            }
            load(`?${p}`);
          }}
        >
          <input
            name="search"
            aria-label="Search transfers"
            placeholder="TRF or reference"
            className={controlClass}
          />
          <input name="dateFrom" aria-label="From date" type="date" className={controlClass} />
          <input name="dateTo" aria-label="To date" type="date" className={controlClass} />
          <div className="flex gap-2">
            <Button size="small">Filter</Button>
            <Button type="reset" size="small" variant="ghost" onClick={() => load()}>
              Reset
            </Button>
          </div>
        </form>
      </FilterBar>
      {error ? (
        <ErrorState message={error} retry={load} />
      ) : !data ? (
        <TableSkeleton />
      ) : data.rows.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <tbody>
              {data.rows.map((x) => (
                <tr key={x.id} className="border-b">
                  <td className="p-3 font-semibold">
                    <Link href={`/finance/transfers/${x.id}`}>{x.transferNo}</Link>
                  </td>
                  <td>{x.sourceAccount.name}</td>
                  <td>
                    <ArrowRight aria-label="to" size={16} />
                  </td>
                  <td>{x.destinationAccount.name}</td>
                  <td className="text-right font-semibold tabular-nums">{money(x.amount)}</td>
                  <td>{new Date(x.transferDate).toLocaleDateString('en-BD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No transfers"
          description="Account-to-account transfers will appear here."
        />
      )}
    </>
  );
}
export function TransferForm() {
  const { rows: accounts, error: accountError, load } = useAccounts();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = (form: FormData) => {
    const v = (k: string) => {
      const entry = form.get(k);
      return typeof entry === 'string' ? entry.trim() : '';
    };
    const body = {
      sourceAccountId: v('sourceAccountId'),
      destinationAccountId: v('destinationAccountId'),
      amount: v('amount').replaceAll(',', ''),
      transferDate: new Date(v('transferDate')).toISOString(),
      reference: v('reference') || null,
      notes: v('notes') || null,
    };
    setBusy(true);
    setError('');
    void financeApi
      .createTransfer(body)
      .then((x) => location.assign(`/finance/transfers/${x.id}`))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to transfer funds.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeader
        title="Transfer Funds"
        description="Move funds between two active accounts without changing total business funds."
      />
      {accountError ? (
        <ErrorState message={accountError} retry={load} />
      ) : (
        <form action={submit} className="space-y-4">
          {accounts?.some((account) => account.isActive && !account.chartAccountId) ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Active financial accounts without Accounting mappings are unavailable. Complete
              Accounting Setup before transferring with them.
            </p>
          ) : null}
          <section className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
            <FieldLabel label="From account">
              <select name="sourceAccountId" required className={'mt-1.5 ' + controlClass}>
                <option value="">Select source</option>
                {accounts
                  ?.filter((x) => x.isActive && x.chartAccountId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} — {x.balance} BDT
                    </option>
                  ))}
              </select>
            </FieldLabel>
            <FieldLabel label="To account">
              <select name="destinationAccountId" required className={'mt-1.5 ' + controlClass}>
                <option value="">Select destination</option>
                {accounts
                  ?.filter((x) => x.isActive && x.chartAccountId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Amount (BDT)">
              <input
                name="amount"
                inputMode="decimal"
                required
                className={'mt-1.5 text-right ' + controlClass}
              />
            </FieldLabel>
            <FieldLabel label="Date">
              <input
                name="transferDate"
                type="date"
                required
                defaultValue={today()}
                className={'mt-1.5 ' + controlClass}
              />
            </FieldLabel>
            <FieldLabel label="Reference">
              <input name="reference" className={'mt-1.5 ' + controlClass} />
            </FieldLabel>
            <FieldLabel label="Note">
              <textarea name="notes" className={'mt-1.5 ' + textAreaClass} />
            </FieldLabel>
          </section>
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            Accounting debits the destination asset account and credits the source asset account.
            Internal transfers create no Revenue or Expense.
          </p>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <FormActions>
            <Link href="/finance/transfers">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button busy={busy}>Transfer Funds</Button>
          </FormActions>
        </form>
      )}
    </>
  );
}
export function TransferDetail({ id }: { id: string }) {
  const [row, setRow] = useState<FinancialTransfer | null>(null),
    [error, setError] = useState('');
  const load = () =>
    void financeApi
      .transfer(id)
      .then(setRow)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load transfer.'));
  useEffect(load, [id]);
  if (error) return <ErrorState message={error} retry={load} />;
  if (!row) return <TableSkeleton />;
  return (
    <>
      <PageHeader
        title={row.transferNo}
        description="Posted account transfer"
        actions={
          <Link href="/finance/transfers/new">
            <Button>New Transfer</Button>
          </Link>
        }
      />
      <section className="rounded-xl border bg-white p-6 text-center">
        <p className="text-3xl font-bold tabular-nums">{money(row.amount)}</p>
        <div className="mx-auto mt-6 grid max-w-2xl items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">From</p>
            <p className="font-semibold">{row.sourceAccount.name}</p>
          </div>
          <ArrowRight className="mx-auto" aria-label="to" />
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">To</p>
            <p className="font-semibold">{row.destinationAccount.name}</p>
          </div>
        </div>
        <p className="mt-5 text-sm text-slate-500">
          {new Date(row.transferDate).toLocaleDateString('en-BD')} ·{' '}
          {row.reference ?? 'No reference'}
        </p>
      </section>
    </>
  );
}
