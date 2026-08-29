'use client';
import Link from 'next/link';
import { Plus, RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Button,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchInput,
  StatusBadge,
} from '@/components/ui/primitives';
import type { PartyKind, PartySummary } from '@/lib/api/parties';
import { usePendingEntities } from '@/lib/offline/use-pending-entities';
const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
export function PartyList({ kind, rows }: { kind: PartyKind; rows: PartySummary[] }) {
  const label = kind === 'customer' ? 'Customer' : 'Supplier';
  const pending = usePendingEntities(kind === 'customer' ? 'CUSTOMER' : 'SUPPLIER');
  const localRows: PartySummary[] = pending.map((item) => ({
    id: item.serverId ?? item.localId,
    name: asText(item.payload.name, 'Offline record'),
    code: asText(item.payload.customerCode ?? item.payload.supplierCode, 'Assigned after sync'),
    phone: asText(item.payload.phone),
    company: asText(item.payload.companyName),
    type: kind === 'customer' ? asText(item.payload.customerType, 'RETAIL') : null,
    contactPerson: kind === 'supplier' ? asText(item.payload.contactPerson) : null,
    district: asText(item.payload.district),
    isActive: item.payload.isActive !== false,
    updatedAt: item.syncStatus === 'CONFLICT' ? 'Needs review' : item.syncStatus === 'SYNCED' ? 'Synced' : 'Waiting to sync',
  }));
  const effectiveRows = [...rows.filter((row) => !localRows.some((local) => local.id === row.id)), ...localRows];
  const columns: Column<PartySummary>[] = [
    {
      key: 'name',
      label,
      render: (row) => (
        <Link
          className="font-semibold text-slate-900 hover:text-emerald-700"
          href={'/' + kind + 's/' + row.id}
        >
          {row.name}
        </Link>
      ),
    },
    { key: 'code', label: label + ' Code' },
    ...(kind === 'supplier' ? [{ key: 'contactPerson' as const, label: 'Contact Person' }] : []),
    { key: 'phone', label: 'Phone' },
    ...(kind === 'customer' ? [{ key: 'type' as const, label: 'Type' }] : []),
    { key: 'company', label: 'Company' },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: PartySummary) => (
        <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    { key: 'updatedAt', label: 'Updated' },
    {
      key: 'id',
      label: 'Actions',
      render: (row: PartySummary) => (
        <div className="flex gap-2">
          <Link href={'/' + kind + 's/' + row.id}>View</Link>
          <Link href={'/' + kind + 's/' + row.id + '/edit'}>Edit</Link>
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title={label + 's'}
        description={'Manage tenant-scoped ' + label.toLowerCase() + ' profiles.'}
        actions={
          <Link href={'/' + kind + 's/new'}>
            <Button>
              <Plus size={16} />
              Add {label}
            </Button>
          </Link>
        }
      />
      <FilterBar>
        <SearchInput placeholder={'Search ' + label.toLowerCase() + ', code, phone, email'} />
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All districts</option>
          <option>Dhaka</option>
          <option>Chattogram</option>
        </select>
        <Button variant="secondary">
          <RotateCcw size={15} />
          Reset
        </Button>
      </FilterBar>
      {effectiveRows.length ? (
        <DataTable rows={effectiveRows} columns={columns} rowKey={(row) => row.id} />
      ) : (
        <EmptyState
          title={'No ' + label.toLowerCase() + 's yet'}
          description={'Add the first ' + label.toLowerCase() + ' to begin.'}
        />
      )}
    </div>
  );
}
