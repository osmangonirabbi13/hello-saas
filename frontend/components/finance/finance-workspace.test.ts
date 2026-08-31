import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const ui = readFileSync(new URL('./finance-workspace.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../lib/api/finance.ts', import.meta.url), 'utf8');
const offline = readFileSync(new URL('../../lib/offline/capabilities.ts', import.meta.url), 'utf8');
describe('finance UI boundaries', () => {
  it('is online-only and never queues money authority', () => {
    expect(api).toContain('navigator.onLine');
    expect(api).toContain('Internet connection required for financial transactions.');
    expect(api).not.toContain('outbox');
    expect(offline).toContain("'finance.mutate': 'ONLINE_REQUIRED'");
  });
  it('never generates authoritative account, TXN, or TRF numbers', () => {
    expect(api).not.toMatch(/ACC-|TXN-|TRF-|Date\.now|Math\.random/);
    expect(ui).not.toMatch(/`(?:ACC|TXN|TRF)-/);
  });
  it('renders account balance, statement, transaction, and transfer workflows', () => {
    for (const label of [
      'Total available funds',
      'Available Balance',
      'Money In',
      'Money Out',
      'Transfer Funds',
      'Account Adjustment',
      'Running Balance',
    ])
      expect(ui).toContain(label);
  });
  it('includes loading, empty, error, retry, and confirmation states', () => {
    for (const contract of [
      'TableSkeleton',
      'EmptyState',
      'ErrorState',
      'Retry',
      'ConfirmDialog',
      'role="alert"',
    ])
      expect(ui).toContain(contract);
  });
  it('uses responsive grids, overflow containment, and tabular money', () => {
    expect(ui).toContain('sm:grid-cols');
    expect(ui).toContain('overflow-x-auto');
    expect(ui).toContain('tabular-nums');
  });
});
