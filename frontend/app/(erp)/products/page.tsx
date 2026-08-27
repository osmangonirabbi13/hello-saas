import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button, CurrencyDisplay, PageHeader, SearchInput, StatusBadge } from '@/components/ui/primitives';
import { listProducts, type ProductSummary } from '@/lib/api/product-master';

const columns: Column<ProductSummary>[] = [
  { key: 'name', label: 'Product', render: (row) => <div><Link className={'font-bold text-slate-900 hover:text-emerald-700'} href={'/products/' + row.id}>{row.name}</Link><small className={'block font-mono text-slate-400'}>{row.sku}</small></div> },
  { key: 'category', label: 'Category' },
  { key: 'salePrice', label: 'Retail price', align: 'right', render: (row) => <CurrencyDisplay value={row.salePrice} /> },
  { key: 'isActive', label: 'Status', render: (row) => <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Active' : 'Inactive'}</StatusBadge> },
];

export default async function ProductsPage() {
  const products = await listProducts();
  return <div className={'space-y-5'}><PageHeader title={'Product list'} description={'Browse tenant catalog and pricing.'} actions={<Link href={'/products/new'}><Button><Plus size={16} />Add product</Button></Link>} /><SearchInput placeholder={'Search product, SKU, or barcode'} /><DataTable rows={products} columns={columns} rowKey={(row) => row.id} /></div>;
}
