import { ProductList } from '@/components/product/product-list';
import { listProducts } from '@/lib/api/product-master';

export default async function ProductsPage() {
  return <ProductList rows={await listProducts()} />;
}
