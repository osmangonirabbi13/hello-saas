import { MasterDataPage } from '@/components/product/master-data-page';
import { listMasterRecords } from '@/lib/api/product-master';
export default async function Page() { return <MasterDataPage title="Brands" rows={await listMasterRecords('brands')} />; }
