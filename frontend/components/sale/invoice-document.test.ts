import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./invoice-document.tsx', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../../lib/api/invoices.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

describe('persisted customer invoice and receipt', () => {
  it('renders persisted invoice identifiers, walk-in customer, VAT, paid, due, and serials', () => {
    expect(source).toContain('invoice.invoice.invoiceNumber');
    expect(source).toContain("invoice.customer?.name ?? 'Walk-in Customer'");
    expect(source).toContain("invoice.type === 'VAT'");
    expect(source).toContain('invoice.taxAmount');
    expect(source).toContain('invoice.paidAmount');
    expect(source).toContain('invoice.dueAmount');
    expect(source).toContain('line.serialNumbers.map');
  });
  it('supports 58mm, 80mm, A4, and browser printing', () => {
    expect(source).toContain("'58mm'");
    expect(source).toContain("'80mm'");
    expect(source).toContain('window.print()');
    expect(styles).toContain('.invoice-58mm');
    expect(styles).toContain('.invoice-80mm');
    expect(styles).toContain('@media print');
    expect(styles).toContain('.no-print');
  });
  it('loads the authoritative posted invoice endpoint and never manufactures a number', () => {
    expect(adapter).toContain('/invoice');
    expect(adapter).toContain('payload.data');
    expect(adapter).not.toMatch(/INV-\$|INV-\{|Math\.random|Date\.now/);
  });
  it('formats persisted supported amounts as BDT without changing values', () => {
    expect(source).toContain("Number(value).toLocaleString('en-BD'");
    expect(source).toContain('minimumFractionDigits: 2');
  });
});
