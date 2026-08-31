import { z } from 'zod';
const money = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/)
  .refine((v) => Number(v) > 0);
const qty = z
  .string()
  .regex(/^\d+(?:\.\d{1,3})?$/)
  .refine((v) => Number(v) > 0);
const nullable = (n: number) => z.string().trim().max(n).nullish();
export const damageInputSchema = z
  .object({
    warehouseId: z.string().cuid(),
    damageDate: z.coerce.date(),
    reason: z.enum([
      'BROKEN',
      'WATER_DAMAGE',
      'FIRE_DAMAGE',
      'ELECTRICAL_DAMAGE',
      'SHIPPING_DAMAGE',
      'HANDLING_DAMAGE',
      'EXPIRED',
      'UNUSABLE',
      'MISSING_PARTS',
      'OTHER',
    ]),
    notes: nullable(2000),
    lines: z
      .array(
        z
          .object({
            productId: z.string().cuid(),
            quantity: qty,
            serialItemIds: z.array(z.string().cuid()).max(200).default([]),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export const damageListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    reason: z
      .enum([
        'BROKEN',
        'WATER_DAMAGE',
        'FIRE_DAMAGE',
        'ELECTRICAL_DAMAGE',
        'SHIPPING_DAMAGE',
        'HANDLING_DAMAGE',
        'EXPIRED',
        'UNUSABLE',
        'MISSING_PARTS',
        'OTHER',
      ])
      .optional(),
    warehouseId: z.string().cuid().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict();
export const expenseInputSchema = z
  .object({
    categoryId: z.string().cuid(),
    expenseDate: z.coerce.date(),
    amount: money,
    description: z.string().trim().min(2).max(500),
    payee: nullable(160),
    paymentMethod: z.enum(['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER']).nullish(),
    reference: nullable(120),
    notes: nullable(2000),
  })
  .strict();
export const expenseListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    categoryId: z.string().cuid().optional(),
    paymentMethod: z.enum(['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER']).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict();
export const expenseCategoryCreateSchema = z
  .object({ name: z.string().trim().min(2).max(100), description: nullable(500) })
  .strict();
export const expenseCategoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: nullable(500),
    isActive: z.boolean().optional(),
  })
  .strict();
export type DamageInput = z.infer<typeof damageInputSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type ExpenseCategoryCreateInput = z.infer<typeof expenseCategoryCreateSchema>;
export type ExpenseCategoryUpdateInput = z.infer<typeof expenseCategoryUpdateSchema>;
