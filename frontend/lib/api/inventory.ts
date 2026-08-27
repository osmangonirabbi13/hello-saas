import { inventorySerials, inventoryStock } from '@/lib/demo/inventory';
export type StockRow = (typeof inventoryStock)[number];
export type SerialRow = (typeof inventorySerials)[number];
export function listStock(): Promise<StockRow[]> {
  return Promise.resolve(inventoryStock);
}
export async function listLowStock() {
  return (await listStock()).filter((row) => row.quantity <= row.reorderLevel);
}
export async function listAlerts() {
  return (await listStock()).filter((row) => row.status !== 'IN_STOCK');
}
export function listSerials(): Promise<SerialRow[]> {
  return Promise.resolve(inventorySerials);
}
