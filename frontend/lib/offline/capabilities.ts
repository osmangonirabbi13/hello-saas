export type Capability =
  | 'products.create'
  | 'products.update'
  | 'customers.create'
  | 'customers.update'
  | 'suppliers.create'
  | 'suppliers.update'
  | 'purchases.draft'
  | 'purchases.post'
  | 'sales.draft'
  | 'sales.post'
  | 'pos.checkout'
  | 'inventory.adjust'
  | 'serial.mutate';
const policy: Record<Capability, 'OFFLINE_SAFE' | 'ONLINE_REQUIRED'> = {
  'products.create': 'OFFLINE_SAFE',
  'products.update': 'OFFLINE_SAFE',
  'customers.create': 'OFFLINE_SAFE',
  'customers.update': 'OFFLINE_SAFE',
  'suppliers.create': 'OFFLINE_SAFE',
  'suppliers.update': 'OFFLINE_SAFE',
  'purchases.draft': 'OFFLINE_SAFE',
  'purchases.post': 'ONLINE_REQUIRED',
  'sales.draft': 'OFFLINE_SAFE',
  'sales.post': 'ONLINE_REQUIRED',
  'pos.checkout': 'ONLINE_REQUIRED',
  'inventory.adjust': 'ONLINE_REQUIRED',
  'serial.mutate': 'ONLINE_REQUIRED',
};
export const offlineCapability = (capability: Capability) => policy[capability];
