import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('RMA customer experience boundaries',()=>{
 it('keeps public tracking sanitized and generates QR locally',()=>{
  const api=readFileSync(resolve(process.cwd(),'../backend/api/src/modules/rma/rma.repository.ts'),'utf8');
  const ui=readFileSync(resolve(process.cwd(),'components/warranty/rma-workspace.tsx'),'utf8');
  expect(api).toContain('randomBytes(32)');
  expect(api).toContain('publicTrack');
  expect(ui).toContain('QRCode.toDataURL');
  expect(ui).toContain('/track/rma/');
 });
});
