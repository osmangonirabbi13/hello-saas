import type { z } from 'zod';
import type { productCreateSchema } from '@hello-shop/validation';
export type ProductInput = z.infer<typeof productCreateSchema>;
export interface ProductRepositoryContract {
  masters(businessId: string, input: ProductInput): Promise<{ valid: boolean; reason?: string }>;
  duplicate(
    businessId: string,
    sku: string,
    barcode?: string | null,
    excludeId?: string,
  ): Promise<boolean>;
  create(businessId: string, userId: string, input: ProductInput): Promise<unknown>;
  list(
    businessId: string,
    query: Record<string, unknown>,
  ): Promise<{ rows: unknown[]; total: number }>;
  find(businessId: string, id: string): Promise<object | null>;
  update(businessId: string, id: string, input: Partial<ProductInput>): Promise<object | null>;
  deactivate(businessId: string, id: string): Promise<boolean>;
}
