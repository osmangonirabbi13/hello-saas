import { notFound } from 'next/navigation'; import { PartyForm } from '@/components/party/party-form'; import { getParty } from '@/lib/api/parties';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const party = await getParty('supplier', id); if (!party) notFound(); return <PartyForm kind="supplier" party={party} />; }
