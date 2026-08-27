import { z } from 'zod';
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const commonParty = z
  .object({
    name: z.string().trim().min(2).max(160),
    companyName: optionalText(160),
    phone: z.string().trim().min(5).max(30),
    alternatePhone: optionalText(30),
    email: z.string().trim().email().max(254).nullish(),
    addressLine1: optionalText(250),
    addressLine2: optionalText(250),
    area: optionalText(100),
    city: optionalText(100),
    district: optionalText(100),
    postalCode: optionalText(30),
    country: z.string().trim().min(2).max(100).default('Bangladesh'),
    taxId: optionalText(80),
    binNumber: optionalText(80),
    notes: optionalText(3000),
    isActive: z.boolean().default(true),
  })
  .strict();
export const customerCreateSchema = commonParty.extend({
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DEALER', 'CORPORATE', 'OTHER']).default('RETAIL'),
  creditLimit: z
    .string()
    .regex(/^\d+(?:\.\d{1,2})?$/)
    .nullish(),
});
export const customerUpdateSchema = customerCreateSchema.partial();
export const supplierCreateSchema = commonParty.extend({ contactPerson: optionalText(160) });
export const supplierUpdateSchema = supplierCreateSchema.partial();
const partyListBase = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    district: z.string().trim().max(100).optional(),
    sortBy: z.enum(['name', 'code', 'createdAt', 'updatedAt']).default('updatedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
export const customerListQuerySchema = partyListBase.extend({
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DEALER', 'CORPORATE', 'OTHER']).optional(),
});
export const supplierListQuerySchema = partyListBase;
