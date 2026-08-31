import { TransactionDetail } from '@/components/finance/finance-workspace';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TransactionDetail id={(await params).id} />;
}
