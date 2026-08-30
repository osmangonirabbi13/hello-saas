import { RmaEdit } from '@/components/warranty/rma-workspace';
export default async function Page({params}:{params:Promise<{id:string}>}){return <RmaEdit id={(await params).id}/>}
