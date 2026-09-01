import { z } from 'zod';

const nullable = (max: number) => z.string().trim().max(max).nullish();
const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const positiveMoney = money.refine(
  (value) => Number(value) > 0,
  'Amount must be greater than zero.',
);
const accountType = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);

export const accountingInitializeSchema = z
  .object({ fiscalYearStartMonth: z.number().int().min(1).max(12).default(1) })
  .strict();
export const chartAccountCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{3,10}$/),
    name: z.string().trim().min(2).max(160),
    accountType,
    accountSubType: nullable(80),
    normalBalance: z.enum(['DEBIT', 'CREDIT']),
    parentId: z.string().cuid().nullish(),
    description: nullable(500),
    allowManualPosting: z.boolean().default(true),
  })
  .strict();
export const chartAccountUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: nullable(500),
    parentId: z.string().cuid().nullish(),
    allowManualPosting: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const accountingListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    status: z.string().trim().max(30).optional(),
    type: z.string().trim().max(50).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    asOf: z.coerce.date().optional(),
    accountId: z.string().cuid().optional(),
    fiscalPeriodId: z.string().cuid().optional(),
    customerId: z.string().cuid().optional(),
    supplierId: z.string().cuid().optional(),
    ageBucket: z.enum(['CURRENT', '1_30', '31_60', '61_90', '90_PLUS']).optional(),
    sourceType: z.string().trim().max(80).optional(),
  })
  .strict();
export const fiscalPeriodCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date must not be before start date.',
  });
const journalLine = z
  .object({
    accountId: z.string().cuid(),
    debit: money.default('0'),
    credit: money.default('0'),
    description: nullable(500),
    customerId: z.string().cuid().nullish(),
    supplierId: z.string().cuid().nullish(),
    financialAccountId: z.string().cuid().nullish(),
    productId: z.string().cuid().nullish(),
    sourceLineId: z.string().max(100).nullish(),
  })
  .strict()
  .superRefine((line, context) => {
    const debit = Number(line.debit),
      credit = Number(line.credit);
    if (debit > 0 === credit > 0)
      context.addIssue({
        code: 'custom',
        message: 'Each line requires either a debit or a credit, but not both.',
      });
  });
export const manualJournalSchema = z
  .object({
    fiscalPeriodId: z.string().cuid(),
    date: z.coerce.date(),
    memo: z.string().trim().min(2).max(500),
    lines: z.array(journalLine).min(2).max(200),
  })
  .strict();
export const financialAccountMappingSchema = z
  .object({ chartAccountId: z.string().cuid() })
  .strict();
export const expenseCategoryMappingSchema = z
  .object({ chartAccountId: z.string().cuid() })
  .strict();
export const settlementSchema = z
  .object({
    financialAccountId: z.string().cuid(),
    amount: positiveMoney,
    date: z.coerce.date(),
    reference: nullable(120),
    notes: nullable(1000),
  })
  .strict();
export const creditApplicationSchema = z
  .object({
    receivableItemId: z.string().cuid().optional(),
    payableItemId: z.string().cuid().optional(),
    amount: positiveMoney,
    date: z.coerce.date(),
    notes: nullable(1000),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.receivableItemId === undefined) === (value.payableItemId === undefined))
      context.addIssue({
        code: 'custom',
        message: 'Select exactly one receivable or payable target.',
      });
  });

export type AccountingInitializeInput = z.infer<typeof accountingInitializeSchema>;
export type ChartAccountCreateInput = z.infer<typeof chartAccountCreateSchema>;
export type ChartAccountUpdateInput = z.infer<typeof chartAccountUpdateSchema>;
export type FiscalPeriodCreateInput = z.infer<typeof fiscalPeriodCreateSchema>;
export type ManualJournalInput = z.infer<typeof manualJournalSchema>;
export type SettlementInput = z.infer<typeof settlementSchema>;
export type CreditApplicationInput = z.infer<typeof creditApplicationSchema>;
