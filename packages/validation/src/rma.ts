import { z } from 'zod';

export const rmaStatuses = [
  'RECEIVED',
  'INSPECTING',
  'APPROVED',
  'REJECTED',
  'SENT_TO_SUPPLIER',
  'SUPPLIER_PROCESSING',
  'SUPPLIER_RETURNED',
  'READY_FOR_CUSTOMER',
  'DELIVERED',
  'CANCELLED',
] as const;
const nullableText = (max: number) => z.string().trim().max(max).nullish();
const money = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/)
  .default('0');
export const warrantyLookupQuerySchema = z
  .object({
    serial: z.string().trim().min(1).max(160).optional(),
    saleLineId: z.string().cuid().optional(),
  })
  .strict()
  .refine((v) => Number(Boolean(v.serial)) + Number(Boolean(v.saleLineId)) === 1, {
    message: 'Provide exactly one serial or saleLineId.',
  });
export const rmaCreateSchema = z
  .object({
    serialNumber: z.string().trim().min(1).max(160).optional(),
    saleLineId: z.string().cuid().optional(),
    quantity: z
      .string()
      .regex(/^\d+(?:\.\d{1,3})?$/)
      .refine((v) => Number(v) > 0)
      .default('1'),
    issue: z.enum([
      'NOT_POWERING_ON',
      'DISPLAY_ISSUE',
      'BATTERY_ISSUE',
      'CHARGING_ISSUE',
      'HARDWARE_FAILURE',
      'SOFTWARE_ISSUE',
      'PHYSICAL_DAMAGE',
      'OTHER',
    ]),
    issueDescription: z.string().trim().min(5).max(2000),
    physicalCondition: z.enum(['GOOD', 'SCRATCHED', 'DENTED', 'BROKEN', 'LIQUID_DAMAGE', 'OTHER']),
    conditionNote: nullableText(1000),
    accessories: z
      .array(z.enum(['CHARGER', 'BOX', 'CABLE', 'ADAPTER', 'BATTERY', 'BAG', 'OTHER']))
      .max(20)
      .default([]),
    accessoriesNote: nullableText(1000),
    customerNotes: nullableText(2000),
    internalNotes: nullableText(3000),
  })
  .strict()
  .refine((v) => Number(Boolean(v.serialNumber)) + Number(Boolean(v.saleLineId)) === 1, {
    message: 'Provide exactly one serialNumber or saleLineId.',
  });
export const rmaUpdateSchema = z
  .object({
    supplierId: z.string().cuid().nullable().optional(),
    replacementSerialItemId: z.string().cuid().nullable().optional(),
    conditionNote: nullableText(1000),
    accessories: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    accessoriesNote: nullableText(1000),
    customerNotes: nullableText(2000),
    internalNotes: nullableText(3000),
    supplierReference: nullableText(200),
    courierReference: nullableText(200),
    courierCost: money.optional(),
    supplierServiceCost: money.optional(),
    otherOperationalCost: money.optional(),
    estimatedCustomerCharge: money.optional(),
    warrantyDecision: z
      .enum([
        'WARRANTY_APPROVED',
        'WARRANTY_REJECTED',
        'OUT_OF_WARRANTY',
        'CUSTOMER_DAMAGE',
        'PAID_SERVICE_REQUIRED',
      ])
      .nullable()
      .optional(),
    outcome: z
      .enum([
        'REPAIRED',
        'REPLACED',
        'REJECTED',
        'NO_FAULT_FOUND',
        'CUSTOMER_DAMAGE',
        'UNREPAIRABLE',
      ])
      .nullable()
      .optional(),
  })
  .strict();
export const rmaTransitionSchema = z.object({ note: nullableText(2000) }).strict();
export const rmaListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(rmaStatuses).optional(),
    search: z.string().trim().max(160).optional(),
  })
  .strict();
export type RmaCreateInput = z.infer<typeof rmaCreateSchema>;
export type RmaUpdateInput = z.infer<typeof rmaUpdateSchema>;
