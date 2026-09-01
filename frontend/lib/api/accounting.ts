'use client';
const base = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
async function call<T>(path: string, init?: RequestInit) {
  if (!navigator.onLine) throw new Error('Internet connection required for accounting operations.');
  const token = sessionStorage.getItem('hello_shop_access');
  const response = await fetch(base() + path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + (token ?? ''),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as { data?: T; error?: { message?: string } };
  if (response.status === 401) {
    sessionStorage.removeItem('hello_shop_access');
    window.location.assign('/login?reason=session-expired');
  }
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.error?.message ?? 'Request failed.');
  return payload.data;
}
export type ChartAccount = {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  systemKey: string | null;
  parentId: string | null;
  description: string | null;
  isSystem: boolean;
  allowManualPosting: boolean;
  isActive: boolean;
  parent?: { id: string; code: string; name: string } | null;
};
export type JournalLine = {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string | null;
  account?: ChartAccount;
};
export type Journal = {
  id: string;
  journalNumber: string;
  date: string;
  memo: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  sourceType: string;
  sourceId: string;
  sourceEvent: string;
  fiscalPeriodId: string;
  postedAt: string | null;
  lines: JournalLine[];
  createdBy?: { displayName: string };
  postedBy?: { displayName: string };
  reversal?: { id: string; journalNumber: string } | null;
  reversalOf?: { id: string; journalNumber: string } | null;
};
export type FiscalPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
};
export type FinancialAccount = {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  balance: string;
  chartAccountId?: string | null;
  isActive: boolean;
};
export type ExpenseCategory = {
  id: string;
  name: string;
  chartAccountId?: string | null;
  isActive: boolean;
};
export type AgingSummary = {
  total: string;
  CURRENT: string;
  '1_30': string;
  '31_60': string;
  '61_90': string;
  '90_PLUS': string;
};
export type Receivable = {
  id: string;
  customerId: string | null;
  originalAmount: string;
  settledAmount: string;
  outstanding: string;
  dueDate: string | null;
  status: string;
  bucket: keyof Omit<AgingSummary, 'total'>;
  ageDays: number;
  customer: { name: string } | null;
  sale: { id: string; saleNumber: string; invoiceNumber: string; saleDate: string };
};
export type Payable = {
  id: string;
  supplierId: string;
  originalAmount: string;
  settledAmount: string;
  outstanding: string;
  dueDate: string | null;
  status: string;
  bucket: keyof Omit<AgingSummary, 'total'>;
  ageDays: number;
  supplier: { name: string };
  purchase: { id: string; purchaseNumber: string; purchaseDate: string };
};
export type PartyCredit = {
  id: string;
  kind: 'CUSTOMER_CREDIT' | 'SUPPLIER_CREDIT';
  customerId: string | null;
  supplierId: string | null;
  documentNumber: string;
  originalAmount: string;
  appliedAmount: string;
  status: 'AVAILABLE' | 'PARTIALLY_APPLIED' | 'APPLIED' | 'CANCELLED';
  occurredAt: string;
  customer?: { name: string } | null;
  supplier?: { name: string } | null;
};
export type SubledgerPage<T> = {
  rows: T[];
  summary: AgingSummary;
  credits: PartyCredit[];
  availableCredit: string;
  asOf: string;
};
export const accountingApi = {
  accounts: () => call<ChartAccount[]>('/accounting/accounts'),
  initialize: (fiscalYearStartMonth: number) =>
    call<{ accountCount: number }>('/accounting/initialize', {
      method: 'POST',
      body: JSON.stringify({ fiscalYearStartMonth }),
    }),
  createAccount: (data: Record<string, unknown>) =>
    call<ChartAccount>('/accounting/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: Record<string, unknown>) =>
    call<ChartAccount>('/accounting/accounts/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  journals: (query = '') => call<Journal[]>('/accounting/journals' + query),
  journal: (id: string) => call<Journal>('/accounting/journals/' + id),
  createJournal: (data: Record<string, unknown>) =>
    call<Journal>('/accounting/journals', { method: 'POST', body: JSON.stringify(data) }),
  updateJournal: (id: string, data: Record<string, unknown>) =>
    call<Journal>('/accounting/journals/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  postJournal: (id: string) =>
    call<Journal>('/accounting/journals/' + id + '/post', { method: 'POST' }),
  reverseJournal: (id: string) =>
    call<Journal>('/accounting/journals/' + id + '/reverse', { method: 'POST' }),
  periods: () => call<FiscalPeriod[]>('/accounting/fiscal-periods'),
  createPeriod: (data: Record<string, unknown>) =>
    call<FiscalPeriod>('/accounting/fiscal-periods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  closePeriod: (id: string) =>
    call<FiscalPeriod>('/accounting/fiscal-periods/' + id + '/close', { method: 'POST' }),
  reopenPeriod: (id: string) =>
    call<FiscalPeriod>('/accounting/fiscal-periods/' + id + '/reopen', { method: 'POST' }),
  financialAccounts: () => call<FinancialAccount[]>('/financial-accounts'),
  expenseCategories: () => call<ExpenseCategory[]>('/expense-categories'),
  mapFinancial: (id: string, chartAccountId: string) =>
    call<FinancialAccount>('/accounting/mappings/financial-accounts/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ chartAccountId }),
    }),
  mapExpense: (id: string, chartAccountId: string) =>
    call<ExpenseCategory>('/accounting/mappings/expense-categories/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ chartAccountId }),
    }),
  receivables: (query = '') => call<SubledgerPage<Receivable>>('/accounting/receivables' + query),
  payables: (query = '') => call<SubledgerPage<Payable>>('/accounting/payables' + query),
  receivePayment: (id: string, data: Record<string, unknown>) =>
    call<Receivable>('/accounting/receivables/' + id + '/receive-payment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  paySupplier: (id: string, data: Record<string, unknown>) =>
    call<Payable>('/accounting/payables/' + id + '/pay', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  receivableStatement: (id: string) =>
    call<{ rows: unknown[]; availableCredit: string }>(
      '/accounting/receivables/' + id + '/statement',
    ),
  payableStatement: (id: string) =>
    call<{ rows: unknown[]; availableCredit: string }>('/accounting/payables/' + id + '/statement'),
  applyCustomerCredit: (id: string, data: Record<string, unknown>) =>
    call('/accounting/customer-credits/' + id + '/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  applySupplierCredit: (id: string, data: Record<string, unknown>) =>
    call('/accounting/supplier-credits/' + id + '/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  trial: () =>
    call<{
      rows: Array<{ account: ChartAccount; debit: string; credit: string }>;
      totalDebit: string;
      totalCredit: string;
      balanced: boolean;
    }>('/accounting/reports/trial-balance'),
  ledger: (query = '') =>
    call<{
      rows: Array<JournalLine & { journalEntry: Journal; runningBalance: string }>;
      openingBalances: Record<string, string>;
      closingBalances: Record<string, string>;
    }>('/accounting/reports/general-ledger' + query),
  pnl: () =>
    call<{
      rows: Array<{ account: ChartAccount; debit: string; credit: string }>;
      revenue: string;
      cogs: string;
      grossProfit: string;
      operatingExpenses: string;
      netProfit: string;
    }>('/accounting/reports/profit-loss'),
};
