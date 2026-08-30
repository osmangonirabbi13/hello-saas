import{ServiceDetail}from'@/components/service/service-workspace';export default async function Page({params}:{params:Promise<{id:string}>}){return <ServiceDetail id={(await params).id}/>}
