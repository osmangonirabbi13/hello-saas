'use client';
import Link from 'next/link';
import { useState } from 'react';
import { securityApi } from '@/lib/api/team-security';
import { button, control } from './team-workspace';
export function InvitationRegistration({ token }: { token: string }) {
  const [email, setEmail] = useState(''),
    [displayName, setName] = useState(''),
    [password, setPassword] = useState(''),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  if (!token)
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-bold">Invitation unavailable</h1>
        <p>The invitation link is missing or invalid.</p>
      </main>
    );
  if (done)
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-bold">Invitation accepted</h1>
        <p>Your account and business access are ready.</p>
        <Link className={button} href="/login">
          Sign in
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-md p-6">
      <form
        className="space-y-4 rounded-xl border bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          securityApi
            .registerInvitation({ token, email, displayName, password })
            .then(() => setDone(true))
            .catch((x: unknown) =>
              setError(x instanceof Error ? x.message : 'Unable to accept invitation.'),
            );
        }}
      >
        <h1 className="text-2xl font-bold">Join the team</h1>
        <p className="text-sm text-slate-600">
          Create your own secure login. Your business and role come from the invitation.
        </p>
        {error ? (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        ) : null}
        <label className="block">
          Name
          <input
            className={control}
            required
            value={displayName}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          Invited email
          <input
            className={control}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          Password
          <input
            className={control}
            type="password"
            minLength={12}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className={`${button} w-full bg-emerald-700 text-white`}>Accept invitation</button>
      </form>
    </main>
  );
}
