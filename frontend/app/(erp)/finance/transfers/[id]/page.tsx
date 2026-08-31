import { TransferDetail } from '@/components/finance/finance-workspace';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TransferDetail id={(await params).id} />;
}
