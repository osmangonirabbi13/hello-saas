import { z } from 'zod';
const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const qty = z
  .string()
  .regex(/^\d+(?:\.\d{1,3})?$/)
  .refine((v) => Number(v) > 0);
const note = (max: number) => z.string().trim().max(max).nullish();
const accessories = z
  .array(
    z.enum(['CHARGER', 'CABLE', 'ADAPTER', 'BAG', 'BOX', 'BATTERY', 'SIM', 'MEMORY_CARD', 'OTHER']),
  )
  .max(20)
  .default([]);
export const serviceCreateSchema = z
  .object({
    customerId: z.string().cuid().nullish(),
    productId: z.string().cuid().nullish(),
    serialItemId: z.string().cuid().nullish(),
    assigneeId: z.string().cuid().nullish(),
    type: z.enum([
      'REPAIR',
      'DIAGNOSTIC',
      'INSTALLATION',
      'SOFTWARE',
      'HARDWARE',
      'MAINTENANCE',
      'OTHER',
    ]),
    typeDescription: note(500),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    deviceName: z.string().trim().min(2).max(160),
    deviceBrand: note(100),
    deviceModel: note(100),
    externalSerialNumber: note(160),
    color: note(80),
    condition: z.enum(['GOOD', 'SCRATCHED', 'DENTED', 'BROKEN', 'LIQUID_DAMAGE', 'OTHER']),
    conditionNote: note(1000),
    accessories,
    accessoriesNote: note(1000),
    customerComplaint: z.string().trim().min(5).max(3000),
    estimatedServiceCharge: money.default('0'),
    estimatedPartsCost: money.default('0'),
    parts: z
      .array(
        z
          .object({
            productId: z.string().cuid().nullish(),
            description: z.string().trim().min(2).max(300),
            quantity: qty,
            unitPrice: money,
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.serialItemId && v.externalSerialNumber)
      c.addIssue({
        code: 'custom',
        path: ['externalSerialNumber'],
        message: 'Use either a linked serial or an external serial, not both.',
      });
  });
export const serviceUpdateSchema = z
  .object({
    assigneeId: z.string().cuid().nullish(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    diagnosis: note(3000),
    recommendedWork: note(3000),
    workPerformed: note(3000),
    estimatedServiceCharge: money.optional(),
    estimatedPartsCost: money.optional(),
    serviceCharge: money.optional(),
    partsCharge: money.optional(),
    discountAmount: money.optional(),
    taxAmount: money.optional(),
    estimatedCompletionAt: z.coerce.date().nullish(),
  })
  .strict();
export const transitionNoteSchema = z.object({ note: note(2000) }).strict();
export const serviceListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    status: z
      .enum([
        'RECEIVED',
        'DIAGNOSING',
        'WAITING_FOR_APPROVAL',
        'IN_PROGRESS',
        'WAITING_FOR_PARTS',
        'READY_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ])
      .optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    assigneeId: z.string().cuid().optional(),
  })
  .strict();
const quotationLine = z
  .object({
    productId: z.string().cuid(),
    description: note(500),
    quantity: qty,
    unitPrice: money,
    discountAmount: money.default('0'),
    taxAmount: money.default('0'),
  })
  .strict();
export const quotationCreateSchema = z
  .object({
    customerId: z.string().cuid().nullish(),
    prospectName: note(160),
    prospectPhone: note(40),
    quotationDate: z.coerce.date(),
    validUntil: z.coerce.date(),
    reference: note(120),
    discountAmount: money.default('0'),
    taxAmount: money.default('0'),
    customerNote: note(3000),
    internalNote: note(3000),
    terms: note(5000),
    lines: z.array(quotationLine).min(1).max(200),
  })
  .strict()
  .refine((v) => v.validUntil >= v.quotationDate, {
    path: ['validUntil'],
    message: 'Valid until must not precede quotation date.',
  });
export const quotationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    status: z
      .enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED'])
      .optional(),
  })
  .strict();
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
export type QuotationInput = z.infer<typeof quotationCreateSchema>;
