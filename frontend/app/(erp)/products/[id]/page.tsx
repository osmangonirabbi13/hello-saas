import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CurrencyDisplay, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { getProduct } from '@/lib/api/product-master';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const product = await getProduct(id); if (!product) notFound();
  return <div className="space-y-5"><PageHeader title={product.name} description={product.sku} actions={<Link className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" href={'/products/' + id + '/edit'}>Edit product</Link>} /><section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"><div><small className="text-slate-500">Category</small><p className="font-semibold">{product.category}</p></div><div><small className="text-slate-500">Sale price</small><p className="font-semibold"><CurrencyDisplay value={product.salePrice} /></p></div><div><small className="text-slate-500">Status</small><p><StatusBadge tone={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'Active' : 'Inactive'}</StatusBadge></p></div></section></div>;
}
