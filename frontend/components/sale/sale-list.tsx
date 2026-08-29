'use client';
import Link from 'next/link';
import { Plus, ShoppingCart } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Button,
  CurrencyDisplay,
  FilterBar,
  PageHeader,
  SearchInput,
  StatusBadge,
} from '@/components/ui/primitives';
import type { SaleSummary } from '@/lib/api/sales';
import { usePendingEntities } from '@/lib/offline/use-pending-entities';
const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

const columns: Column<SaleSummary>[] = [
  {
    key: 'saleNumber',
    label: 'Sale #',
    render: (row) => (
      <Link className="font-semibold text-emerald-700" href={`/sales/${row.id}`}>
        {row.saleNumber}
      </Link>
    ),
  },
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'date', label: 'Date' },
  { key: 'customer', label: 'Customer' },
  {
    key: 'type',
    label: 'Type',
    render: (row) => (
      <StatusBadge tone={row.type === 'VAT' ? 'warning' : 'info'}>{row.type}</StatusBadge>
    ),
  },
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
      <div className="flex gap-3">
        <Link href={`/sales/${row.id}`}>View</Link>
        {row.status === 'DRAFT' && (
          <>
            <Link href={`/sales/${row.id}/edit`}>Edit</Link>
            <button type="button">Post</button>
            <button type="button">Delete</button>
          </>
        )}
      </div>
    ),
  },
];

export function SaleList({ rows }: { rows: SaleSummary[] }) {
  const local = usePendingEntities('SALE_DRAFT').map((item): SaleSummary => {
    const lines = Array.isArray(item.payload.lines) ? item.payload.lines as Array<Record<string, unknown>> : [];
    const total = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0) * Number(line.unitPrice ?? 0), 0);
    return { id: item.serverId ?? item.localId, saleNumber: asText(item.payload.saleNumber, 'Offline draft'), invoiceNumber: asText(item.payload.invoiceNumber, 'Assigned after sync'), date: asText(item.payload.saleDate), customer: asText(item.payload.customerName, 'Walk-in / pending customer'), type: (item.payload.type === 'VAT' ? 'VAT' : 'REGULAR'), warehouse: asText(item.payload.warehouseName, 'Cached warehouse'), total, paid: Number(item.payload.paidAmount ?? 0), due: Math.max(0, total - Number(item.payload.paidAmount ?? 0)), status: 'DRAFT', createdBy: item.syncStatus === 'CONFLICT' ? 'Needs review' : item.syncStatus === 'SYNCED' ? 'Synced' : 'Waiting to sync', paymentState: Number(item.payload.paidAmount ?? 0) ? 'PARTIALLY_PAID' : 'UNPAID' };
  });
  const effectiveRows = [...rows.filter((row) => !local.some((item) => item.id === row.id)), ...local];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales"
        description="Regular, VAT, and POS sales use one audited Sale domain."
        actions={
          <>
            <Link href="/sales/pos">
              <Button variant="secondary">
                <ShoppingCart size={16} />
                Open POS
              </Button>
            </Link>
            <Link href="/sales/new">
              <Button>
                <Plus size={16} />
                Create Sale
              </Button>
            </Link>
          </>
        }
      />
      <FilterBar>
        <SearchInput placeholder="Sale, invoice, customer, phone, or reference" />
        <select className="h-10 rounded-lg border px-3">
          <option>All types</option>
          <option>Regular</option>
          <option>VAT</option>
          <option>POS</option>
        </select>
        <select className="h-10 rounded-lg border px-3">
          <option>All statuses</option>
          <option>Draft</option>
          <option>Posted</option>
        </select>
        <select className="h-10 rounded-lg border px-3">
          <option>All payments</option>
        </select>
      </FilterBar>
      <DataTable rows={effectiveRows} columns={columns} rowKey={(row) => row.id} />
    </div>
  );
}
