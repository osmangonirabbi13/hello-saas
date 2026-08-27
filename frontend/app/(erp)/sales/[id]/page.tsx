import { notFound } from 'next/navigation';
import { SaleDetail } from '@/components/sale/sale-detail';
import { getSale } from '@/lib/api/sales';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sale = await getSale(id);
  if (!sale) notFound();
  return <SaleDetail sale={sale} />;
}
