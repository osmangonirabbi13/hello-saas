import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  quotationCreateSchema,
  serviceCreateSchema,
  serviceUpdateSchema,
} from '@hello-shop/validation';
import { quotationTotals } from '../modules/quotation/quotation.repository.js';
import { serviceTotals } from '../modules/service/service.repository.js';

const cuid = 'cm12345678901234567890123';

describe('service and quotation boundaries', () => {
  it('calculates money with integer minor units', () => {
    expect(
      serviceTotals({
        serviceCharge: '100.10',
        partsCharge: '20.20',
        discountAmount: '0.30',
        taxAmount: '5.00',
      }),
    ).toBe('125.00');
    const parsed = quotationCreateSchema.parse({
      quotationDate: new Date(),
      validUntil: new Date(Date.now() + 86400000),
      discountAmount: '1.00',
      taxAmount: '2.00',
      lines: [
        {
          productId: cuid,
          quantity: '2.500',
          unitPrice: '10.10',
          discountAmount: '0.25',
          taxAmount: '0.50',
        },
      ],
    });
    expect(quotationTotals(parsed).grandTotal).toBe('26.50');
  });

  it('rejects client tenant authority and direct approval mutation', () => {
    const service = {
      type: 'REPAIR',
      deviceName: 'Phone',
      condition: 'GOOD',
      customerComplaint: 'Display is blank',
      estimatedServiceCharge: '0',
      estimatedPartsCost: '0',
      parts: [],
    };
    expect(serviceCreateSchema.safeParse(service).success).toBe(true);
    expect(serviceCreateSchema.safeParse({ ...service, businessId: 'attacker' }).success).toBe(
      false,
    );
    expect(serviceUpdateSchema.safeParse({ approvalStatus: 'APPROVED' }).success).toBe(false);
  });

  it('keeps service stock and serial lifecycle untouched', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/service/service.repository.ts'),
      'utf8',
    );
    expect(source).not.toContain('stockBalance.');
    expect(source).not.toContain('stockMovement.');
    expect(source).not.toContain('serialItem.update');
    expect(source).toContain('serviceHistory.create');
    expect(source).toContain("isolationLevel: 'Serializable'");
  });

  it('converts accepted quotations through one idempotent draft-sale boundary', () => {
    const quote = readFileSync(
      resolve(process.cwd(), 'src/modules/quotation/quotation.repository.ts'),
      'utf8',
    );
    const sale = readFileSync(
      resolve(process.cwd(), 'src/modules/sale/sale.repository.ts'),
      'utf8',
    );
    expect(quote).toContain("q.status === 'CONVERTED' && q.convertedSaleId");
    expect(quote).toContain("status: 'ACCEPTED', convertedSaleId: null");
    expect(quote).toContain('createSaleDraftInTransaction');
    expect(quote).not.toContain('invoice.create');
    expect(quote).not.toContain('stockBalance.');
    expect(sale).toContain('export async function createSaleDraftInTransaction');
  });

  it('derives tenant context and protects every route with server RBAC', () => {
    for (const module of ['service', 'quotation']) {
      const routes = readFileSync(
        resolve(process.cwd(), `src/modules/${module}/${module}.routes.ts`),
        'utf8',
      );
      const controller = readFileSync(
        resolve(process.cwd(), `src/modules/${module}/${module}.controller.ts`),
        'utf8',
      );
      expect(routes).toContain('resolveTenant(repo)');
      expect(routes).toContain('requirePermission(');
      expect(controller).toContain('q.tenant!.businessId');
    }
  });
});
