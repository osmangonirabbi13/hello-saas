import { demoPurchaseProducts, demoPurchases } from '@/lib/demo/purchases';
export type PurchaseSummary = {
  id: string;
  purchaseNumber: string;
  date: string;
  supplier: string;
  supplierInvoice: string;
  warehouse: string;
  total: number;
  paid: number;
  due: number;
  status: 'DRAFT' | 'POSTED';
  createdBy: string;
  paymentState: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
};
export type PurchaseProduct = (typeof demoPurchaseProducts)[number];
export function listPurchases(): Promise<PurchaseSummary[]> {
  return Promise.resolve(
    demoPurchases.map((item) => ({
      ...item,
      paymentState:
        item.paid === 0 ? 'UNPAID' : item.paid >= item.total ? 'PAID' : 'PARTIALLY_PAID',
    })),
  );
}
export async function getPurchase(id: string) {
  return (await listPurchases()).find((item) => item.id === id) ?? null;
}
export function purchaseProducts(): Promise<PurchaseProduct[]> {
  return Promise.resolve(demoPurchaseProducts);
}
