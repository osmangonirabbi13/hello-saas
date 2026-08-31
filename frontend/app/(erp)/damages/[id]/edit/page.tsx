import{DamageEditor}from'@/components/damage/damage-editor';export default async function Page({params}:{params:Promise<{id:string}>}){return <DamageEditor id={(await params).id}/>}
