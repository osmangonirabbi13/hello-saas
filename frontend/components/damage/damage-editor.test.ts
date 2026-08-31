import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('Damage editor UX', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'components/damage/damage-editor.tsx'),
    'utf8',
  );
  it('reuses scanner helpers and provides Enter/clear/refocus feedback', () => {
    expect(source).toContain('applyProductScan');
    expect(source).toContain("e.key === 'Enter'");
    expect(source).toContain("scan: ''");
    expect(source).toContain('.focus()');
    expect(source).toContain('Scanner Ready');
  });
  it('supports multi-line summaries and accessible removal', () => {
    expect(source).toContain('Add Product');
    expect(source).toContain('Total quantity');
    expect(source).toContain('Estimated value');
    expect(source).toContain('aria-label={`Remove product');
  });
});
