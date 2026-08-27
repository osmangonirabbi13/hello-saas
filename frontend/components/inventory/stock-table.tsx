import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/primitives';
import type { StockRow } from '@/lib/api/inventory';
const tone = (status: string) =>
  status === 'IN_STOCK'
    ? ('success' as const)
    : status === 'LOW_STOCK'
      ? ('warning' as const)
      : ('danger' as const);
export function StockTable({ rows, compact = false }: { rows: StockRow[]; compact?: boolean }) {
  const columns: Column<StockRow>[] = [
    {
      key: 'product',
      label: 'Product',
      render: (row) => (
        <div>
          <b>{row.product}</b>
          <small className="block font-mono text-slate-400">{row.sku}</small>
        </div>
      ),
    },
    ...(!compact
      ? [
          { key: 'category' as const, label: 'Category' },
          { key: 'brand' as const, label: 'Brand' },
          { key: 'warehouse' as const, label: 'Warehouse' },
        ]
      : []),
    { key: 'quantity', label: 'Available Stock', align: 'right' as const },
    { key: 'reorderLevel', label: 'Reorder Level', align: 'right' as const },
    ...(compact
      ? [
          {
            key: 'productId' as const,
            label: 'Shortage',
            align: 'right' as const,
            render: (row: StockRow) => Math.max(0, row.reorderLevel - row.quantity),
          },
        ]
      : []),
    {
      key: 'status',
      label: 'Status',
      render: (row: StockRow) => (
        <StatusBadge tone={tone(row.status)}>{row.status.replaceAll('_', ' ')}</StatusBadge>
      ),
    },
    ...(!compact
      ? [
          {
            key: 'serialized' as const,
            label: 'Serialized',
            render: (row: StockRow) => (row.serialized ? 'Yes' : 'No'),
          },
          {
            key: 'productId' as const,
            label: 'Actions',
            render: (row: StockRow) => <Link href={'/products/' + row.productId}>View</Link>,
          },
        ]
      : []),
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(row) => row.productId} />;
}
