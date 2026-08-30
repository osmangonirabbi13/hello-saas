import { ReturnForm } from '@/components/return/return-workspace';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ReturnForm kind="sale" id={id}/>;}
