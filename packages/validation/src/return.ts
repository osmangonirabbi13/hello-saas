import { z } from 'zod';
const quantity = z
  .string()
  .regex(/^\d+(?:\.\d{1,3})?$/)
  .refine((v) => Number(v) > 0);
const line = z
  .object({
    sourceLineId: z.string().cuid(),
    quantity,
    serialNumbers: z.array(z.string().trim().min(1).max(160)).max(1000).default([]),
  })
  .strict();
function returnSchema<T extends readonly [string, ...string[]]>(reasons: T) {
  return z
    .object({
      sourceId: z.string().cuid(),
      returnDate: z.coerce.date(),
      reason: z.enum(reasons),
      note: z.string().trim().max(3000).nullish(),
      lines: z.array(line).min(1).max(200),
    })
    .strict()
    .superRefine((value, context) => {
      const lines = new Set<string>();
      const serials = new Set<string>();
      value.lines.forEach((entry, index) => {
        if (lines.has(entry.sourceLineId))
          context.addIssue({
            code: 'custom',
            path: ['lines', index, 'sourceLineId'],
            message: 'Duplicate source lines are not allowed.',
          });
        lines.add(entry.sourceLineId);
        entry.serialNumbers.forEach((serial, serialIndex) => {
          const key = serial.toLowerCase();
          if (serials.has(key))
            context.addIssue({
              code: 'custom',
              path: ['lines', index, 'serialNumbers', serialIndex],
              message: 'Duplicate serial numbers are not allowed.',
            });
          serials.add(key);
        });
      });
    });
}
export const purchaseReturnSchema = returnSchema([
  'WRONG_ITEM',
  'DAMAGED',
  'SUPPLIER_REQUEST',
  'EXCESS_STOCK',
  'OTHER',
]);
export const saleReturnSchema = returnSchema([
  'CUSTOMER_RETURN',
  'DEFECTIVE',
  'WRONG_ITEM',
  'EXCHANGE',
  'OTHER',
]);
export const returnListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    search: z.string().trim().max(120).optional(),
  })
  .strict();
export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>;
export type SaleReturnInput = z.infer<typeof saleReturnSchema>;
