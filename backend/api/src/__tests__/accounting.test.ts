import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { manualJournalSchema } from '@hello-shop/validation';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('STEP 10 accounting contracts', () => {
  it('rejects client tenant authority and one-sided invalid lines', () => {
    const valid = {
      fiscalPeriodId: 'cm12345678901234567890122',
      date: new Date(),
      memo: 'Opening correction',
      lines: [
        { accountId: 'cm12345678901234567890123', debit: '10.00', credit: '0' },
        { accountId: 'cm12345678901234567890124', debit: '0', credit: '10.00' },
      ],
    };
    expect(manualJournalSchema.safeParse(valid).success).toBe(true);
    expect(manualJournalSchema.safeParse({ ...valid, businessId: 'attacker' }).success).toBe(false);
    expect(
      manualJournalSchema.safeParse({
        ...valid,
        lines: [{ ...valid.lines[0], credit: '1.00' }, valid.lines[1]],
      }).success,
    ).toBe(false);
  });
  it('enforces balanced, idempotent, open-period posting centrally', () => {
    const engine = source('src/modules/accounting/accounting.engine.ts');
    expect(engine).toContain('UNBALANCED_JOURNAL');
    expect(engine).toContain('businessId_sourceType_sourceId_sourceEvent');
    expect(engine).toContain("status: 'OPEN'");
    expect(engine).toContain("key: 'ACCOUNTING_JOURNAL'");
  });
  it('derives tenant before server-side accounting permissions', () => {
    const routes = source('src/modules/accounting/accounting.routes.ts');
    expect(routes).toContain('authenticate(auth), resolveTenant(repository)');
    expect(routes).not.toContain('businessId');
    for (const permission of [
      'accounting.initialize',
      'coa.manage',
      'journal.post',
      'fiscal_period.close',
    ])
      expect(routes).toContain(permission);
  });
  it('keeps stock valuation at the InventoryService repository boundary', () => {
    const inventory = source('src/modules/inventory/inventory.repository.ts');
    const valuation = source('src/modules/accounting/inventory-valuation.service.ts');
    expect(inventory).toContain('applyInventoryValuation');
    expect(valuation).toContain('inventoryCostState.upsert');
    expect(valuation).toContain('inventoryCostMovement.create');
    expect(source('src/modules/sale/sale.repository.ts')).toContain('postSaleAccounting(tx');
    expect(source('src/modules/purchase/purchase.repository.ts')).toContain(
      'postPurchaseAccounting(tx',
    );
  });
  it('does not infer cash settlement from legacy paid/payment metadata', () => {
    const posting = source('src/modules/accounting/source-accounting.service.ts');
    expect(posting).not.toContain('paidAmount');
    expect(posting).not.toContain('paymentMethod');
    expect(posting).toContain('receivableItem.upsert');
    expect(posting).toContain('payableItem.upsert');
  });
});
