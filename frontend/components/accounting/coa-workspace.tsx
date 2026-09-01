'use client';
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { accountingApi, type ChartAccount } from '@/lib/api/accounting';
const input =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
export function CoaWorkspace() {
  const [rows, setRows] = useState<ChartAccount[]>([]),
    [search, setSearch] = useState(''),
    [type, setType] = useState(''),
    [status, setStatus] = useState(''),
    [editing, setEditing] = useState<ChartAccount | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const load = () =>
    accountingApi
      .accounts()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load accounts.'));
  useEffect(() => {
    void load();
  }, []);
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!search || (r.code + ' ' + r.name).toLowerCase().includes(search.toLowerCase())) &&
          (!type || r.accountType === type) &&
          (!status || (status === 'ACTIVE') === r.isActive),
      ),
    [rows, search, type, status],
  );
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
          <p className="text-sm text-slate-600">
            Compact tenant-owned account hierarchy and posting controls.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white"
        >
          <Plus size={17} />
          Create account
        </button>
      </header>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}
      <div className="sticky top-0 z-10 grid gap-2 rounded-xl border bg-white p-3 shadow-sm sm:grid-cols-3">
        <label className="text-xs font-medium">
          Search
          <input
            aria-label="Search chart of accounts"
            className={'mt-1 w-full ' + input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code or account"
          />
        </label>
        <label className="text-xs font-medium">
          Type
          <select
            className={'mt-1 w-full ' + input}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Status
          <select
            className={'mt-1 w-full ' + input}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[850px] w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-3">Code / Account</th>
              <th>Type</th>
              <th>Normal</th>
              <th>System mapping</th>
              <th>Parent</th>
              <th>Status</th>
              <th>Manual</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className="font-mono tabular-nums">{r.code}</span>
                  <span className="ml-3 font-medium">{r.name}</span>
                </td>
                <td>{r.accountType}</td>
                <td>{r.normalBalance}</td>
                <td>{r.systemKey ?? '—'}</td>
                <td>{r.parent ? `${r.parent.code} ${r.parent.name}` : '—'}</td>
                <td>
                  <span className="font-medium">{r.isActive ? 'Active' : 'Inactive'}</span>
                </td>
                <td>{r.allowManualPosting ? 'Allowed' : 'Blocked'}</td>
                <td className="pr-3 text-right">
                  <button
                    aria-label={'Edit ' + r.name}
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    className="min-h-10 min-w-10 rounded-lg border p-2"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No accounts match these filters.</p>
        ) : null}
      </div>
      {open ? (
        <AccountDialog
          account={editing}
          accounts={rows}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
function AccountDialog({
  account,
  accounts,
  onClose,
  onSaved,
}: {
  account: ChartAccount | null;
  accounts: ChartAccount[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [code, setCode] = useState(account?.code ?? ''),
    [name, setName] = useState(account?.name ?? ''),
    [accountType, setType] = useState(account?.accountType ?? 'ASSET'),
    [normalBalance, setNormal] = useState(account?.normalBalance ?? 'DEBIT'),
    [parentId, setParent] = useState(account?.parentId ?? ''),
    [description, setDescription] = useState(account?.description ?? ''),
    [manual, setManual] = useState(account?.allowManualPosting ?? true),
    [active, setActive] = useState(account?.isActive ?? true),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
    >
      <form
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          setSaving(true);
          setError('');
          const request = account
            ? accountingApi.updateAccount(account.id, {
                name,
                description: description || null,
                parentId: parentId || null,
                allowManualPosting: manual,
                isActive: active,
              })
            : accountingApi.createAccount({
                code,
                name,
                accountType,
                normalBalance,
                parentId: parentId || null,
                description: description || null,
                allowManualPosting: manual,
              });
          void request
            .then(onSaved)
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Unable to save account.');
            })
            .finally(() => setSaving(false));
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="account-dialog-title" className="text-lg font-semibold">
            {account ? 'Edit account' : 'Create account'}
          </h2>
          <button
            type="button"
            aria-label="Close account form"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg p-2"
          >
            <X />
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Account code">
            <input
              disabled={Boolean(account)}
              className={'w-full ' + input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Field label="Account name">
            <input
              className={'w-full ' + input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Account type">
            <select
              disabled={Boolean(account)}
              className={'w-full ' + input}
              value={accountType}
              onChange={(e) => setType(e.target.value as ChartAccount['accountType'])}
            >
              {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Normal balance">
            <select
              disabled={Boolean(account)}
              className={'w-full ' + input}
              value={normalBalance}
              onChange={(e) => setNormal(e.target.value as 'DEBIT' | 'CREDIT')}
            >
              <option>DEBIT</option>
              <option>CREDIT</option>
            </select>
          </Field>
          <Field label="Parent account">
            <select
              className={'w-full ' + input}
              value={parentId}
              onChange={(e) => setParent(e.target.value)}
            >
              <option value="">No parent</option>
              {accounts
                .filter((x) => x.id !== account?.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} — {x.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Description">
            <input
              className={'w-full ' + input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
            Manual posting allowed
          </label>
          {account ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={account.isSystem}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active {account.isSystem ? '(required system account)' : ''}
            </label>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            disabled={saving || code.length < 3 || name.length < 2}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save account'}
          </button>
        </div>
      </form>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
