'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Button,
  controlClass,
  EmptyState,
  FilterBar,
  FieldLabel,
  FormActions,
  PageHeader,
  StatusBadge,
  TableSkeleton,
  textAreaClass,
} from '@/components/ui/primitives';
import { expenseApi, type Expense } from '@/lib/api/damage-expense';
import { ApprovalRequiredNotice } from '@/components/team-security/approval-required-notice';
import { ApprovalRequiredError } from '@/lib/api/api-error';
export function ExpenseList() {
  const [d, setD] = useState<{ rows: Expense[]; postedTotal: string } | null>(null),
    [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const load = (query = '') => void expenseApi.list(query).then(setD);
  useEffect(() => {
    load();
    void expenseApi.categories().then(setCategories);
  }, []);
  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track day-to-day operating costs."
        actions={
          <Link href="/expenses/new">
            <Button>Add Expense</Button>
          </Link>
        }
      />
      <FilterBar>
        <form
          className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-6"
          action={(f) => {
            const p = new URLSearchParams();
            for (const key of [
              'search',
              'categoryId',
              'status',
              'paymentMethod',
              'dateFrom',
              'dateTo',
            ]) {
              const value = f.get(key);
              if (typeof value === 'string' && value) p.set(key, value);
            }
            load(`?${p}`);
          }}
        >
          <input
            name="search"
            aria-label="Search expenses"
            placeholder="Number, description or payee"
            className={controlClass}
          />
          <select name="categoryId" aria-label="Category" className={controlClass}>
            <option value="">All categories</option>
            {categories.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select name="status" aria-label="Status" className={controlClass}>
            <option value="">All statuses</option>
            <option>DRAFT</option>
            <option>POSTED</option>
          </select>
          <select name="paymentMethod" aria-label="Payment method" className={controlClass}>
            <option value="">All methods</option>
            {['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input name="dateFrom" type="date" aria-label="From date" className={controlClass} />
          <div className="flex gap-2">
            <input name="dateTo" type="date" aria-label="To date" className={controlClass} />
            <Button size="small">Filter</Button>
            <Button size="small" type="reset" variant="ghost" onClick={() => load()}>
              Reset
            </Button>
          </div>
        </form>
      </FilterBar>
      {!d ? (
        <TableSkeleton />
      ) : d.rows.length ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[780px] text-sm">
            <tbody>
              {d.rows.map((x) => (
                <tr key={x.id} className="border-b">
                  <td className="p-3 font-semibold">
                    <Link href={`/expenses/${x.id}`}>{x.expenseNumber}</Link>
                  </td>
                  <td>{x.category.name}</td>
                  <td>{x.description}</td>
                  <td>{x.paymentMethod ?? '—'}</td>
                  <td className="text-right">৳{Number(x.amount).toLocaleString('en-BD')}</td>
                  <td>
                    <StatusBadge tone={x.status === 'POSTED' ? 'success' : 'warning'}>
                      {x.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No expenses yet" description="Operating expenses will appear here." />
      )}
    </>
  );
}
export function ExpenseForm({ id }: { id?: string }) {
  const [c, setC] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]),
    [x, setX] = useState<Expense | null>(null),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState('');
  useEffect(() => {
    void expenseApi.categories().then(setC);
    if (id) void expenseApi.find(id).then(setX);
  }, [id]);
  const submit = (f: FormData) => {
    const v = (n: string) => {
      const value = f.get(n);
      return typeof value === 'string' ? value : '';
    };
    const p = {
      categoryId: v('categoryId'),
      expenseDate: new Date(v('expenseDate')).toISOString(),
      amount: v('amount').replaceAll(',', ''),
      description: v('description'),
      payee: v('payee') || null,
      paymentMethod: v('paymentMethod') || null,
      reference: v('reference') || null,
      notes: v('notes') || null,
    };
    setBusy(true);
    void (id ? expenseApi.update(id, p) : expenseApi.create(p))
      .then((y) => (location.href = `/expenses/${y.id}`))
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Unable to save expense.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeader
        title={id ? 'Edit Expense' : 'Add Expense'}
        description="Record operating costs without changing account balances."
      />
      <form action={submit} className="space-y-4">
        <section className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldLabel label="Category">
            <select
              name="categoryId"
              required
              defaultValue={x?.category.id ?? ''}
              className={'mt-1.5 ' + controlClass}
            >
              {c
                .filter((y) => y.isActive)
                .map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Date">
            <input
              name="expenseDate"
              type="date"
              required
              defaultValue={x?.expenseDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Amount (BDT)">
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={x?.amount ?? ''}
              className={'mt-1.5 text-right ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Payee">
            <input
              name="payee"
              defaultValue={x?.payee ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Payment method">
            <select
              name="paymentMethod"
              defaultValue={x?.paymentMethod ?? ''}
              className={'mt-1.5 ' + controlClass}
            >
              <option value="">Not specified</option>
              {['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER'].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Reference">
            <input
              name="reference"
              defaultValue={x?.reference ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Description">
            <input
              name="description"
              required
              defaultValue={x?.description ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Notes">
            <textarea
              name="notes"
              defaultValue={x?.notes ?? ''}
              className={'mt-1.5 ' + textAreaClass}
            />
          </FieldLabel>
        </section>
        <p className="text-xs text-slate-500">Payment method is informational only.</p>
        {msg && <p role="alert">{msg}</p>}
        <FormActions>
          <Link href="/expenses">
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button busy={busy}>Save Draft</Button>
        </FormActions>
      </form>
    </>
  );
}
export function ExpenseDetail({ id }: { id: string }) {
  const [x, setX] = useState<Expense | null>(null);
  const [approval, setApproval] = useState<ApprovalRequiredError | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void expenseApi.find(id).then(setX);
  }, [id]);
  if (!x) return <TableSkeleton />;
  return (
    <>
      {approval ? <ApprovalRequiredNotice error={approval} /> : null}
      {error ? <p role="alert">{error}</p> : null}
      <PageHeader
        title={x.expenseNumber}
        description={`${x.category.name} · ৳${Number(x.amount).toLocaleString('en-BD')}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => print()}>
              Print
            </Button>
            {x.status === 'DRAFT' && (
              <>
                <Link href={`/expenses/${id}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
                <Button
                  onClick={() =>
                    void expenseApi
                      .post(id)
                      .then(setX)
                      .catch((reason: unknown) => {
                        if (reason instanceof ApprovalRequiredError) setApproval(reason);
                        else
                          setError(
                            reason instanceof Error ? reason.message : 'Unable to post expense.',
                          );
                      })
                  }
                >
                  Post Expense
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="rounded-lg border bg-white p-4">
        <StatusBadge tone={x.status === 'POSTED' ? 'success' : 'warning'}>{x.status}</StatusBadge>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt>Payee</dt>
            <dd>{x.payee ?? '—'}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{x.paymentMethod ?? '—'}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{x.description}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{x.reference ?? '—'}</dd>
          </div>
        </dl>
      </div>
      <section className="print-only hidden">
        <h1>{x.business.name}</h1>
        <h2>Expense Record · {x.expenseNumber}</h2>
      </section>
    </>
  );
}
export function ExpenseCategories() {
  const [r, setR] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const load = () => void expenseApi.categories().then(setR);
  useEffect(load, []);
  return (
    <>
      <PageHeader
        title="Expense Categories"
        description="Manage business-specific expense categories."
      />
      <form
        action={(f) => {
          const name = f.get('name');
          if (typeof name === 'string') void expenseApi.createCategory({ name }).then(load);
        }}
        className="flex flex-col gap-2 rounded-lg border bg-white p-4 sm:flex-row"
      >
        <input name="name" required aria-label="Category name" className={controlClass} />
        <Button>Add Category</Button>
      </form>
      {!r.length ? (
        <EmptyState
          title="No expense categories"
          description="Add the first category used by this business."
        />
      ) : (
        r.map((x) => (
          <form
            key={x.id}
            className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center"
            action={(f) => {
              const name = f.get('name');
              if (typeof name === 'string')
                void expenseApi.updateCategory(x.id, { name }).then(load);
            }}
          >
            <input
              name="name"
              defaultValue={x.name}
              aria-label={`Edit ${x.name}`}
              className={controlClass}
            />
            <StatusBadge tone={x.isActive ? 'success' : 'neutral'}>
              {x.isActive ? 'ACTIVE' : 'INACTIVE'}
            </StatusBadge>
            <Button size="small" variant="secondary">
              Save
            </Button>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() =>
                void expenseApi.updateCategory(x.id, { isActive: !x.isActive }).then(load)
              }
            >
              {x.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
        ))
      )}
    </>
  );
}
