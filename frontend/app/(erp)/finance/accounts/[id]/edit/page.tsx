import { AccountForm } from '@/components/finance/finance-workspace';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AccountForm id={(await params).id} />;
}
