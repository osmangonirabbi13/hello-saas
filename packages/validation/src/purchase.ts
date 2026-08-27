import { z } from 'zod';
const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const quantity = z
  .string()
  .regex(/^\d+(?:\.\d{1,3})?$/)
  .refine((value) => Number(value) > 0, 'Quantity must be greater than zero.');
const line = z
  .object({
    productId: z.string().cuid(),
    quantity,
    unitCost: money,
    discountAmount: money.default('0'),
    taxAmount: money.default('0'),
    warrantyDuration: z.number().int().positive().nullish(),
    warrantyUnit: z.enum(['DAYS', 'MONTHS', 'YEARS']).nullish(),
    serialNumbers: z.array(z.string().trim().min(1).max(160)).max(1000).default([]),
  })
  .strict();
export const purchaseCreateSchema = z
  .object({
    supplierId: z.string().cuid(),
    warehouseId: z.string().cuid(),
    supplierInvoiceNumber: z.string().trim().max(120).nullish(),
    reference: z.string().trim().max(120).nullish(),
    purchaseDate: z.coerce.date(),
    dueDate: z.coerce.date().nullish(),
    discountAmount: money.default('0'),
    additionalCost: money.default('0'),
    taxAmount: money.default('0'),
    paidAmount: money.default('0'),
    note: z.string().trim().max(3000).nullish(),
    lines: z.array(line).min(1).max(200),
  })
  .strict()
  .superRefine((value, context) => {
    const products = new Set<string>();
    const serials = new Set<string>();
    value.lines.forEach((entry, index) => {
      if (products.has(entry.productId))
        context.addIssue({
          code: 'custom',
          path: ['lines', index, 'productId'],
          message: 'Duplicate product lines are not allowed.',
        });
      products.add(entry.productId);
      entry.serialNumbers.forEach((serial, serialIndex) => {
        const normalized = serial.toLowerCase();
        if (serials.has(normalized))
          context.addIssue({
            code: 'custom',
            path: ['lines', index, 'serialNumbers', serialIndex],
            message: 'Duplicate serial numbers are not allowed.',
          });
        serials.add(normalized);
      });
    });
  });
export const purchaseUpdateSchema = purchaseCreateSchema;
export const purchaseListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    supplier: z.string().cuid().optional(),
    warehouse: z.string().cuid().optional(),
    status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    paymentState: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
