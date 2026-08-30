import{QuotationForm}from'@/components/quotation/quotation-workspace';export default async function Page({params}:{params:Promise<{id:string}>}){return <QuotationForm id={(await params).id}/>}
