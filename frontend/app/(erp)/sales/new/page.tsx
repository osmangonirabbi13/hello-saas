import { SaleForm } from '@/components/sale/sale-form';
import { saleCustomers, saleProducts } from '@/lib/api/sales';
export default async function Page() {
  const [products, customers] = await Promise.all([saleProducts(), saleCustomers()]);
  return <SaleForm products={products} customers={customers} />;
}
