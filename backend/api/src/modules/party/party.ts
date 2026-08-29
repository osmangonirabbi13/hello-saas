import { prisma } from '@hello-shop/database';
import type { CustomerType, Prisma } from '@hello-shop/database';
import type { RequestHandler } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { success } from '../../lib/response.js';
import {
  executeIdempotent,
  expectedVersion,
  mutationIdentity,
  type MutationIdentity,
  replayIdempotent,
} from '../sync/mutation-idempotency.js';

export type PartyKind = 'customer' | 'supplier';
export type PartyInput = Record<string, unknown> & { name: string; phone: string };
export type PartyRepositoryContract = {
  create(kind: PartyKind, businessId: string, userId: string, input: PartyInput, identity?: MutationIdentity): Promise<object>;
  list(kind: PartyKind, businessId: string, query: Record<string, unknown>): Promise<object>;
  find(kind: PartyKind, businessId: string, id: string): Promise<object | null>;
  update(
    kind: PartyKind,
    businessId: string,
    id: string,
    input: Partial<PartyInput>, expectedVersion?: number,
  ): Promise<object | null>;
  deactivate(kind: PartyKind, businessId: string, id: string): Promise<boolean>;
};

const defined = (input: object) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
export class PartyRepository implements PartyRepositoryContract {
  async create(kind: PartyKind, businessId: string, userId: string, input: PartyInput, identity?: MutationIdentity) {
    return executeIdempotent({ businessId, userId, identity, payload: input, execute: async (tx) => {
      const key = kind === 'customer' ? 'CUSTOMER' : 'SUPPLIER';
      const sequence = await tx.businessSequence.upsert({
        where: { businessId_key: { businessId, key } },
        create: { businessId, key, nextValue: 2 },
        update: { nextValue: { increment: 1 } },
      });
      const code =
        (kind === 'customer' ? 'CUS-' : 'SUP-') + String(sequence.nextValue - 1).padStart(6, '0');
      if (kind === 'customer')
        return tx.customer.create({
          data: defined({
            ...input,
            businessId,
            createdById: userId,
            customerCode: code,
          }) as Prisma.CustomerUncheckedCreateInput,
        });
      return tx.supplier.create({
        data: defined({
          ...input,
          businessId,
          createdById: userId,
          supplierCode: code,
        }) as Prisma.SupplierUncheckedCreateInput,
      });
    } });
  }
  async list(kind: PartyKind, businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    const search = typeof query.search === 'string' ? query.search : undefined;
    const status =
      query.status === 'active' ? true : query.status === 'inactive' ? false : undefined;
    const district = typeof query.district === 'string' ? query.district : undefined;
    const base = {
      businessId,
      ...(status === undefined ? {} : { isActive: status }),
      ...(district ? { district: { equals: district, mode: 'insensitive' as const } } : {}),
    };
    if (kind === 'customer') {
      const where: Prisma.CustomerWhereInput = {
        ...base,
        ...(typeof query.customerType === 'string'
          ? {
              customerType: query.customerType as CustomerType,
            }
          : {}),
        ...(search
          ? {
              OR: ['customerCode', 'name', 'companyName', 'phone', 'email'].map((field) => ({
                [field]: { contains: search, mode: 'insensitive' },
              })),
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { updatedAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.customer.count({ where }),
      ]);
      return { rows, total, page, limit };
    }
    const where: Prisma.SupplierWhereInput = {
      ...base,
      ...(search
        ? {
            OR: ['supplierCode', 'name', 'companyName', 'contactPerson', 'phone', 'email'].map(
              (field) => ({ [field]: { contains: search, mode: 'insensitive' } }),
            ),
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      }),
      prisma.supplier.count({ where }),
    ]);
    return { rows, total, page, limit };
  }
  find(kind: PartyKind, businessId: string, id: string) {
    return kind === 'customer'
      ? prisma.customer.findFirst({ where: { id, businessId } })
      : prisma.supplier.findFirst({ where: { id, businessId } });
  }
  async update(kind: PartyKind, businessId: string, id: string, input: Partial<PartyInput>, expected?: number) {
    const data = defined(input);
    const result =
      kind === 'customer'
        ? await prisma.customer.updateMany({
            where: { id, businessId, ...(expected ? { version: expected } : {}) },
            data: { ...data, version: { increment: 1 } },
          })
        : await prisma.supplier.updateMany({
            where: { id, businessId, ...(expected ? { version: expected } : {}) },
            data: { ...data, version: { increment: 1 } },
          });
    if (!result.count && expected && (await this.find(kind, businessId, id)))
      throw new AppError(409, 'RECORD_CHANGED', `This ${kind} was changed on another device.`);
    return result.count ? this.find(kind, businessId, id) : null;
  }
  async deactivate(kind: PartyKind, businessId: string, id: string) {
    const result =
      kind === 'customer'
        ? await prisma.customer.updateMany({ where: { id, businessId }, data: { isActive: false } })
        : await prisma.supplier.updateMany({
            where: { id, businessId },
            data: { isActive: false },
          });
    return result.count > 0;
  }
}

export class PartyService {
  constructor(
    readonly kind: PartyKind,
    private readonly repository: PartyRepositoryContract,
  ) {}
  async create(businessId: string, userId: string, input: PartyInput, identity?: MutationIdentity) {
    const replay = await replayIdempotent<object>(businessId, identity, input);
    if (replay) return replay;
    try {
      return identity
        ? await this.repository.create(this.kind, businessId, userId, input, identity)
        : await this.repository.create(this.kind, businessId, userId, input);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new AppError(409, 'DUPLICATE_PARTY_CODE', 'The generated party code already exists.');
      }
      throw error;
    }
  }
  list(businessId: string, query: Record<string, unknown>) {
    return this.repository.list(this.kind, businessId, query);
  }
  async find(businessId: string, id: string) {
    const item = await this.repository.find(this.kind, businessId, id);
    if (!item) throw new AppError(404, 'PARTY_NOT_FOUND', 'Record was not found.');
    return item;
  }
  async update(businessId: string, id: string, input: Partial<PartyInput>, version?: number) {
    const item = await this.repository.update(this.kind, businessId, id, input, version);
    if (!item) throw new AppError(404, 'PARTY_NOT_FOUND', 'Record was not found.');
    return item;
  }
  async deactivate(businessId: string, id: string) {
    if (!(await this.repository.deactivate(this.kind, businessId, id)))
      throw new AppError(404, 'PARTY_NOT_FOUND', 'Record was not found.');
    return { deactivated: true };
  }
}

export function partyController(service: PartyService) {
  const list: RequestHandler = (req, res, next) => {
    void service
      .list(req.tenant!.businessId, req.query)
      .then((data) => success(res, data))
      .catch(next);
  };
  const create: RequestHandler = (req, res, next) => {
    void service
      .create(req.tenant!.businessId, req.auth!.id, req.body as PartyInput, mutationIdentity(req.headers['idempotency-key'], service.kind === 'customer' ? 'CUSTOMER_CREATE' : 'SUPPLIER_CREATE'))
      .then((data) => success(res, data, 201))
      .catch(next);
  };
  const find: RequestHandler = (req, res, next) => {
    void service
      .find(req.tenant!.businessId, String(req.params.id))
      .then((data) => success(res, data))
      .catch(next);
  };
  const update: RequestHandler = (req, res, next) => {
    void service
      .update(req.tenant!.businessId, String(req.params.id), req.body as PartyInput, expectedVersion(req.headers['if-match']))
      .then((data) => success(res, data))
      .catch(next);
  };
  const remove: RequestHandler = (req, res, next) => {
    void service
      .deactivate(req.tenant!.businessId, String(req.params.id))
      .then((data) => success(res, data))
      .catch(next);
  };
  return { list, create, find, update, remove };
}
