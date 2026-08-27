import { z } from 'zod';
const positiveQuantity = z
  .string()
  .regex(/^\d+(?:\.\d{1,3})?$/)
  .refine((value) => Number(value) > 0, 'Quantity must be greater than zero.');
const list = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
  })
  .strict();
export const stockListQuerySchema = list.extend({
  category: z.string().cuid().optional(),
  brand: z.string().cuid().optional(),
  warehouse: z.string().cuid().optional(),
  status: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NEGATIVE_STOCK']).optional(),
  serialized: z.enum(['true', 'false']).optional(),
});
export const movementListQuerySchema = list.extend({
  productId: z.string().cuid().optional(),
  warehouseId: z.string().cuid().optional(),
  type: z
    .enum([
      'OPENING_STOCK',
      'PURCHASE',
      'PURCHASE_RETURN',
      'SALE',
      'SALE_RETURN',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'DAMAGE',
      'TRANSFER_IN',
      'TRANSFER_OUT',
    ])
    .optional(),
});
export const adjustmentCreateSchema = z
  .object({
    warehouseId: z.string().cuid(),
    reason: z.enum([
      'OPENING_BALANCE',
      'PHYSICAL_COUNT',
      'DAMAGE_CORRECTION',
      'LOST',
      'FOUND',
      'DATA_CORRECTION',
      'OTHER',
    ]),
    note: z.string().trim().max(1000).nullish(),
    lines: z
      .array(
        z.object({
          productId: z.string().cuid(),
          direction: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
          quantity: positiveQuantity,
          unitCost: z
            .string()
            .regex(/^\d+(?:\.\d{1,2})?$/)
            .nullish(),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const adjustmentListQuerySchema = list.extend({
  warehouseId: z.string().cuid().optional(),
  reason: z
    .enum([
      'OPENING_BALANCE',
      'PHYSICAL_COUNT',
      'DAMAGE_CORRECTION',
      'LOST',
      'FOUND',
      'DATA_CORRECTION',
      'OTHER',
    ])
    .optional(),
});
export const serialListQuerySchema = list.extend({
  warehouseId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
  status: z
    .enum([
      'IN_STOCK',
      'RESERVED',
      'SOLD',
      'RETURNED',
      'DAMAGED',
      'IN_RMA',
      'SENT_TO_SUPPLIER',
      'RECEIVED_FROM_SUPPLIER',
      'DELIVERED_TO_CUSTOMER',
      'SCRAPPED',
    ])
    .optional(),
});
