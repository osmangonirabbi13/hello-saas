import{DamageDetail}from'@/components/damage/damage-workspace';export default async function Page({params}:{params:Promise<{id:string}>}){return <DamageDetail id={(await params).id}/>}
