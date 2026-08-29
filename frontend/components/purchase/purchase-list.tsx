'use client';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Button,
  CurrencyDisplay,
  FilterBar,
  PageHeader,
  SearchInput,
  StatusBadge,
} from '@/components/ui/primitives';
import type { PurchaseSummary } from '@/lib/api/purchases';
import { usePendingEntities } from '@/lib/offline/use-pending-entities';
const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
const columns: Column<PurchaseSummary>[] = [
  {
    key: 'purchaseNumber',
    label: 'Purchase #',
    render: (row) => (
      <Link className="font-semibold text-emerald-700" href={'/purchases/' + row.id}>
        {row.purchaseNumber}
      </Link>
    ),
  },
  { key: 'date', label: 'Date' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'supplierInvoice', label: 'Supplier Invoice' },
  { key: 'warehouse', label: 'Warehouse' },
  {
    key: 'total',
    label: 'Total',
    align: 'right',
    render: (row) => <CurrencyDisplay value={row.total} />,
  },
  {
    key: 'paid',
    label: 'Paid',
    align: 'right',
    render: (row) => <CurrencyDisplay value={row.paid} />,
  },
  {
    key: 'due',
    label: 'Due',
    align: 'right',
    render: (row) => <CurrencyDisplay value={row.due} />,
  },
  {
    key: 'paymentState',
    label: 'Payment',
    render: (row) => (
      <StatusBadge tone={row.paymentState === 'PAID' ? 'success' : 'warning'}>
        {row.paymentState.replaceAll('_', ' ')}
      </StatusBadge>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <StatusBadge tone={row.status === 'POSTED' ? 'success' : 'info'}>{row.status}</StatusBadge>
    ),
  },
  { key: 'createdBy', label: 'Created By' },
  {
    key: 'id',
    label: 'Actions',
    render: (row) => (
      <div className="flex gap-2">
        <Link href={'/purchases/' + row.id}>View</Link>
        {row.status === 'DRAFT' && <Link href={'/purchases/' + row.id + '/edit'}>Edit</Link>}
      </div>
    ),
  },
];
export function PurchaseList({ rows }: { rows: PurchaseSummary[] }) {
  const local = usePendingEntities('PURCHASE_DRAFT').map((item): PurchaseSummary => {
    const lines = Array.isArray(item.payload.lines) ? item.payload.lines as Array<Record<string, unknown>> : [];
    const total = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0) * Number(line.unitCost ?? 0), 0);
    return { id: item.serverId ?? item.localId, purchaseNumber: asText(item.payload.purchaseNumber, 'Offline draft'), date: asText(item.payload.purchaseDate), supplier: asText(item.payload.supplierName, 'Pending supplier'), supplierInvoice: asText(item.payload.supplierInvoiceNumber), warehouse: asText(item.payload.warehouseName, 'Cached warehouse'), total, paid: Number(item.payload.paidAmount ?? 0), due: Math.max(0, total - Number(item.payload.paidAmount ?? 0)), status: 'DRAFT', createdBy: item.syncStatus === 'CONFLICT' ? 'Needs review' : item.syncStatus === 'SYNCED' ? 'Synced' : 'Waiting to sync', paymentState: Number(item.payload.paidAmount ?? 0) ? 'PARTIALLY_PAID' : 'UNPAID' };
  });
  const effectiveRows = [...rows.filter((row) => !local.some((item) => item.id === row.id)), ...local];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchases"
        description="Draft and posted supplier purchases."
        actions={
          <Link href="/purchases/new">
            <Button>
              <Plus size={16} />
              Create Purchase
            </Button>
          </Link>
        }
      />
      <FilterBar>
        <SearchInput placeholder="Purchase #, invoice, reference, or supplier" />
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All suppliers</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All statuses</option>
          <option>Draft</option>
          <option>Posted</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All payment states</option>
        </select>
      </FilterBar>
      <DataTable rows={effectiveRows} columns={columns} rowKey={(row) => row.id} />
    </div>
  );
}
