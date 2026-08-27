import { describe, expect, it, vi } from 'vitest';
import {
  customerCreateSchema,
  customerListQuerySchema,
  supplierCreateSchema,
  supplierListQuerySchema,
} from '@hello-shop/validation';
import {
  PartyService,
  type PartyInput,
  type PartyRepositoryContract,
} from '../modules/party/party.js';
const customer: PartyInput = {
  name: 'Rahman Computers',
  phone: '01712345678',
  customerType: 'DEALER',
  creditLimit: '0',
};
const supplier: PartyInput = { name: 'Tech Distribution', phone: '+8801812345678' };
function repo(overrides: Partial<PartyRepositoryContract> = {}): PartyRepositoryContract {
  return {
    create: vi.fn().mockResolvedValue({ id: 'one' }),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    find: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    deactivate: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}
describe('party validation', () => {
  it('requires a customer name and valid email', () => {
    expect(customerCreateSchema.safeParse({ ...customer, name: '' }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ ...customer, email: 'bad' }).success).toBe(false);
  });
  it('rejects negative credit limits', () => {
    expect(customerCreateSchema.safeParse({ ...customer, creditLimit: '-1' }).success).toBe(false);
  });
  it('bounds pagination and search filters', () => {
    expect(customerListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(supplierListQuerySchema.safeParse({ search: 'x'.repeat(121) }).success).toBe(false);
  });
  it('validates supplier name, phone, and email', () => {
    expect(supplierCreateSchema.safeParse(supplier).success).toBe(true);
    expect(supplierCreateSchema.safeParse({ ...supplier, phone: '', email: 'bad' }).success).toBe(
      false,
    );
  });
});
describe('party service tenant behavior', () => {
  it('passes only server tenant context for creation', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'one' });
    await new PartyService('customer', repo({ create })).create('business-a', 'user-a', customer);
    expect(create).toHaveBeenCalledWith('customer', 'business-a', 'user-a', customer);
  });
  it('returns not found for a cross-tenant identifier', async () => {
    await expect(
      new PartyService('supplier', repo()).find('business-a', 'business-b-record'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('maps duplicate customer and supplier codes to a conflict', async () => {
    for (const kind of ['customer', 'supplier'] as const) {
      const create = vi.fn().mockRejectedValue({ code: 'P2002' });
      await expect(
        new PartyService(kind, repo({ create })).create('business-a', 'user-a', kind === 'customer' ? customer : supplier),
      ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_PARTY_CODE' });
    }
  });
  it('soft deactivates and remains idempotent when repository finds the record', async () => {
    const deactivate = vi.fn().mockResolvedValue(true);
    await expect(
      new PartyService('customer', repo({ deactivate })).deactivate('business-a', 'one'),
    ).resolves.toEqual({ deactivated: true });
    expect(deactivate).toHaveBeenCalledWith('customer', 'business-a', 'one');
  });
});
