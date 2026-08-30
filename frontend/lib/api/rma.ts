'use client';
const base = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
async function call<T>(path: string, init?: RequestInit) {
  if (!navigator.onLine)
    throw new Error('Internet connection is required for warranty and RMA operations.');
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
    throw new Error(payload.error?.message ?? 'RMA request failed.');
  return payload.data;
}
export type RmaItem = {
  id: string;
  rmaNumber: string;
  publicToken: string;
  status: string;
  receivedAt: string;
  issue: string;
  issueDescription: string;
  physicalCondition: string;
  conditionNote: string | null;
  accessories: string[];
  accessoriesNote: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  warrantyEligible: boolean;
  warrantyEnd: string | null;
  business: { name: string };
  product: { name: string; sku: string };
  serialItem: { id: string; serialNumber: string; status: string } | null;
  customer: { name: string } | null;
  supplier: { name: string } | null;
  sale: { invoiceNumber: string; saleNumber: string };
  history: Array<{
    id: string;
    toStatus: string;
    action: string;
    note: string | null;
    createdAt: string;
    actor: { displayName: string };
  }>;
};
export const listRmas = () => call<{ items: RmaItem[]; total: number }>('/rmas');
export const getRma = (id: string) => call<RmaItem>(`/rmas/${encodeURIComponent(id)}`);
export const createRma = (input: unknown) =>
  call<RmaItem>('/rmas', { method: 'POST', body: JSON.stringify(input) });
export const updateRma = (id: string, input: unknown) =>
  call<RmaItem>(`/rmas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const transitionRma = (id: string, action: string, note = '') =>
  call<RmaItem>(`/rmas/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
export const checkWarranty = (serial: string) =>
  call<{
    eligible: boolean;
    reason: string;
    warrantyStart: string | null;
    warrantyEnd: string | null;
    serialItem: {
      id: string;
      serialNumber: string;
      product: { name: string };
      sale: { invoiceNumber: string };
    };
  }>(`/rmas/warranty/lookup?serial=${encodeURIComponent(serial)}`);
export const getSerialHistory = (id: string) =>
  call<SerialDetail>(`/rmas/serials/${encodeURIComponent(id)}/history`);
export type SerialDetail={id:string;serialNumber:string;status:string;warrantyStart:string|null;warrantyEnd:string|null;updatedAt:string;product:{name:string;sku:string};warehouse:{name:string};history:Array<{id:string;eventType:string;referenceType:string;referenceId:string;occurredAt:string}>;rmas:Array<{id:string;rmaNumber:string;status:string;receivedAt:string}>};
export const listWarrantySerials=()=>call<{rows:SerialDetail[];total:number}>('/serials?limit=100');
