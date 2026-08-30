import type { Prisma } from '@hello-shop/database';

export type ReturnKind = 'PURCHASE' | 'SALE';
export type ReturnPoster = (
  tx: Prisma.TransactionClient,
  businessId: string,
  userId: string,
  input: {
    warehouseId: string;
    productId: string;
    type: 'PURCHASE_RETURN' | 'SALE_RETURN';
    quantity: string;
    referenceType: 'PURCHASE_RETURN' | 'SALE_RETURN';
    referenceId: string;
    unitCost?: string;
  },
) => Promise<unknown>;
