import { PartyList } from '@/components/party/party-list';
import { listParties } from '@/lib/api/parties';
export default async function Page() { return <PartyList kind={'customer'} rows={await listParties('customer')} />; }
