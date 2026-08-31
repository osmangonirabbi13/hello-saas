'use client';
const base = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
async function call<T>(path: string, init?: RequestInit, idempotent = false) {
  if (!navigator.onLine)
    throw new Error('Internet connection required for financial transactions.');
  const token = sessionStorage.getItem('hello_shop_access');
  const response = await fetch(base() + path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token ?? ''}`,
      ...(idempotent ? { 'Idempotency-Key': `op_${crypto.randomUUID()}` } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.error?.message ?? 'Request failed.');
  return payload.data;
}
export type FinancialAccount = {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  description: string | null;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  branch: string | null;
  mobileNumber: string | null;
  isActive: boolean;
  balance: string;
};
export type FinancialTransaction = {
  id: string;
  transactionNo: string;
  type: string;
  direction: 'IN' | 'OUT';
  status: string;
  amount: string;
  transactionDate: string;
  description: string;
  counterparty: string | null;
  reference: string | null;
  notes: string | null;
  runningBalance?: string;
  account: Pick<FinancialAccount, 'id' | 'accountCode' | 'name' | 'type'>;
  createdBy: { displayName: string };
  transfer?: { id: string; transferNo: string } | null;
};
export type FinancialTransfer = {
  id: string;
  transferNo: string;
  amount: string;
  transferDate: string;
  reference: string | null;
  notes: string | null;
  sourceAccount: Pick<FinancialAccount, 'id' | 'accountCode' | 'name' | 'type'>;
  destinationAccount: Pick<FinancialAccount, 'id' | 'accountCode' | 'name' | 'type'>;
  createdBy: { displayName: string };
  transactions: Array<{ id: string; transactionNo: string; direction: string; amount: string }>;
};
type Page<T> = { rows: T[]; page: number; limit: number; total: number; totalPages: number };
export const financeApi = {
  accounts: (query = '') => call<FinancialAccount[]>(`/financial-accounts${query}`),
  account: (id: string) => call<FinancialAccount>(`/financial-accounts/${id}`),
  createAccount: (body: unknown) =>
    call<FinancialAccount>(
      '/financial-accounts',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),
  updateAccount: (id: string, body: unknown) =>
    call<FinancialAccount>(`/financial-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  disableAccount: (id: string) =>
    call<FinancialAccount>(`/financial-accounts/${id}/disable`, { method: 'POST' }),
  enableAccount: (id: string) =>
    call<FinancialAccount>(`/financial-accounts/${id}/enable`, { method: 'POST' }),
  statement: (id: string, query = '') =>
    call<{ openingBalance: string; closingBalance: string } & Page<FinancialTransaction>>(
      `/financial-accounts/${id}/statement${query}`,
    ),
  transactions: (query = '') => call<Page<FinancialTransaction>>(`/financial-transactions${query}`),
  transaction: (id: string) => call<FinancialTransaction>(`/financial-transactions/${id}`),
  moneyIn: (body: unknown) =>
    call<FinancialTransaction>(
      '/financial-transactions/money-in',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),
  moneyOut: (body: unknown) =>
    call<FinancialTransaction>(
      '/financial-transactions/money-out',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),
  adjustment: (body: unknown) =>
    call<FinancialTransaction>(
      '/financial-transactions/adjustment',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),
  transfers: (query = '') => call<Page<FinancialTransfer>>(`/financial-transfers${query}`),
  transfer: (id: string) => call<FinancialTransfer>(`/financial-transfers/${id}`),
  createTransfer: (body: unknown) =>
    call<FinancialTransfer>(
      '/financial-transfers',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),
};
