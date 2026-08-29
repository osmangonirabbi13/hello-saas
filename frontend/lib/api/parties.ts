import { demoCustomers, demoSuppliers } from '@/lib/demo/entities';
export type PartyKind = 'customer' | 'supplier';
export type PartySummary = {
  id: string;
  name: string;
  code: string;
  phone: string;
  company: string;
  type: string | null;
  contactPerson: string | null;
  district: string;
  isActive: boolean;
  updatedAt: string;
};
export function listParties(kind: PartyKind): Promise<PartySummary[]> {
  const source = kind === 'customer' ? demoCustomers : demoSuppliers;
  return Promise.resolve(
    source.map((item, index) => ({
      id: kind + '-' + String(index + 1),
      name: item.name,
      code: (kind === 'customer' ? 'CUS-' : 'SUP-') + String(index + 1).padStart(6, '0'),
      phone: item.phone,
      company: item.name,
      type: 'type' in item ? item.type : null,
      contactPerson: kind === 'supplier' ? item.name : null,
      district: item.district,
      isActive: item.status === 'Active',
      updatedAt: '26 Aug 2026',
    })),
  );
}
export async function getParty(kind: PartyKind, id: string) {
  return (await listParties(kind)).find((item) => item.id === id) ?? null;
}
