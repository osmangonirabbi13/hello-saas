import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullish();
const money = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.');
const accountType = z.enum(['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER']);
const transactionType = z.enum([
  'OPENING_BALANCE',
  'MONEY_IN',
  'MONEY_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
]);

export const financialAccountCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    type: accountType,
    description: optionalText(500),
    bankName: optionalText(120),
    accountHolder: optionalText(120),
    accountNumber: optionalText(80),
    branch: optionalText(120),
    mobileNumber: optionalText(30),
    openingBalance: money.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'BANK' && (!value.bankName || !value.accountNumber)) {
      context.addIssue({
        code: 'custom',
        path: ['bankName'],
        message: 'Bank name and account number are required for a bank account.',
      });
    }
    if ((value.type === 'BKASH' || value.type === 'NAGAD') && !value.mobileNumber) {
      context.addIssue({
        code: 'custom',
        path: ['mobileNumber'],
        message: 'Mobile number is required for a mobile wallet.',
      });
    }
  });

export const financialAccountUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: optionalText(500),
    bankName: optionalText(120),
    accountHolder: optionalText(120),
    accountNumber: optionalText(80),
    branch: optionalText(120),
    mobileNumber: optionalText(30),
  })
  .strict();

export const financialAccountListSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    type: accountType.optional(),
    active: z.enum(['true', 'false']).optional(),
  })
  .strict();

export const financialTransactionCreateSchema = z
  .object({
    accountId: z.string().cuid(),
    amount: money,
    transactionDate: z.coerce.date(),
    description: z.string().trim().min(2).max(500),
    counterparty: optionalText(160),
    reference: optionalText(120),
    notes: optionalText(2000),
  })
  .strict();

export const financialAdjustmentSchema = financialTransactionCreateSchema
  .extend({
    direction: z.enum(['IN', 'OUT']),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const financialTransferSchema = z
  .object({
    sourceAccountId: z.string().cuid(),
    destinationAccountId: z.string().cuid(),
    amount: money,
    transferDate: z.coerce.date(),
    reference: optionalText(120),
    notes: optionalText(2000),
  })
  .strict()
  .refine((value) => value.sourceAccountId !== value.destinationAccountId, {
    path: ['destinationAccountId'],
    message: 'Destination account must be different from source account.',
  });

export const financialTransactionListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    accountId: z.string().cuid().optional(),
    type: transactionType.optional(),
    direction: z.enum(['IN', 'OUT']).optional(),
    status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict();

export const financialStatementSchema = financialTransactionListSchema
  .omit({ accountId: true, status: true })
  .extend({
    amountMin: money.optional(),
    amountMax: money.optional(),
  })
  .strict();

export const financialTransferListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict();

export type FinancialAccountCreateInput = z.infer<typeof financialAccountCreateSchema>;
export type FinancialAccountUpdateInput = z.infer<typeof financialAccountUpdateSchema>;
export type FinancialTransactionCreateInput = z.infer<typeof financialTransactionCreateSchema>;
export type FinancialAdjustmentInput = z.infer<typeof financialAdjustmentSchema>;
export type FinancialTransferInput = z.infer<typeof financialTransferSchema>;
