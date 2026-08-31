'use client';
const base = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
async function call<T>(path: string, init?: RequestInit) {
  if (!navigator.onLine)
    throw new Error(
      path.startsWith('/damages')
        ? 'Internet connection required to record inventory damage.'
        : 'Internet connection is required.',
    );
  const token = sessionStorage.getItem('hello_shop_access');
  const r = await fetch(base() + path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token ?? ''}`,
      ...init?.headers,
    },
  });
  const p = (await r.json()) as { data?: T; error?: { message?: string } };
  if (!r.ok || p.data === undefined) throw new Error(p.error?.message ?? 'Request failed.');
  return p.data;
}
export type Damage = {
  id: string;
  damageNumber: string;
  damageDate: string;
  reason: string;
  notes: string | null;
  status: string;
  totalDamageValue: string;
  warehouse: { name: string };
  business: { name: string };
  createdBy: { displayName: string };
  postedBy: { displayName: string } | null;
  lines: Array<{
    id: string;
    quantity: string;
    unitCostSnapshot: string;
    totalDamageValue: string;
    product: { id: string; name: string; sku: string };
    serials: Array<{ serialItem: { id: string; serialNumber: string } }>;
  }>;
};
export type Expense = {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  amount: string;
  description: string;
  payee: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  category: { id: string; name: string };
  business: { name: string };
  createdBy: { displayName: string };
  postedBy: { displayName: string } | null;
};
export const damageApi = {
  list: (query = '') => call<{ rows: Damage[]; total: number }>(`/damages${query}`),
  find: (id: string) => call<Damage>(`/damages/${id}`),
  create: (x: unknown) => call<Damage>('/damages', { method: 'POST', body: JSON.stringify(x) }),
  update: (id: string, x: unknown) =>
    call<Damage>(`/damages/${id}`, { method: 'PATCH', body: JSON.stringify(x) }),
  post: (id: string) => call<Damage>(`/damages/${id}/post`, { method: 'POST' }),
  remove: (id: string) => call(`/damages/${id}`, { method: 'DELETE' }),
};
export const expenseApi = {
  list: (query = '') =>
    call<{ rows: Expense[]; total: number; postedTotal: string }>(`/expenses${query}`),
  find: (id: string) => call<Expense>(`/expenses/${id}`),
  create: (x: unknown) => call<Expense>('/expenses', { method: 'POST', body: JSON.stringify(x) }),
  update: (id: string, x: unknown) =>
    call<Expense>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(x) }),
  post: (id: string) => call<Expense>(`/expenses/${id}/post`, { method: 'POST' }),
  remove: (id: string) => call(`/expenses/${id}`, { method: 'DELETE' }),
  categories: () =>
    call<Array<{ id: string; name: string; description: string | null; isActive: boolean }>>(
      '/expense-categories',
    ),
  createCategory: (x: unknown) =>
    call('/expense-categories', { method: 'POST', body: JSON.stringify(x) }),
  updateCategory: (id: string, x: unknown) =>
    call(`/expense-categories/${id}`, { method: 'PATCH', body: JSON.stringify(x) }),
};
export const damageOptions = async () => {
  const [w, p, s] = await Promise.all([
    call<Array<{ id: string; name: string }>>('/warehouses'),
    call<{
      rows: Array<{
        id: string;
        name: string;
        sku: string;
        purchasePrice: string;
        serialized: boolean;
      }>;
    }>('/products?limit=100'),
    call<{
      rows: Array<{
        id: string;
        serialNumber: string;
        productId: string;
        warehouseId: string;
        status: string;
      }>;
    }>('/serials?limit=100&status=IN_STOCK'),
  ]);
  return { warehouses: w, products: p.rows, serials: s.rows };
};
