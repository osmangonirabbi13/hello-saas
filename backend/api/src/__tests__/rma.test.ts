import { describe, expect, it } from 'vitest';
import { rmaCreateSchema, warrantyLookupQuerySchema } from '@hello-shop/validation';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('RMA boundaries', () => {
  it('requires exactly one authoritative lookup key', () => {
    expect(warrantyLookupQuerySchema.safeParse({ serial: 'IMEI-1' }).success).toBe(true);
    expect(warrantyLookupQuerySchema.safeParse({ saleLineId: 'cm12345678901234567890123' }).success).toBe(true);
    expect(warrantyLookupQuerySchema.safeParse({}).success).toBe(false);
    expect(warrantyLookupQuerySchema.safeParse({ serial: 'x', saleLineId: 'cm12345678901234567890123' }).success).toBe(false);
  });
  it('rejects client tenant/source authority and incomplete intake', () => {
    const valid={serialNumber:'IMEI-1',issue:'DISPLAY_ISSUE',issueDescription:'Display has no image',physicalCondition:'GOOD',accessories:[]};
    expect(rmaCreateSchema.safeParse(valid).success).toBe(true);
    expect(rmaCreateSchema.safeParse({...valid,businessId:'attacker'}).success).toBe(false);
    expect(rmaCreateSchema.safeParse({...valid,saleLineId:'cm12345678901234567890123'}).success).toBe(false);
    expect(rmaCreateSchema.safeParse({...valid,issueDescription:'bad'}).success).toBe(false);
  });
  it('keeps stock authority and tenant derivation out of controllers', () => {
    const repository=readFileSync(resolve(process.cwd(),'src/modules/rma/rma.repository.ts'),'utf8');
    const controller=readFileSync(resolve(process.cwd(),'src/modules/rma/rma.controller.ts'),'utf8');
    expect(repository).not.toContain('stockBalance.');
    expect(repository).not.toContain('stockMovement.');
    expect(repository).toContain("status: 'IN_RMA'");
    expect(repository).toContain("status: 'SOLD'");
    expect(controller).toContain('q.tenant');
  });
  it('uses conflict guards and append-only histories', () => {
    const repository=readFileSync(resolve(process.cwd(),'src/modules/rma/rma.repository.ts'),'utf8');
    expect(repository).toContain("isolationLevel: 'Serializable'");
    expect(repository).toContain('serialItem.updateMany');
    expect(repository).toContain('rmaHistory.create');
    expect(repository).toContain('serialHistory.create');
    expect(repository).not.toContain('rmaHistory.update');
    expect(repository).not.toContain('serialHistory.update');
  });
});
