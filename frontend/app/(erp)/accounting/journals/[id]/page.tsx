import { JournalDetail } from '@/components/accounting/journal-workspace';
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <JournalDetail id={id}/>;}
