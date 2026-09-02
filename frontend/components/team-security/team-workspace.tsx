'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { securityApi, type Role, type TeamMember } from '@/lib/api/team-security';
export const control = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm';
export const button =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold';
export function TeamWorkspace() {
  const [rows, setRows] = useState<TeamMember[]>([]),
    [roles, setRoles] = useState<Role[]>([]),
    [search, setSearch] = useState(''),
    [roleId, setRoleId] = useState(''),
    [status, setStatus] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const load = () => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (roleId) query.set('roleId', roleId);
    if (status) query.set('status', status);
    return securityApi
      .team(query.size ? `?${query.toString()}` : '')
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load team.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void Promise.all([load(), securityApi.roles().then(setRoles)]).catch(() =>
      setError('Unable to load team filters.'),
    );
  }, []);
  return (
    <main className="space-y-4">
      <TeamHeader />
      <form
        className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_12rem_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <input
          aria-label="Search team"
          className={control}
          placeholder="Search name, email, employee code..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter by role"
          className={control}
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option value={role.id} key={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          className={control}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button className={`${button} bg-slate-900 text-white`}>Apply filters</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p role="status">Loading team...</p> : <TeamTable rows={rows} />}
    </main>
  );
}
function TeamHeader() {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p>Manage staff access, roles and responsibilities.</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        <Link className={button} href="/settings/roles">
          Manage Roles
        </Link>
        <Link className={button} href="/settings/team/invite">
          Invite Member
        </Link>
      </nav>
    </header>
  );
}
function TeamTable({ rows }: { rows: TeamMember[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr>
            {['Member', 'Employee Code', 'Job Title', 'Role', 'Status'].map((x) => (
              <th className="p-3 text-left" key={x}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="p-6 text-center text-slate-500" colSpan={5}>
                No team members match these filters.
              </td>
            </tr>
          ) : null}
          {rows.map((m) => (
            <tr className="border-t" key={m.id}>
              <td className="p-3">
                <Link href={`/settings/team/${m.id}`}>{m.user.displayName}</Link>
                <small className="block">{m.user.email}</small>
              </td>
              <td>{m.employeeCode || '—'}</td>
              <td>{m.jobTitle || '—'}</td>
              <td>{m.role.name}</td>
              <td>{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
