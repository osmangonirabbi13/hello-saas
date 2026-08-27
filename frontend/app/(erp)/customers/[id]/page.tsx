import { notFound } from 'next/navigation'; import { PartyProfile } from '@/components/party/party-profile'; import { getParty } from '@/lib/api/parties';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const party = await getParty('customer', id); if (!party) notFound(); return <PartyProfile kind="customer" party={party} />; }
