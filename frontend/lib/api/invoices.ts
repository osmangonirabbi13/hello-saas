export type PersistedInvoice = {
  id: string;
  status: 'POSTED';
  saleNumber: string;
  invoiceNumber: string;
  saleDate: string;
  type: 'REGULAR' | 'VAT' | 'POS';
  subtotal: string;
  discountAmount: string;
  additionalCost: string;
  taxAmount: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  note: string | null;
  business: { id: string; name: string };
  customer: { name: string; phone: string } | null;
  createdBy: { id: string; displayName: string };
  postedBy: { id: string; displayName: string } | null;
  invoice: { id: string; invoiceNumber: string; issuedAt: string; total: string };
  lines: Array<{
    id: string;
    quantity: string;
    unitPrice: string;
    discountAmount: string;
    taxAmount: string;
    lineTotal: string;
    serialNumbers: string[];
    product: { name: string; sku: string };
  }>;
};
export async function fetchPersistedInvoice(saleId: string): Promise<PersistedInvoice> {
  const token = sessionStorage.getItem('hello_shop_access');
  if (!token) throw new Error('Authentication is required to view this invoice.');
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const response = await fetch(`${base}/sales/${encodeURIComponent(saleId)}/invoice`, {
    headers: { authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const payload = (await response.json()) as {
    data?: PersistedInvoice;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data)
    throw new Error(payload.error?.message ?? 'Unable to load the final invoice.');
  return payload.data;
}
