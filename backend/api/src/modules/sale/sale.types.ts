import type { Prisma } from '@hello-shop/database';

export type SaleLineInput = {
  productId: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  warrantyDuration?: number | null;
  warrantyUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | null;
  serialNumbers: string[];
};

export type SaleInput = {
  customerId?: string | null;
  warehouseId: string;
  type: 'REGULAR' | 'VAT' | 'POS';
  saleDate: Date;
  dueDate?: Date | null;
  reference?: string | null;
  discountAmount: string;
  additionalCost: string;
  taxAmount: string;
  paidAmount: string;
  note?: string | null;
  lines: SaleLineInput[];
};

export type CalculatedSaleLine = SaleLineInput & { lineTotal: string };
export type SaleTotals = {
  subtotal: string;
  discountAmount: string;
  additionalCost: string;
  taxAmount: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  lines: CalculatedSaleLine[];
};

export type SaleProduct = {
  id: string;
  serialized: boolean;
  isActive: boolean;
  trackStock: boolean;
  allowNegativeStock: boolean;
  warrantyEnabled: boolean;
  warrantyDuration: number | null;
  warrantyUnit: 'DAYS' | 'MONTHS' | 'YEARS' | null;
  unit: { decimalAllowed: boolean };
};

export type PostingSale = {
  id: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  customerId: string | null;
  warehouseId: string;
  saleNumber: string;
  invoiceNumber: string;
  saleDate: Date;
  lines: Array<CalculatedSaleLine & { product: SaleProduct }>;
};

export type SaleInventoryPoster = (
  transaction: Prisma.TransactionClient,
  businessId: string,
  userId: string,
  input: {
    warehouseId: string;
    productId: string;
    type: 'SALE';
    quantity: string;
    referenceType: string;
    referenceId: string;
  },
) => Promise<unknown>;

export interface SaleRepositoryContract {
  validateMasters(
    businessId: string,
    customerId: string | null,
    warehouseId: string,
    productIds: string[],
  ): Promise<{ customer: boolean; warehouse: boolean; products: SaleProduct[] }>;
  findSerials(
    businessId: string,
    warehouseId: string,
    serials: string[],
  ): Promise<Array<{ id: string; serialNumber: string; productId: string; status: string }>>;
  createDraft(
    businessId: string,
    userId: string,
    input: SaleInput,
    totals: SaleTotals,
  ): Promise<object>;
  updateDraft(
    businessId: string,
    id: string,
    input: SaleInput,
    totals: SaleTotals,
  ): Promise<object | null>;
  find(businessId: string, id: string): Promise<PostingSale | null>;
  list(businessId: string, query: Record<string, unknown>): Promise<object>;
  postAtomic(
    businessId: string,
    id: string,
    userId: string,
    calculate: (input: SaleInput) => SaleTotals,
    poster: SaleInventoryPoster,
  ): Promise<object>;
  deleteDraft(businessId: string, id: string, userId: string): Promise<boolean>;
}
