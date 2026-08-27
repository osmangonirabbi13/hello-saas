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
      <DataTable rows={rows} columns={columns} rowKey={(row) => row.id} />
    </div>
  );
}
