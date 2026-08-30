'use client';
const base = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
async function call<T>(path: string, init?: RequestInit) {
  if (!navigator.onLine) throw new Error('Internet connection is required.');
  const token = sessionStorage.getItem('hello_shop_access');
  if (!token) throw new Error('Authentication is required.');
  const r = await fetch(base() + path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const p = (await r.json()) as { data?: T; error?: { message?: string } };
  if (!r.ok || p.data === undefined) throw new Error(p.error?.message ?? 'Request failed.');
  return p.data;
}
export type ServiceItem = {
  id: string;
  serviceNumber: string;
  status: string;
  priority: string;
  type: string;
  deviceName: string;
  deviceBrand: string | null;
  deviceModel: string | null;
  externalSerialNumber: string | null;
  condition: string;
  conditionNote: string | null;
  accessories: string[];
  accessoriesNote: string | null;
  customerComplaint: string;
  diagnosis: string | null;
  recommendedWork: string | null;
  workPerformed: string | null;
  approvalStatus: string;
  estimatedServiceCharge: string;
  estimatedPartsCost: string;
  serviceCharge: string;
  partsCharge: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  receivedAt: string;
  deliveredAt: string | null;
  business: { name: string };
  customer: { id: string; name: string; phone: string } | null;
  serialItem: { serialNumber: string } | null;
  assignee: { id: string; displayName: string } | null;
  parts: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  history: Array<{
    id: string;
    toStatus: string;
    note: string | null;
    createdAt: string;
    actor: { displayName: string };
  }>;
};
export type QuotationItem = {
  id: string;
  quotationNumber: string;
  status: string;
  quotationDate: string;
  validUntil: string;
  reference: string | null;
  prospectName: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  customerNote: string | null;
  internalNote: string | null;
  terms: string | null;
  business: { name: string };
  customer: { id: string; name: string; phone: string } | null;
  convertedSale: { id: string; saleNumber: string } | null;
  lines: Array<{
    id: string;
    productId: string;
    description: string | null;
    quantity: string;
    unitPrice: string;
    discountAmount: string;
    taxAmount: string;
    lineTotal: string;
    product: { name: string; sku: string; barcode: string | null };
  }>;
  history: Array<{
    id: string;
    toStatus: string;
    createdAt: string;
    actor: { displayName: string };
  }>;
};
export const listServices = () => call<{ rows: ServiceItem[]; total: number }>('/services');
export const getService = (id: string) => call<ServiceItem>(`/services/${id}`);
export const createService = (i: unknown) =>
  call<ServiceItem>('/services', { method: 'POST', body: JSON.stringify(i) });
export const updateService = (id: string, i: unknown) =>
  call<ServiceItem>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(i) });
export const moveService = (id: string, a: string) =>
  call<ServiceItem>(`/services/${id}/${a}`, { method: 'POST', body: '{}' });
export const listServiceAssignees = () =>
  call<Array<{ user: { id: string; displayName: string } }>>('/services/options/assignees');
export const listQuotations = () => call<{ rows: QuotationItem[]; total: number }>('/quotations');
export const getQuotation = (id: string) => call<QuotationItem>(`/quotations/${id}`);
export const createQuotation = (i: unknown) =>
  call<QuotationItem>('/quotations', { method: 'POST', body: JSON.stringify(i) });
export const updateQuotation = (id: string, i: unknown) =>
  call<QuotationItem>(`/quotations/${id}`, { method: 'PATCH', body: JSON.stringify(i) });
export const moveQuotation = (id: string, a: string) =>
  call<QuotationItem>(`/quotations/${id}/${a}`, { method: 'POST', body: '{}' });
export const convertQuotation = (id: string) =>
  call<{ quotation: QuotationItem; sale: { id: string } }>(`/quotations/${id}/convert-to-sale`, {
    method: 'POST',
  });
export const loadOptions = async () => {
  const [c, p, s] = await Promise.all([
    call<{ rows: Array<{ id: string; name: string; phone: string }> }>('/customers?limit=100'),
    call<{
      rows: Array<{
        id: string;
        name: string;
        sku: string;
        barcode: string | null;
        salePrice: string;
      }>;
    }>('/products?limit=100'),
    call<{ rows: Array<{ id: string; serialNumber: string; productId: string }> }>(
      '/serials?limit=100',
    ),
  ]);
  return { customers: c.rows, products: p.rows, serials: s.rows };
};
