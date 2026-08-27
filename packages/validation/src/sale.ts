import { z } from 'zod';

const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const quantity = z
  .string()
  .regex(/^\d+(?:\.\d{1,3})?$/)
  .refine((value) => Number(value) > 0, 'Quantity must be greater than zero.');

const saleLineSchema = z
  .object({
    productId: z.string().cuid(),
    quantity,
    unitPrice: money,
    discountAmount: money.default('0'),
    taxAmount: money.default('0'),
    warrantyDuration: z.number().int().positive().nullish(),
    warrantyUnit: z.enum(['DAYS', 'MONTHS', 'YEARS']).nullish(),
    serialNumbers: z.array(z.string().trim().min(1).max(160)).max(1000).default([]),
  })
  .strict();

export const saleCreateSchema = z
  .object({
    customerId: z.string().cuid().nullish(),
    warehouseId: z.string().cuid(),
    type: z.enum(['REGULAR', 'VAT', 'POS']).default('REGULAR'),
    saleDate: z.coerce.date(),
    dueDate: z.coerce.date().nullish(),
    reference: z.string().trim().max(120).nullish(),
    discountAmount: money.default('0'),
    additionalCost: money.default('0'),
    taxAmount: money.default('0'),
    paidAmount: money.default('0'),
    note: z.string().trim().max(3000).nullish(),
    lines: z.array(saleLineSchema).min(1).max(200),
  })
  .strict()
  .superRefine((value, context) => {
    const products = new Set<string>();
    const serials = new Set<string>();
    value.lines.forEach((line, lineIndex) => {
      if (products.has(line.productId))
        context.addIssue({
          code: 'custom',
          path: ['lines', lineIndex, 'productId'],
          message: 'Duplicate product lines are not allowed.',
        });
      products.add(line.productId);
      line.serialNumbers.forEach((serial, serialIndex) => {
        const normalized = serial.toLowerCase();
        if (serials.has(normalized))
          context.addIssue({
            code: 'custom',
            path: ['lines', lineIndex, 'serialNumbers', serialIndex],
            message: 'Duplicate serial numbers are not allowed.',
          });
        serials.add(normalized);
      });
    });
  });

export const saleUpdateSchema = saleCreateSchema;

export const saleListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    customer: z.string().cuid().optional(),
    warehouse: z.string().cuid().optional(),
    type: z.enum(['REGULAR', 'VAT', 'POS']).optional(),
    status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    paymentState: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(['saleDate', 'saleNumber', 'invoiceNumber', 'grandTotal']).default('saleDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'The from date must not be after the to date.',
    path: ['dateFrom'],
  });
