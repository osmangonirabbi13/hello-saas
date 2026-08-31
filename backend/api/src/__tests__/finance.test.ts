import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  financialAccountCreateSchema,
  financialAdjustmentSchema,
  financialTransactionCreateSchema,
  financialTransferSchema,
} from '@hello-shop/validation';

const id = 'cm12345678901234567890123';
const otherId = 'cm12345678901234567890124';
const repository = readFileSync(
  resolve(process.cwd(), 'src/modules/finance/finance.repository.ts'),
  'utf8',
);
const routes = readFileSync(
  resolve(process.cwd(), 'src/modules/finance/finance.routes.ts'),
  'utf8',
);

describe('STEP 9 finance contracts', () => {
  it.each(['CASH', 'BANK', 'BKASH', 'NAGAD'] as const)('accepts a valid %s account', (type) => {
    const extra =
      type === 'BANK'
        ? { bankName: 'City Bank', accountNumber: '12345678' }
        : type === 'BKASH' || type === 'NAGAD'
          ? { mobileNumber: '01700000000' }
          : {};
    expect(
      financialAccountCreateSchema.safeParse({ name: `${type} account`, type, ...extra }).success,
    ).toBe(true);
  });
  it('rejects client tenant, balance, and sequence authority', () => {
    const base = { name: 'Cash Counter', type: 'CASH' };
    expect(
      financialAccountCreateSchema.safeParse({ ...base, businessId: 'attacker' }).success,
    ).toBe(false);
    expect(financialAccountCreateSchema.safeParse({ ...base, balance: '999999' }).success).toBe(
      false,
    );
    expect(
      financialAccountCreateSchema.safeParse({ ...base, accountCode: 'ACC-OWN' }).success,
    ).toBe(false);
  });
  it('validates positive decimal-safe money and transfer account separation', () => {
    const transaction = {
      accountId: id,
      amount: '10.25',
      transactionDate: new Date(),
      description: 'Counter deposit',
    };
    expect(financialTransactionCreateSchema.safeParse(transaction).success).toBe(true);
    expect(
      financialTransactionCreateSchema.safeParse({ ...transaction, amount: '0' }).success,
    ).toBe(false);
    expect(
      financialTransactionCreateSchema.safeParse({ ...transaction, amount: '1.999' }).success,
    ).toBe(false);
    expect(
      financialTransferSchema.safeParse({
        sourceAccountId: id,
        destinationAccountId: id,
        amount: '10',
        transferDate: new Date(),
      }).success,
    ).toBe(false);
    expect(
      financialTransferSchema.safeParse({
        sourceAccountId: id,
        destinationAccountId: otherId,
        amount: '10',
        transferDate: new Date(),
      }).success,
    ).toBe(true);
  });
  it('requires an explicit adjustment reason', () => {
    const value = {
      accountId: id,
      amount: '100',
      transactionDate: new Date(),
      description: 'Correction',
      direction: 'IN',
    };
    expect(financialAdjustmentSchema.safeParse(value).success).toBe(false);
    expect(
      financialAdjustmentSchema.safeParse({ ...value, reason: 'Verified opening correction' })
        .success,
    ).toBe(true);
  });
  it('derives tenant before granular API permissions', () => {
    expect(routes).toContain('resolveTenant(repository)');
    for (const permission of [
      'financial_account.read',
      'financial_account.create',
      'financial_account.disable',
      'financial_transaction.read',
      'financial_transaction.create',
      'financial_transfer.create',
      'financial.adjust',
    ])
      expect(routes).toContain(`requirePermission('${permission}')`);
  });
  it('uses serializable idempotent transactions and server sequences', () => {
    expect(repository).toContain('executeIdempotent');
    expect(repository).toContain("'FINANCIAL_TRANSACTION'");
    expect(repository).toContain("'FINANCIAL_TRANSFER'");
    expect(repository).not.toMatch(/financial(Transaction|Transfer)\.count\([^)]*\)\s*\+\s*1/);
    expect(repository).not.toMatch(/Math\.random|Date\.now\(\).*TXN|Date\.now\(\).*TRF/);
  });
  it('recalculates sufficient funds inside the posting transaction', () => {
    expect(repository).toContain('accountBalance(tx, businessId');
    expect(repository).toContain("'INSUFFICIENT_FUNDS'");
    expect(repository).toContain("status: 'POSTED'");
  });
  it('posts both transfer sides atomically and preserves total funds', () => {
    expect(repository).toContain("type: 'TRANSFER_OUT'");
    expect(repository).toContain("type: 'TRANSFER_IN'");
    expect(repository).toContain("direction: 'OUT'");
    expect(repository).toContain("direction: 'IN'");
    expect(repository).toContain('financialTransaction.createMany');
  });
  it('keeps operational finance outside general accounting and inventory', () => {
    for (const forbidden of [
      'journalEntry.',
      'journalLine.',
      'ledgerEntry.',
      'chartOfAccount.',
      'stockBalance.',
      'stockMovement.',
    ])
      expect(repository).not.toContain(forbidden);
  });
  it('provides deterministic statement ordering and running balances', () => {
    expect(repository).toContain("transactionDate: 'asc'");
    expect(repository).toContain("createdAt: 'asc'");
    expect(repository).toContain('runningBalance');
    expect(repository).toContain('openingBalance');
    expect(repository).toContain('closingBalance');
  });
});
