import { demoSaleCustomers, demoSaleProducts, demoSales } from '@/lib/demo/sales';

export type SaleMode = 'REGULAR' | 'VAT' | 'POS';
export type SaleSummary = {
  id: string;
  saleNumber: string;
  invoiceNumber: string;
  date: string;
  customer: string;
  type: SaleMode;
  warehouse: string;
  total: number;
  paid: number;
  due: number;
  status: 'DRAFT' | 'POSTED';
  createdBy: string;
  paymentState: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
};
export type SaleProduct = (typeof demoSaleProducts)[number];
export type SaleCustomer = (typeof demoSaleCustomers)[number];

export function listSales(): Promise<SaleSummary[]> {
  return Promise.resolve(
    demoSales.map((sale) => ({
      ...sale,
      paymentState:
        Number(sale.paid) === 0
          ? ('UNPAID' as const)
          : Number(sale.due) === 0
            ? ('PAID' as const)
            : ('PARTIALLY_PAID' as const),
    })),
  );
}
export async function getSale(id: string) {
  return (await listSales()).find((sale) => sale.id === id) ?? null;
}
export function saleProducts(): Promise<SaleProduct[]> {
  return Promise.resolve([...demoSaleProducts]);
}
export function saleCustomers(): Promise<SaleCustomer[]> {
  return Promise.resolve([...demoSaleCustomers]);
}
