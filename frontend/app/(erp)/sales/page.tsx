import { SaleList } from '@/components/sale/sale-list';
import { listSales } from '@/lib/api/sales';
export default async function Page() {
  return <SaleList rows={await listSales()} />;
}
