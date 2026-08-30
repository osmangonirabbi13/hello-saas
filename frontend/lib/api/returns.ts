'use client';
export type ReturnKind = 'purchase' | 'sale';
const base = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!navigator.onLine) throw new Error('Internet connection required for returns.');
  const token = sessionStorage.getItem('hello_shop_access');
  if (!token) throw new Error('Authentication is required.');
  const response = await fetch(base() + path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.error?.message ?? 'Return request failed.');
  return payload.data;
}
export const listReturns = <T>(kind: ReturnKind) => call<T[]>(`/${kind}-returns`);
export const getReturn = <T>(kind: ReturnKind, id: string) =>
  call<T>(`/${kind}-returns/${encodeURIComponent(id)}`);
export const getReturnable = <T>(kind: ReturnKind, id: string) =>
  call<T>(`/${kind}-returns/source/${encodeURIComponent(id)}/returnable`);
export const createReturn = <T>(kind: ReturnKind, input: unknown) =>
  call<T>(`/${kind}-returns`, { method: 'POST', body: JSON.stringify(input) });
export const updateReturn = <T>(kind: ReturnKind, id: string, input: unknown) =>
  call<T>(`/${kind}-returns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const postReturn = <T>(kind: ReturnKind, id: string) =>
  call<T>(`/${kind}-returns/${encodeURIComponent(id)}/post`, { method: 'POST' });
