'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { securityApi, type Role, type TeamMember } from '@/lib/api/team-security';
import { ApprovalRequiredError } from '@/lib/api/api-error';
import { ApprovalRequiredNotice } from './approval-required-notice';
import { button, control } from './team-workspace';
export function InviteWorkspace() {
  const [roles, setRoles] = useState<Role[]>([]),
    [email, setEmail] = useState(''),
    [roleId, setRole] = useState(''),
    [jobTitle, setJobTitle] = useState(''),
    [employeeCode, setEmployeeCode] = useState(''),
    [link, setLink] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    securityApi
      .roles()
      .then((x) => {
        setRoles(x);
        setRole(x[0]?.id ?? '');
      })
      .catch(() => setError('Unable to load roles.'));
  }, []);
  return (
    <main className="mx-auto max-w-xl space-y-4">
      <Link href="/settings/team">← Team</Link>
      <form
        className="rounded-xl border bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          securityApi
            .invite({
              email,
              roleId,
              jobTitle: jobTitle || null,
              employeeCode: employeeCode || null,
              expiresInHours: 72,
            })
            .then((x) =>
              setLink(
                `${location.origin}/accept-invitation?token=${encodeURIComponent(x.inviteToken ?? '')}`,
              ),
            )
            .catch((x: unknown) => setError(x instanceof Error ? x.message : 'Unable to invite.'));
        }}
      >
        <h1 className="text-2xl font-bold">Invite member</h1>
        <p className="text-sm text-slate-500">
          The secure link expires after 72 hours. No password is created by an administrator.
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <label className="mt-4 block">
          Email
          <input
            required
            type="email"
            className={control}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-3 block">
          Job title <span className="text-slate-500">optional</span>
          <input
            className={control}
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </label>
        <label className="mt-3 block">
          Employee code <span className="text-slate-500">optional</span>
          <input
            className={control}
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
          />
        </label>
        <label className="mt-3 block">
          Role
          <select
            required
            className={control}
            value={roleId}
            onChange={(e) => setRole(e.target.value)}
          >
            {roles
              .filter((x) => x.isActive)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
        <button className={`${button} mt-4 bg-emerald-700 text-white`}>Create invite</button>
      </form>
      {link ? (
        <section role="status" className="rounded-xl bg-emerald-50 p-4">
          <strong>Invitation created</strong>
          <p className="break-all text-sm">{link}</p>
          <button className={button} onClick={() => void navigator.clipboard.writeText(link)}>
            Copy invite link
          </button>
        </section>
      ) : null}
    </main>
  );
}
export function MemberWorkspace({ id }: { id: string }) {
  const [member, setMember] = useState<TeamMember | null>(null),
    [roles, setRoles] = useState<Role[]>([]),
    [approval, setApproval] = useState<ApprovalRequiredError | null>(null),
    [error, setError] = useState('');
  const load = () =>
    Promise.all([securityApi.member(id), securityApi.roles()])
      .then(([m, r]) => {
        setMember(m);
        setRoles(r);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load member.'));
  useEffect(() => {
    void load();
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!member) return <p>Loading member…</p>;
  const act = (x: Promise<unknown>) =>
    x
      .then(() => {
        setApproval(null);
        return load();
      })
      .catch((reason: unknown) => {
        if (reason instanceof ApprovalRequiredError) setApproval(reason);
        else setError(reason instanceof Error ? reason.message : 'Security action failed.');
      });
  return (
    <main className="space-y-4">
      <Link href="/settings/team">← Team</Link>
      <h1 className="text-2xl font-bold">{member.user.displayName}</h1>
      {approval ? <ApprovalRequiredNotice error={approval} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-bold">Profile & employment</h2>
          <p>{member.user.email}</p>
          <p>
            {member.employeeCode || 'No employee code'} · {member.jobTitle || 'No job title'}
          </p>
          <p>
            {member.phone || 'No phone'} · {member.employmentType || 'Not specified'}
          </p>
        </section>
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-bold">Access & security</h2>
          <p>{member.status}</p>
          <label>
            Assigned role
            <select
              className={control}
              value={member.role.id}
              onChange={(e) => void act(securityApi.changeRole(id, e.target.value))}
            >
              {roles
                .filter((x) => x.isActive)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {member.status === 'ACTIVE' ? (
              <button
                className={button}
                onClick={() =>
                  confirm('Suspend and revoke sessions?') && void act(securityApi.suspend(id))
                }
              >
                Suspend
              </button>
            ) : (
              <button className={button} onClick={() => void act(securityApi.reactivate(id))}>
                Reactivate
              </button>
            )}
            <button
              className={button}
              onClick={() =>
                confirm('Revoke all active sessions?') && void act(securityApi.revokeSessions(id))
              }
            >
              Revoke sessions
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
