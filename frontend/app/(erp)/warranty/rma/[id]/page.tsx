import { RmaDetail } from '@/components/warranty/rma-workspace';
export default async function Page({params}:{params:Promise<{id:string}>}){return <RmaDetail id={(await params).id}/>}
