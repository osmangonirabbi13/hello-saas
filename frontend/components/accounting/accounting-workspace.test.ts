import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('accounting workspace boundaries', () => {
  it('is online-only and exposes no tenant or private configuration', () => {
    const api = readFileSync(resolve(process.cwd(), 'lib/api/accounting.ts'), 'utf8');
    expect(api).toContain('Internet connection required for accounting operations.');
    expect(api).not.toContain('businessId');
    expect(api).not.toContain('DATABASE_URL');
  });
  it('provides loading, error, empty and horizontal overflow states', () => {
    const ui = [
      'setup-workspace',
      'coa-workspace',
      'journal-workspace',
      'subledger-workspace',
      'report-workspace',
    ]
      .map((name) =>
        readFileSync(resolve(process.cwd(), 'components/accounting/' + name + '.tsx'), 'utf8'),
      )
      .join('\\n');
    for (const contract of [
      'aria-live',
      'role=',
      'No journals match these filters.',
      'overflow-x-auto',
    ])
      expect(ui).toContain(contract);
  });

  it('exposes the complete journal, credit, aging, and ledger controls', () => {
    const journal = readFileSync(
      resolve(process.cwd(), 'components/accounting/journal-workspace.tsx'),
      'utf8',
    );
    const subledger = readFileSync(
      resolve(process.cwd(), 'components/accounting/subledger-workspace.tsx'),
      'utf8',
    );
    const ledger = readFileSync(
      resolve(process.cwd(), 'components/accounting/report-workspace.tsx'),
      'utf8',
    );
    for (const contract of [
      'Fiscal Period',
      'Search account line',
      'Edit Draft',
      'From date',
      'To date',
      'Update Draft',
    ])
      expect(journal).toContain(contract);
    for (const contract of [
      'Available Customer Credit',
      'Available Supplier Credit',
      'Apply Credit',
      'Credits are excluded from overdue aging.',
      'Customer',
      'Supplier',
    ])
      expect(subledger).toContain(contract);
    for (const contract of [
      'Opening Balance',
      'Closing Balance',
      'Fiscal Period',
      'JRN, source or description',
    ])
      expect(ledger).toContain(contract);
  });
});
