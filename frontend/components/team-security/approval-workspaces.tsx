'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { securityApi, type Approval, type AuditEvent, type Policy } from '@/lib/api/team-security';
import { button, control } from './team-workspace';
export function ApprovalsWorkspace() {
  const [rows, setRows] = useState<Approval[]>([]),
    [scope, setScope] = useState<'review' | 'mine' | 'completed'>('review'),
    [members, setMembers] = useState<Array<{ id: string; name: string }>>([]),
    [actions, setActions] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const filters = useRef<HTMLFormElement>(null);
  const load = (reset = false) => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ scope });
    if (!reset && filters.current)
      new FormData(filters.current).forEach((value, key) => {
        if (typeof value === 'string' && value) query.set(key, value);
      });
    return securityApi
      .approvals(`?${query.toString()}`)
      .then(setRows)
      .catch(() => setError('Unable to load approvals. Check your connection and retry.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void load();
  }, [scope]);
  useEffect(() => {
    void Promise.all([securityApi.team(), securityApi.policies()]).then(([team, policies]) => {
      setMembers(team.map((item) => ({ id: item.user.id, name: item.user.displayName })));
      setActions(policies.map((item) => item.actionType));
    });
  }, []);
  const tabs = [
    ['review', 'Pending My Review'],
    ['mine', 'My Requests'],
    ['completed', 'Completed'],
  ] as const;
  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-slate-600">Review sensitive actions before execution.</p>
      </header>
      <div role="tablist" aria-label="Approval inbox" className="flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            role="tab"
            aria-selected={scope === value}
            className={`${button} border ${scope === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white'}`}
            onClick={() => setScope(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        ref={filters}
        className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="text-xs font-medium text-slate-600">
          Search
          <input name="search" className={control} placeholder="APR or source" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Action
          <select name="actionType" className={control}>
            <option value="">All actions</option>
            {actions.map((action) => (
              <option value={action} key={action}>
                {action.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Status
          <select name="status" className={control}>
            <option value="">All statuses</option>
            {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'EXECUTED', 'STALE'].map(
              (status) => (
                <option key={status}>{status}</option>
              ),
            )}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Requester
          <select name="requesterId" className={control}>
            <option value="">All requesters</option>
            {members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          From date
          <input name="dateFrom" type="date" className={control} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To date
          <input name="dateTo" type="date" className={control} />
        </label>
        <div className="flex items-end gap-2">
          <button className={`${button} bg-slate-900 text-white`}>Apply</button>
          <button
            type="button"
            className={`${button} border border-slate-300`}
            onClick={() => {
              filters.current?.reset();
              void load(true);
            }}
          >
            Reset
          </button>
        </div>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              {['APR No', 'Action', 'Source', 'Requester', 'Requested', 'Status', 'Action'].map(
                (x) => (
                  <th className="p-3 text-left" key={x}>
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={7}>
                  No approvals match this view.
                </td>
              </tr>
            ) : null}
            {rows.map((x) => (
              <tr className="border-t" key={x.id}>
                <td className="p-3 font-semibold">{x.approvalNumber}</td>
                <td>{x.actionType.replaceAll('_', ' ')}</td>
                <td>
                  {x.sourceType} · {x.sourceId}
                </td>
                <td>{x.requestedBy.displayName}</td>
                <td>{new Date(x.requestedAt).toLocaleString()}</td>
                <td>{x.status}</td>
                <td>
                  <Link href={`/approvals/${x.id}`}>Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <p role="status">Loading approvals...</p> : null}
    </main>
  );
}
export function ApprovalDetail({ id }: { id: string }) {
  const [row, setRow] = useState<Approval | null>(null),
    [note, setNote] = useState(''),
    [error, setError] = useState('');
  const load = () =>
    securityApi
      .approval(id)
      .then(setRow)
      .catch(() => setError('Unable to load approval.'));
  useEffect(() => {
    void load();
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!row) return <p>Loading approval…</p>;
  const decide = (action: 'approve' | 'reject') =>
    securityApi
      .decide(id, action, note)
      .then(load)
      .catch((x: unknown) => setError(x instanceof Error ? x.message : 'Decision failed.'));
  const sourceHref = approvalSourceHref(row);
  return (
    <main className="space-y-4">
      <Link href="/approvals">← Approval inbox</Link>
      <header>
        <h1 className="text-2xl font-bold">{row.approvalNumber}</h1>
        <p>
          {row.actionType.replaceAll('_', ' ')} · {row.status}
        </p>
      </header>
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-bold">Review context</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Action</dt>
            <dd>{row.actionType.replaceAll('_', ' ')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Source</dt>
            <dd>
              {sourceHref ? (
                <Link className="font-semibold text-emerald-800 underline" href={sourceHref}>
                  {row.sourceType} · {row.sourceId}
                </Link>
              ) : (
                `${row.sourceType} · ${row.sourceId}`
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Requester</dt>
            <dd>{row.requestedBy.displayName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Requested</dt>
            <dd>{new Date(row.requestedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Current source state</dt>
            <dd>{row.currentSourceState}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Lifecycle</dt>
            <dd>{row.status}</dd>
          </div>
          {row.reviewedBy ? (
            <div>
              <dt className="text-slate-500">Reviewer</dt>
              <dd>{row.reviewedBy.displayName}</dd>
            </div>
          ) : null}
          {row.reviewedAt ? (
            <div>
              <dt className="text-slate-500">Reviewed</dt>
              <dd>{new Date(row.reviewedAt).toLocaleString()}</dd>
            </div>
          ) : null}
          {row.executedAt ? (
            <div>
              <dt className="text-slate-500">Executed</dt>
              <dd>{new Date(row.executedAt).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 border-t pt-4">
          <h3 className="font-semibold">Impact summary</h3>
          <p>{row.impactSummary}</p>
          <p className="mt-2">
            <span className="font-medium">Reason:</span> {row.reason}
          </p>
          {row.requesterNote ? (
            <p>
              <span className="font-medium">Requester note:</span> {row.requesterNote}
            </p>
          ) : null}
          {row.reviewerNote ? (
            <p>
              <span className="font-medium">Reviewer note:</span> {row.reviewerNote}
            </p>
          ) : null}
        </div>
      </section>
      {row.status === 'PENDING' ? (
        <section className="rounded-xl border bg-white p-4">
          <label>
            Reviewer note
            <textarea
              className={`${control} min-h-24`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              className={button}
              onClick={() =>
                void securityApi
                  .cancel(id)
                  .then(load)
                  .catch((x: unknown) =>
                    setError(x instanceof Error ? x.message : 'Unable to cancel request.'),
                  )
              }
            >
              Cancel request
            </button>
            <button className={button} onClick={() => void decide('reject')}>
              Reject
            </button>
            <button
              className={`${button} bg-emerald-700 text-white`}
              onClick={() => void decide('approve')}
            >
              Approve
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function approvalSourceHref(row: Approval) {
  const paths: Record<string, string> = {
    Expense: '/expenses/',
    Damage: '/damages/',
    SaleReturn: '/sales/returns/',
    PurchaseReturn: '/purchases/returns/',
    JournalEntry: '/accounting/journals/',
    BusinessMembership: '/settings/team/',
  };
  if (row.sourceType === 'FiscalPeriod') return '/accounting/fiscal-periods';
  return paths[row.sourceType] ? paths[row.sourceType] + row.sourceId : null;
}
export function PoliciesWorkspace() {
  const [rows, setRows] = useState<Policy[]>([]),
    [error, setError] = useState('');
  const load = () =>
    securityApi
      .policies()
      .then(setRows)
      .catch(() => setError('Unable to load approval policies.'));
  useEffect(() => {
    void load();
  }, []);
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Approval policies</h1>
      <p>Business-defined server thresholds. Self-approval is disabled by default.</p>
      {error ? <p role="alert">{error}</p> : null}
      {rows.map((p) => (
        <form
          className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4"
          key={p.id}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void securityApi
              .savePolicy(p.actionType, {
                enabled: f.get('enabled') === 'on',
                thresholdType: f.get('thresholdType'),
                thresholdValue: f.get('thresholdValue') || null,
                approverRoleId: p.approverRoleId ?? null,
                allowSelfApproval: false,
                expiresAfterHours: 24,
              })
              .then(() => {
                void load();
              })
              .catch(() => setError('Unable to save approval policy.'));
          }}
        >
          <strong>{p.actionType.replaceAll('_', ' ')}</strong>
          <label>
            <input name="enabled" type="checkbox" defaultChecked={p.enabled} /> Enabled
          </label>
          <select name="thresholdType" className={control} defaultValue={p.thresholdType}>
            <option>NONE</option>
            <option>ALWAYS</option>
            <option>AMOUNT</option>
            <option>PERCENTAGE</option>
          </select>
          <label>
            <span className="sr-only">Threshold</span>
            <input
              name="thresholdValue"
              className={control}
              defaultValue={p.thresholdValue ?? ''}
            />
          </label>
          <button className={button}>Save policy</button>
        </form>
      ))}
    </main>
  );
}
export function AuditWorkspace() {
  const [rows, setRows] = useState<AuditEvent[]>([]),
    [members, setMembers] = useState<Array<{ id: string; name: string }>>([]),
    [selected, setSelected] = useState<AuditEvent | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const filters = useRef<HTMLFormElement>(null);
  const detail = useRef<HTMLElement>(null);
  const load = (reset = false) => {
    setLoading(true);
    const query = new URLSearchParams();
    if (!reset && filters.current)
      new FormData(filters.current).forEach((value, key) => {
        if (typeof value === 'string' && value) query.set(key, value);
      });
    return securityApi
      .audits(query.size ? `?${query.toString()}` : '')
      .then(setRows)
      .catch(() => setError('Unable to load audit events. Check your connection and retry.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void load();
    void securityApi
      .team()
      .then((team) =>
        setMembers(team.map((item) => ({ id: item.user.id, name: item.user.displayName }))),
      );
  }, []);
  useEffect(() => {
    if (selected) detail.current?.focus();
  }, [selected]);
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-slate-600">
        Append-only operational and security evidence. Audit history cannot be edited or deleted.
      </p>
      <form
        ref={filters}
        className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="text-xs font-medium text-slate-600">
          Search
          <input name="search" className={control} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Actor
          <select name="actorUserId" className={control}>
            <option value="">All actors</option>
            {members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Module / entity
          <input name="module" className={control} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Action
          <input name="action" className={control} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          From date
          <input name="dateFrom" type="date" className={control} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To date
          <input name="dateTo" type="date" className={control} />
        </label>
        <div className="flex items-end gap-2">
          <button className={`${button} bg-slate-900 text-white`}>Apply</button>
          <button
            type="button"
            className={`${button} border border-slate-300`}
            onClick={() => {
              filters.current?.reset();
              void load(true);
            }}
          >
            Reset
          </button>
        </div>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr>
              {['Time', 'Actor', 'Action', 'Module', 'Document', 'Summary'].map((x) => (
                <th className="p-3 text-left" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  No audit events match these filters.
                </td>
              </tr>
            ) : null}
            {rows.map((x) => (
              <tr className="border-t" key={x.id}>
                <td className="p-3">{new Date(x.createdAt).toLocaleString()}</td>
                <td>{x.actor?.displayName ?? 'System'}</td>
                <td>{x.action}</td>
                <td>{x.entityType}</td>
                <td>{x.entityId ?? '—'}</td>
                <td>
                  <button
                    className="min-h-11 text-left font-medium text-emerald-800 underline"
                    aria-expanded={selected?.id === x.id}
                    onClick={() =>
                      void securityApi
                        .audit(x.id)
                        .then(setSelected)
                        .catch(() => setError('Unable to load audit detail.'))
                    }
                  >
                    {x.summary ?? 'Recorded event'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <p role="status">Loading audit events...</p> : null}
      {selected ? (
        <section
          ref={detail}
          tabIndex={-1}
          aria-labelledby="audit-detail-title"
          className="rounded-xl border bg-white p-4 outline-none focus:ring-2 focus:ring-emerald-700"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="audit-detail-title" className="text-lg font-bold">
                Audit event detail
              </h2>
              <p className="text-sm text-slate-600">{selected.summary ?? 'Recorded event'}</p>
            </div>
            <button
              className={`${button} border border-slate-300`}
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-slate-500">Time</dt>
              <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Actor</dt>
              <dd>{selected.actor?.displayName ?? 'System'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Action</dt>
              <dd>{selected.action}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Module</dt>
              <dd>{selected.entityType}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Entity ID</dt>
              <dd className="break-anywhere">{selected.entityId ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Request ID</dt>
              <dd className="break-anywhere">{selected.requestId ?? 'Not recorded'}</dd>
            </div>
          </dl>
          {auditChanges(selected.metadata).length ? (
            <div className="mt-4 border-t pt-4">
              <h3 className="font-semibold">Changes</h3>
              <dl className="mt-2 grid gap-2 text-sm">
                {auditChanges(selected.metadata).map(([field, before, after]) => (
                  <div
                    className="grid gap-1 rounded-lg bg-slate-50 p-3 sm:grid-cols-[10rem_1fr]"
                    key={field}
                  >
                    <dt className="font-medium">{field}</dt>
                    <dd>
                      {before} → {after}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function auditChanges(metadata: unknown): Array<[string, string, string]> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const record = metadata as Record<string, unknown>;
  const before =
    record.before && typeof record.before === 'object' && !Array.isArray(record.before)
      ? (record.before as Record<string, unknown>)
      : {};
  const after =
    record.after && typeof record.after === 'object' && !Array.isArray(record.after)
      ? (record.after as Record<string, unknown>)
      : {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !/password|token|authorization|cookie|secret|private.?key/i.test(key))
    .map((key) => [key.replaceAll('_', ' '), auditValue(before[key]), auditValue(after[key])]);
}

function auditValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : value == null
      ? 'Not set'
      : 'Changed';
}
