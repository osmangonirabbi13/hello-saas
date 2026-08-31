import{ExpenseForm}from'@/components/expense/expense-workspace';export default async function Page({params}:{params:Promise<{id:string}>}){return <ExpenseForm id={(await params).id}/>}
