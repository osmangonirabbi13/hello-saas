import { PublicRmaTracking } from '@/components/warranty/rma-workspace';
export default async function Page({params}:{params:Promise<{token:string}>}){return <PublicRmaTracking token={(await params).token}/>}
