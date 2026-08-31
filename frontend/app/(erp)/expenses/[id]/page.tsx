import{ExpenseDetail}from'@/components/expense/expense-workspace';export default async function Page({params}:{params:Promise<{id:string}>}){return <ExpenseDetail id={(await params).id}/>}
