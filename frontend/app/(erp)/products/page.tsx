import Link from 'next/link';
import { MoreHorizontal, Plus, RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button, CurrencyDisplay, EmptyState, FilterBar, PageHeader, SearchInput, StatusBadge } from '@/components/ui/primitives';
import { listProducts, type ProductSummary } from '@/lib/api/product-master';

const columns: Column<ProductSummary>[] = [
  { key: 'name', label: 'Product', render: (row) => <div className="max-w-56 min-w-0"><Link title={row.name} className="block truncate font-bold text-slate-900 hover:text-emerald-700" href={'/products/' + row.id}>{row.name}</Link><small className="block truncate text-slate-400">{row.category} · {row.brand}</small></div> },
  { key: 'sku', label: 'SKU / Barcode', render: (row) => <div className="font-mono text-xs"><span className="block text-slate-700">{row.sku}</span><span className="block text-slate-400">{row.barcode}</span></div> },
  { key: 'category', label: 'Category' },
  { key: 'purchasePrice', label: 'Purchase', align: 'right', render: (row) => <CurrencyDisplay value={row.purchasePrice} /> },
  { key: 'salePrice', label: 'Sale', align: 'right', render: (row) => <strong><CurrencyDisplay value={row.salePrice} /></strong> },
  { key: 'stock', label: 'Stock', align: 'right', render: (row) => <span className="font-semibold tabular-nums">{row.stock}</span> },
  { key: 'serialized', label: 'Tracking', render: (row) => row.serialized ? <StatusBadge tone="info">Serial / IMEI</StatusBadge> : <span className="text-xs text-slate-400">Standard</span> },
  { key: 'stockStatus', label: 'Stock status', render: (row) => <StatusBadge tone={row.stockStatus === 'IN_STOCK' ? 'success' : row.stockStatus === 'LOW_STOCK' ? 'warning' : 'danger'}>{row.stockStatus === 'IN_STOCK' ? 'In Stock' : row.stockStatus === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}</StatusBadge> },
  { key: 'id', label: 'Actions', render: (row) => <Link aria-label={`View ${row.name}`} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" href={'/products/' + row.id}><MoreHorizontal size={17}/></Link> },
];

export default async function ProductsPage() {
  const products = await listProducts();
  return <div className="space-y-5"><PageHeader title="Products" description="Inventory-ready catalog, identifiers, pricing and stock state." actions={<Link href="/products/new"><Button><Plus size={16} />Add product</Button></Link>} /><FilterBar><SearchInput placeholder="Search product, SKU, or barcode"/><select className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option>All categories</option><option>Laptop</option><option>Mobile</option></select><select className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option>All stock states</option><option>In Stock</option><option>Low Stock</option><option>Out of Stock</option></select><select className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option>All tracking</option><option>Serialized</option><option>Standard</option></select><Button variant="secondary"><RotateCcw size={15}/>Reset</Button></FilterBar>{products.length ? <DataTable rows={products} columns={columns} rowKey={(row) => row.id} /> : <div className="rounded-xl border border-slate-200 bg-white"><EmptyState title="No products found" description="Adjust the filters or add your first product."/></div>}</div>;
}
