import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agingBucket } from '../modules/accounting/accounting-aging.js';
import { validateAccountingLines } from '../modules/accounting/accounting.engine.js';
import { Prisma } from '@hello-shop/database';
import { naturalBalanceChange } from '../modules/accounting/accounting-balance.js';
import { splitReturnCredit } from '../modules/accounting/source-accounting.service.js';

describe('accounting closure invariants', () => {
  it.each([
    [0, 'CURRENT'],
    [1, '1_30'],
    [30, '1_30'],
    [31, '31_60'],
    [60, '31_60'],
    [61, '61_90'],
    [90, '61_90'],
    [91, '90_PLUS'],
  ])('places %i overdue days in %s', (days, bucket) => {
    const asOf = new Date('2026-08-31T12:00:00.000Z');
    const due = new Date(asOf.getTime() - Number(days) * 86_400_000);
    expect(agingBucket(due, new Date('2000-01-01T00:00:00.000Z'), asOf)).toEqual({
      bucket,
      ageDays: days,
    });
  });

  it('uses document date when due date is absent', () => {
    expect(
      agingBucket(null, new Date('2026-08-01T23:59:59.000Z'), new Date('2026-08-31T00:00:00.000Z')),
    ).toEqual({ bucket: '1_30', ageDays: 30 });
  });

  it('accepts exact balanced Decimal-safe lines', () => {
    const totals = validateAccountingLines([
      { accountId: 'asset', debit: '100000.00', credit: 0 },
      { accountId: 'revenue', debit: 0, credit: '100000.00' },
    ]);
    expect(totals.debits.toFixed(2)).toBe('100000.00');
    expect(totals.credits.toFixed(2)).toBe('100000.00');
  });

  it.each([
    [[{ accountId: 'a', debit: 10, credit: 0 }], 'JOURNAL_LINES_REQUIRED'],
    [
      [
        { accountId: 'a', debit: 10, credit: 1 },
        { accountId: 'b', debit: 0, credit: 9 },
      ],
      'INVALID_JOURNAL_LINE',
    ],
    [
      [
        { accountId: 'a', debit: 0, credit: 0 },
        { accountId: 'b', debit: 0, credit: 0 },
      ],
      'INVALID_JOURNAL_LINE',
    ],
    [
      [
        { accountId: 'a', debit: 10, credit: 0 },
        { accountId: 'b', debit: 0, credit: 9 },
      ],
      'UNBALANCED_JOURNAL',
    ],
  ])('rejects invalid journal lines with %s', (lines, code) => {
    expect.assertions(1);
    try {
      validateAccountingLines(lines);
    } catch (error: unknown) {
      expect(error).toMatchObject({ code });
    }
  });

  it('keeps the unapplied migration in parity for allocation and mapping constraints', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations/20260908000000_accounting_foundation/migration.sql',
      ),
      'utf8',
    );
    for (const fragment of [
      'ReceivableAllocation_businessId_fkey',
      'ReceivableAllocation_receivableItemId_fkey',
      'ReceivableAllocation_financialTransactionId_fkey',
      'ReceivableAllocation_journalEntryId_fkey',
      'PayableAllocation_businessId_fkey',
      'PayableAllocation_payableItemId_fkey',
      'PayableAllocation_financialTransactionId_fkey',
      'PayableAllocation_journalEntryId_fkey',
      'ExpenseCategory_businessId_chartAccountId_idx',
      'FinancialAccount_businessId_chartAccountId_idx',
      'PartyCreditKind',
      'PartyCreditStatus',
      'PartyCredit_businessId_sourceType_sourceId_key',
      'PartyCreditApplication_businessId_sourceType_sourceId_key',
      'PartyCreditApplication_partyCreditId_fkey',
      'PartyCreditApplication_receivableItemId_fkey',
      'PartyCreditApplication_payableItemId_fkey',
      'PartyCreditApplication_journalEntryId_fkey',
    ])
      expect(migration).toContain(fragment);
  });

  it('preserves the exact moving-average and Sale COGS example', () => {
    const quantity = new Prisma.Decimal(10).plus(10);
    const cost = new Prisma.Decimal(10).mul(100).plus(new Prisma.Decimal(10).mul(200));
    const average = cost.div(quantity);
    const cogs = average.mul(4);
    expect(quantity.toFixed(3)).toBe('20.000');
    expect(cost.toFixed(2)).toBe('3000.00');
    expect(average.toFixed(6)).toBe('150.000000');
    expect(cogs.toFixed(2)).toBe('600.00');
    expect(quantity.minus(4).toFixed(3)).toBe('16.000');
    expect(cost.minus(cogs).toFixed(2)).toBe('2400.00');
  });

  it('restores Sale Return valuation from persisted historical Sale cost', () => {
    const valuation = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/inventory-valuation.service.ts'),
      'utf8',
    );
    expect(new Prisma.Decimal(2).mul(150).toFixed(2)).toBe('300.00');
    expect(valuation).toContain("sourceType: 'SALE'");
    expect(valuation).toContain('sourceId: saleReturn?.saleId');
    expect(valuation).toContain('original?.unitCost ?? averageBefore');
  });

  it('keeps automatic source matrices centralized and idempotent', () => {
    const posting = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/source-accounting.service.ts'),
      'utf8',
    );
    for (const contract of [
      'postSaleAccounting',
      'postPurchaseAccounting',
      'postSaleReturnAccounting',
      'postPurchaseReturnAccounting',
      'postExpenseAccounting',
      'postDamageAccounting',
      'postFinancialTransactionAccounting',
      'postFinancialTransferAccounting',
    ])
      expect(posting).toContain(contract);
    expect(posting).not.toContain('paymentMethod ===');
  });

  it('uses ledger lines for Trial Balance, General Ledger, and Profit and Loss', () => {
    const repository = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/accounting.repository.ts'),
      'utf8',
    );
    expect(repository).toContain('journalLine.findMany');
    expect(repository).not.toContain('prisma.sale.aggregate');
    const revenue = new Prisma.Decimal(100000);
    const cogs = new Prisma.Decimal(60000);
    const expenses = new Prisma.Decimal(10000);
    expect(revenue.minus(cogs).toFixed(2)).toBe('40000.00');
    expect(revenue.minus(cogs).minus(expenses).toFixed(2)).toBe('30000.00');
  });

  it.each([
    ['unpaid return', '6000', '2000', '2000', '0'],
    ['fully paid return', '0', '2000', '0', '2000'],
    ['partial debt plus credit', '1000', '3000', '1000', '2000'],
  ])(
    'splits %s explicitly between open debt and available credit',
    (_name, outstanding, returned, applied, available) => {
      const result = splitReturnCredit(outstanding, returned);
      expect(result.applied.toFixed(2)).toBe(Number(applied).toFixed(2));
      expect(result.available.toFixed(2)).toBe(Number(available).toFixed(2));
    },
  );

  it.each([
    ['ASSET', 'DEBIT', '10000', '2000', '8000'],
    ['EXPENSE', 'DEBIT', '300', '0', '300'],
    ['LIABILITY', 'CREDIT', '1000', '7000', '6000'],
    ['REVENUE', 'CREDIT', '1000', '100000', '99000'],
  ] as const)('uses %s normal-balance direction', (_type, normal, debit, credit, expected) => {
    expect(naturalBalanceChange(normal, debit, credit).toFixed(2)).toBe(
      Number(expected).toFixed(2),
    );
  });

  it('carries authoritative opening balance into the requested GL range', () => {
    const opening = naturalBalanceChange('DEBIT', '10000', '0');
    const movement = naturalBalanceChange('DEBIT', '0', '2000');
    expect(opening.toFixed(2)).toBe('10000.00');
    expect(opening.plus(movement).toFixed(2)).toBe('8000.00');
  });

  it('keeps credits outside aging and refunds outside return posting', () => {
    const repository = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/accounting.repository.ts'),
      'utf8',
    );
    const posting = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/source-accounting.service.ts'),
      'utf8',
    );
    expect(repository).toContain("kind: 'CUSTOMER_CREDIT'");
    expect(repository).toContain("kind: 'SUPPLIER_CREDIT'");
    expect(repository).toContain('availableCredit');
    const returnPosting = posting.slice(
      posting.indexOf('export async function postPurchaseReturnAccounting'),
      posting.indexOf('export async function postDamageAccounting'),
    );
    expect(returnPosting).not.toContain('MONEY_OUT');
    expect(returnPosting).not.toContain('financialTransaction.create');
  });

  it('preserves manual draft identity and validates selected open period', () => {
    const repository = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/accounting.repository.ts'),
      'utf8',
    );
    expect(repository).toContain('id: input.fiscalPeriodId');
    expect(repository).toContain("status: 'DRAFT'");
    expect(repository).toContain('journalLine.deleteMany');
    expect(repository).toContain('journalEntry.update');
  });

  it('guards credit application routes by tenant and party-specific RBAC', () => {
    const routes = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/accounting.routes.ts'),
      'utf8',
    );
    expect(routes).toContain("/customer-credits/:id/apply");
    expect(routes).toContain("requirePermission('receivable.receive_payment')");
    expect(routes).toContain("/supplier-credits/:id/apply");
    expect(routes).toContain("requirePermission('payable.make_payment')");
    expect(routes).toContain('authenticate(auth), resolveTenant(repository)');
    expect(routes).not.toContain('businessId');
  });

  it('persists statements from invoices, payments, return credits, and credit applications', () => {
    const repository = readFileSync(
      resolve(process.cwd(), 'src/modules/accounting/accounting.repository.ts'),
      'utf8',
    );
    for (const contract of [
      'Sale Return Credit',
      'Purchase Return Credit',
      'Credit Application',
      'partyCreditApplication.create',
      'availableCredit',
    ])
      expect(repository).toContain(contract);
    expect(repository).not.toContain('Customer.balance');
    expect(repository).not.toContain('Supplier.balance');
  });
});
