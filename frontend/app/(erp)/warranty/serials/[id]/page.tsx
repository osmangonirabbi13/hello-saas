import { SerialDetailView } from '@/components/warranty/rma-workspace';
export default async function Page({params}:{params:Promise<{id:string}>}){return <SerialDetailView id={(await params).id}/>}
