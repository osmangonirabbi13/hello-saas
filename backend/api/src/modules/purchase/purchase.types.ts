import type { Prisma } from '@hello-shop/database';
export type PurchaseLineInput = {
  productId: string;
  quantity: string;
  unitCost: string;
  discountAmount: string;
  taxAmount: string;
  warrantyDuration?: number | null;
  warrantyUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | null;
  serialNumbers: string[];
};
export type PurchaseInput = {
  supplierId: string;
  warehouseId: string;
  supplierInvoiceNumber?: string | null;
  reference?: string | null;
  purchaseDate: Date;
  dueDate?: Date | null;
  discountAmount: string;
  additionalCost: string;
  taxAmount: string;
  paidAmount: string;
  note?: string | null;
  lines: PurchaseLineInput[];
};
export type CalculatedLine = PurchaseLineInput & { lineTotal: string };
export type PurchaseTotals = {
  subtotal: string;
  discountAmount: string;
  additionalCost: string;
  taxAmount: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  lines: CalculatedLine[];
};
export type PostingPurchase = {
  id: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  supplierId: string;
  warehouseId: string;
  purchaseNumber: string;
  lines: Array<
    CalculatedLine & {
      product: {
        id: string;
        serialized: boolean;
        isActive: boolean;
        unit: { decimalAllowed: boolean };
      };
    }
  >;
};
export type InventoryPoster = (
  transaction: Prisma.TransactionClient,
  businessId: string,
  userId: string,
  input: {
    warehouseId: string;
    productId: string;
    type: 'PURCHASE';
    quantity: string;
    referenceType: string;
    referenceId: string;
    unitCost: string;
  },
) => Promise<unknown>;
export interface PurchaseRepositoryContract {
  validateMasters(
    businessId: string,
    supplierId: string,
    warehouseId: string,
    productIds: string[],
  ): Promise<{
    supplier: boolean;
    warehouse: boolean;
    products: Array<{
      id: string;
      serialized: boolean;
      isActive: boolean;
      unit: { decimalAllowed: boolean };
    }>;
  }>;
  serialConflicts(businessId: string, serials: string[]): Promise<string[]>;
  createDraft(
    businessId: string,
    userId: string,
    input: PurchaseInput,
    totals: PurchaseTotals,
  ): Promise<object>;
  updateDraft(
    businessId: string,
    id: string,
    input: PurchaseInput,
    totals: PurchaseTotals,
  ): Promise<object | null>;
  find(businessId: string, id: string): Promise<PostingPurchase | null>;
  list(businessId: string, query: Record<string, unknown>): Promise<object>;
  postAtomic(
    businessId: string,
    id: string,
    userId: string,
    poster: InventoryPoster,
  ): Promise<object>;
  deleteDraft(businessId: string, id: string, userId: string): Promise<boolean>;
}
