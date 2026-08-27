import { notFound } from 'next/navigation';
import { SaleForm } from '@/components/sale/sale-form';
import { getSale, saleCustomers, saleProducts } from '@/lib/api/sales';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sale, products, customers] = await Promise.all([
    getSale(id),
    saleProducts(),
    saleCustomers(),
  ]);
  if (!sale || sale.status !== 'DRAFT') notFound();
  return <SaleForm mode={sale.type} products={products} customers={customers} sale={sale} />;
}
