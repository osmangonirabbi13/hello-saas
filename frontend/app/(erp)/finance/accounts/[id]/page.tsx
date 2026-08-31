import { AccountDetail } from '@/components/finance/finance-workspace';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AccountDetail id={(await params).id} />;
}
