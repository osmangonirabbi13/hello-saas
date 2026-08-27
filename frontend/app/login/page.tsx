'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1') + '/auth/login',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
        },
      );
      const payload = (await response.json()) as {
        success: boolean;
        data?: { accessToken: string; permissions: string[] };
        error?: { message: string };
      };
      if (!response.ok || !payload.data)
        throw new Error(payload.error?.message ?? 'Unable to sign in.');
      sessionStorage.setItem('hello_shop_access', payload.data.accessToken);
      sessionStorage.setItem('hello_shop_permissions', JSON.stringify(payload.data.permissions));
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <span className="brand-mark">H</span>
        <h1>Welcome to Hello shop</h1>
        <p>Sign in to your business workspace.</p>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
