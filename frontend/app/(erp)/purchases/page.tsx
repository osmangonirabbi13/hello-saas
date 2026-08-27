import{PurchaseList}from'@/components/purchase/purchase-list';import{listPurchases}from'@/lib/api/purchases';export default async function Page(){return <PurchaseList rows={await listPurchases()}/>}
