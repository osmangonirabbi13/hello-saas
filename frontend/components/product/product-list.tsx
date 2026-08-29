'use client';
import Link from 'next/link';
import { MoreHorizontal, Plus, RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button, CurrencyDisplay, EmptyState, FilterBar, PageHeader, SearchInput, StatusBadge } from '@/components/ui/primitives';
import type { ProductSummary } from '@/lib/api/product-master';
import { usePendingEntities } from '@/lib/offline/use-pending-entities';
const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

const columns: Column<ProductSummary>[] = [
  { key: 'name', label: 'Product', render: (row) => <div className="max-w-56 min-w-0"><Link className="block truncate font-bold" href={'/products/' + row.id}>{row.name}</Link><small className="block truncate text-slate-400">{row.category} · {row.brand}</small></div> },
  { key: 'sku', label: 'SKU / Barcode', render: (row) => <div className="font-mono text-xs"><span className="block">{row.sku}</span><span className="block text-slate-400">{row.barcode}</span></div> },
  { key: 'category', label: 'Category' },
  { key: 'purchasePrice', label: 'Purchase', align: 'right', render: (row) => <CurrencyDisplay value={row.purchasePrice} /> },
  { key: 'salePrice', label: 'Sale', align: 'right', render: (row) => <CurrencyDisplay value={row.salePrice} /> },
  { key: 'stock', label: 'Stock', align: 'right' },
  { key: 'serialized', label: 'Tracking', render: (row) => row.serialized ? <StatusBadge tone="info">Serial / IMEI</StatusBadge> : <span className="text-xs text-slate-400">Standard</span> },
  { key: 'stockStatus', label: 'State', render: (row) => <StatusBadge tone={row.stockStatus === 'IN_STOCK' ? 'success' : 'warning'}>{row.stockStatus.replaceAll('_', ' ')}</StatusBadge> },
  { key: 'id', label: 'Actions', render: (row) => <Link aria-label={'View ' + row.name} className="grid size-9 place-items-center" href={'/products/' + row.id}><MoreHorizontal size={17}/></Link> },
];

export function ProductList({ rows }: { rows: ProductSummary[] }) {
  const local = usePendingEntities('PRODUCT').map((item): ProductSummary => ({
    id: item.serverId ?? item.localId,
    name: asText(item.payload.name, 'Offline product'),
    sku: asText(item.payload.sku),
    barcode: asText(item.payload.barcode),
    category: asText(item.payload.categoryName, 'Cached category'),
    brand: asText(item.payload.brandName, 'Unbranded'),
    purchasePrice: Number(item.payload.purchasePrice ?? 0),
    salePrice: Number(item.payload.salePrice ?? 0),
    stock: 0,
    serialized: item.payload.serialized === true,
    stockStatus: item.syncStatus === 'CONFLICT' ? 'LOW_STOCK' : 'IN_STOCK',
    isActive: item.payload.isActive !== false,
  }));
  const effective = [...rows.filter((row) => !local.some((item) => item.id === row.id)), ...local];
  return <div className="space-y-5">
    <PageHeader title="Products" description="Inventory-ready catalog, identifiers, pricing and stock state." actions={<Link href="/products/new"><Button><Plus size={16}/>Add product</Button></Link>}/>
    <FilterBar><SearchInput placeholder="Search product, SKU, or barcode"/><Button variant="secondary"><RotateCcw size={15}/>Reset</Button></FilterBar>
    {effective.length ? <DataTable rows={effective} columns={columns} rowKey={(row) => row.id}/> : <EmptyState title="No products found" description="Add your first product."/>}
  </div>;
}
