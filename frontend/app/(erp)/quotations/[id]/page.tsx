import{QuotationDetail}from'@/components/quotation/quotation-workspace';export default async function Page({params}:{params:Promise<{id:string}>}){return <QuotationDetail id={(await params).id}/>}
