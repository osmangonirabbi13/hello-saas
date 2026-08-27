'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Store } from 'lucide-react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function RegisterPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submitAsync(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const businessValue = data.get('businessName');
    const businessName = typeof businessValue === 'string' ? businessValue : '';
    const payload = {
      displayName: data.get('displayName'),
      email: data.get('email'),
      password: data.get('password'),
      businessName,
      businessSlug: businessName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    };
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!response.ok)
        throw new Error('Registration could not be completed. Check your details and try again.');
      window.location.assign('/dashboard');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration failed.');
      setBusy(false);
    }
  }
  function handleSubmitEvent(event: FormEvent<HTMLFormElement>) {
    void submitAsync(event);
  }
  const submit = handleSubmitEvent;
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[.9fr_1.1fr]">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-black">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-500">
            <Store size={20} />
          </span>
          Hello Shop
        </Link>
        <div>
          <p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-400">
            7-day free trial
          </p>
          <h1 className="mt-4 max-w-lg text-5xl font-black leading-tight">
            A cleaner operating system for your shop.
          </h1>
          <ul className="mt-8 space-y-4 text-slate-300">
            {[
              'No payment details required',
              'Trial dates are controlled securely by the server',
              'Cancel or choose a plan after evaluating the workflow',
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <CheckCircle2 className="text-emerald-400" size={20} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-500">
          Secure tenant isolation and API-enforced permissions are built in.
        </p>
      </section>
      <section className="flex items-center justify-center p-5 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-bold text-emerald-700">Start your workspace</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Create your Hello Shop account
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Your seven-day trial starts when the server creates your business.
          </p>
          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="mt-7 space-y-4">
            {[
              ['displayName', 'Your name', 'text'],
              ['businessName', 'Business name', 'text'],
              ['email', 'Work email', 'email'],
              ['password', 'Password', 'password'],
            ].map(([name, label, type]) => (
              <label key={name} className="block text-sm font-semibold text-slate-700">
                {label}
                <input
                  required
                  minLength={name === 'password' ? 10 : 2}
                  name={name}
                  type={type}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            ))}
            <Button busy={busy} />
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">
            Already registered?{' '}
            <Link className="font-bold text-emerald-700" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
function Button({ busy }: { busy: boolean }) {
  return (
    <button
      disabled={busy}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {busy ? 'Creating workspace…' : 'Start free trial'}
      <ArrowRight size={17} />
    </button>
  );
}
