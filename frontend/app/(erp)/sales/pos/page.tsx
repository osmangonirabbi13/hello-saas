import { PosCheckout } from '@/components/sale/pos-checkout';
import { saleCustomers, saleProducts } from '@/lib/api/sales';
export default async function Page() {
  const [products, customers] = await Promise.all([saleProducts(), saleCustomers()]);
  return <PosCheckout products={products} customers={customers} />;
}
