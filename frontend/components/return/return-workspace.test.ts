import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const ui = readFileSync(new URL('./return-workspace.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../lib/api/returns.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
describe('return UI and print safety', () => {
  it('is online-only and never queues an authoritative return', () => {
    expect(api).toContain('navigator.onLine');
    expect(api).toContain('Internet connection required for returns.');
    expect(api).not.toContain('outbox');
  });
  it('renders remaining quantities and serial assistance', () => {
    expect(ui).toContain('returnableQuantity');
    expect(ui).toContain('eligibleSerials');
    expect(ui).toContain('Scan or select Serial / IMEI');
  });
  it('prints only posted return documents and labels drafts', () => {
    expect(ui).toMatch(/item\.status\s*===\s*'POSTED'/);
    expect(ui).toContain('DRAFT — NOT A FINAL RETURN DOCUMENT');
    expect(ui).toContain('window.print()');
    expect(css).toContain('.no-print');
  });
  it('does not invent return numbers or claim refund settlement', () => {
    expect(api).not.toMatch(/PRT-|SRT-|Math\.random|Date\.now/);
    expect(ui).toContain('Refund settlement will be handled separately.');
  });
});
