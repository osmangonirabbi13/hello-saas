import { demoProducts } from '@/lib/demo/entities';

export type ProductSummary = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  serialized: boolean;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  isActive: boolean;
};
export type MasterRecord = {
  id: string;
  name: string;
  code: string;
  parent?: string;
  isActive: boolean;
};

const masters: Record<string, MasterRecord[]> = {
  categories: [
    { id: 'cat-laptop', name: 'Laptop', code: 'laptop', isActive: true },
    { id: 'cat-mobile', name: 'Mobile', code: 'mobile', isActive: true },
  ],
  'sub-categories': [
    {
      id: 'sub-business',
      name: 'Business laptop',
      code: 'business-laptop',
      parent: 'Laptop',
      isActive: true,
    },
  ],
  brands: [
    { id: 'brand-lenovo', name: 'Lenovo', code: 'lenovo', isActive: true },
    { id: 'brand-samsung', name: 'Samsung', code: 'samsung', isActive: true },
  ],
  units: [
    { id: 'unit-piece', name: 'Piece', code: 'pcs', isActive: true },
    { id: 'unit-box', name: 'Box', code: 'box', isActive: true },
  ],
};

// Single frontend boundary: replace fixtures with authenticated API calls here.
export function listProducts(): Promise<ProductSummary[]> {
  return Promise.resolve(
    demoProducts.map((item, index) => ({
      id: 'demo-product-' + String(index + 1),
      name: item.product,
      sku: item.sku,
      barcode: ['89411001', '89411003', '89411002', '89411004'][index] ?? '',
      category: item.category,
      brand: ['Lenovo', 'Samsung', 'Logitech', 'HP'][index] ?? 'Unbranded',
      purchasePrice: Math.round(item.price * 0.84),
      salePrice: item.price,
      stock: item.stock,
      serialized: index < 2,
      stockStatus:
        item.status === 'Out of stock'
          ? 'OUT_OF_STOCK'
          : item.status === 'Low stock'
            ? 'LOW_STOCK'
            : 'IN_STOCK',
      isActive: item.status !== 'Out of stock',
    })),
  );
}
export async function getProduct(id: string): Promise<ProductSummary | null> {
  return (await listProducts()).find((item) => item.id === id) ?? null;
}
export function listMasterRecords(kind: string): Promise<MasterRecord[]> {
  return Promise.resolve(masters[kind] ?? []);
}
