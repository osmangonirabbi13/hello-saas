import{ServiceForm}from'@/components/service/service-workspace';export default async function Page({params}:{params:Promise<{id:string}>}){return <ServiceForm id={(await params).id}/>}
