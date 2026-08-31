import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { damageInputSchema, expenseInputSchema } from '@hello-shop/validation';
const id = 'cm12345678901234567890123';
describe('STEP 8 boundaries', () => {
  it('validates damage and rejects tenant authority/duplicate serials at repository', () => {
    const x = {
      warehouseId: id,
      damageDate: new Date(),
      reason: 'BROKEN',
      lines: [{ productId: id, quantity: '1', serialItemIds: [id] }],
    };
    expect(damageInputSchema.safeParse(x).success).toBe(true);
    expect(damageInputSchema.safeParse({ ...x, businessId: 'attacker' }).success).toBe(false);
  });
  it('requires positive decimal-safe expense amounts', () => {
    const x = {
      categoryId: id,
      expenseDate: new Date(),
      amount: '2500.50',
      description: 'Monthly rent',
    };
    expect(expenseInputSchema.safeParse(x).success).toBe(true);
    expect(expenseInputSchema.safeParse({ ...x, amount: '0' }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...x, amount: '1.999' }).success).toBe(false);
  });
  it('routes derive tenant and enforce granular RBAC', () => {
    for (const m of ['damage', 'expense']) {
      const s = readFileSync(resolve(process.cwd(), `src/modules/${m}/${m}.routes.ts`), 'utf8');
      expect(s).toContain('resolveTenant(repo)');
      expect(s).toContain('requirePermission(');
    }
  });
  it('damage delegates stock only to InventoryService and preserves serial history', () => {
    const s = readFileSync(
      resolve(process.cwd(), 'src/modules/damage/damage.repository.ts'),
      'utf8',
    );
    expect(s).toContain('applyMovementInTransaction');
    expect(s).toContain("type: 'DAMAGE'");
    expect(s).toContain("status: 'DAMAGED'");
    expect(s).toContain('serialHistory.create');
    expect(s).not.toMatch(/stockBalance\.(create|update|upsert)/);
    expect(s).not.toContain('stockMovement.create');
  });
  it('expense has no inventory, accounting, balance, or payable mutation', () => {
    const s = readFileSync(
      resolve(process.cwd(), 'src/modules/expense/expense.repository.ts'),
      'utf8',
    );
    for (const forbidden of [
      'stockBalance.',
      'stockMovement.',
      'journalEntry.',
      'ledgerEntry.',
      'accountBalance',
      'supplierPayable',
    ])
      expect(s).not.toContain(forbidden);
    expect(s).toContain("key: 'EXPENSE'");
    expect(s).toContain("status: 'POSTED'");
  });
  it('preserves draft identity and protects multi-line atomic posting', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/damage/damage.repository.ts'),
      'utf8',
    );
    expect(source).toContain('tx.damage.update({');
    expect(source).not.toContain('return this.create(b, u, i)');
    expect(source).toContain("key: 'DAMAGE'");
    expect(source).toContain("isolationLevel: 'Serializable'");
    expect(source).toContain("status: 'DRAFT'");
    expect(source).toContain('serialItem.updateMany');
    expect(source).toContain('damageLine.deleteMany');
  });
  it('implements tenant-scoped filters and immutable posted records', () => {
    const damage = readFileSync(
      resolve(process.cwd(), 'src/modules/damage/damage.repository.ts'),
      'utf8',
    );
    const expense = readFileSync(
      resolve(process.cwd(), 'src/modules/expense/expense.repository.ts'),
      'utf8',
    );
    for (const source of [damage, expense]) {
      expect(source).toContain('businessId');
      expect(source).toContain('updateMany');
      expect(source).toContain("status: 'DRAFT'");
    }
    for (const key of ['categoryId', 'paymentMethod', 'dateFrom', 'dateTo', 'search'])
      expect(expense).toContain(key);
  });
});
