import { ProductForm } from '@/components/product/product-form';
import { getProduct } from '@/lib/api/product-master';
import { notFound } from 'next/navigation';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const product = await getProduct(id); if (!product) notFound(); return <ProductForm product={product} />; }
