import { Router, type RequestHandler } from 'express';
import { prisma } from '@hello-shop/database';
import type { ZodType } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { success } from '../../lib/response.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
export type MasterKind = 'category' | 'subcategory' | 'brand' | 'unit';
export type MasterInput = {
  name: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  categoryId?: string;
  logoUrl?: string | null;
  shortName?: string;
  decimalAllowed?: boolean;
};
class MasterRepository {
  list(kind: MasterKind, businessId: string) {
    const where = { businessId };
    switch (kind) {
      case 'category':
        return prisma.category.findMany({ where, orderBy: { updatedAt: 'desc' } });
      case 'subcategory':
        return prisma.subCategory.findMany({
          where,
          include: { category: true },
          orderBy: { updatedAt: 'desc' },
        });
      case 'brand':
        return prisma.brand.findMany({ where, orderBy: { updatedAt: 'desc' } });
      case 'unit':
        return prisma.unit.findMany({ where, orderBy: { updatedAt: 'desc' } });
    }
  }
  find(kind: MasterKind, businessId: string, id: string) {
    switch (kind) {
      case 'category':
        return prisma.category.findFirst({ where: { id, businessId } });
      case 'subcategory':
        return prisma.subCategory.findFirst({
          where: { id, businessId },
          include: { category: true },
        });
      case 'brand':
        return prisma.brand.findFirst({ where: { id, businessId } });
      case 'unit':
        return prisma.unit.findFirst({ where: { id, businessId } });
    }
  }
  create(kind: MasterKind, businessId: string, userId: string, input: MasterInput) {
    switch (kind) {
      case 'category':
        return prisma.category.create({
          data: {
            businessId,
            createdById: userId,
            name: input.name,
            slug: input.slug!,
            description: input.description ?? null,
            isActive: input.isActive ?? true,
          },
        });
      case 'subcategory':
        return prisma.subCategory.create({
          data: {
            businessId,
            createdById: userId,
            categoryId: input.categoryId!,
            name: input.name,
            slug: input.slug!,
            description: input.description ?? null,
            isActive: input.isActive ?? true,
          },
        });
      case 'brand':
        return prisma.brand.create({
          data: {
            businessId,
            createdById: userId,
            name: input.name,
            slug: input.slug!,
            description: input.description ?? null,
            logoUrl: input.logoUrl ?? null,
            isActive: input.isActive ?? true,
          },
        });
      case 'unit':
        return prisma.unit.create({
          data: {
            businessId,
            createdById: userId,
            name: input.name,
            shortName: input.shortName!,
            decimalAllowed: input.decimalAllowed ?? false,
            isActive: input.isActive ?? true,
          },
        });
    }
  }
  async update(kind: MasterKind, businessId: string, id: string, input: MasterInput) {
    switch (kind) {
      case 'category':
        return prisma.category.updateMany({ where: { id, businessId }, data: input });
      case 'subcategory':
        return prisma.subCategory.updateMany({ where: { id, businessId }, data: input });
      case 'brand':
        return prisma.brand.updateMany({ where: { id, businessId }, data: input });
      case 'unit':
        return prisma.unit.updateMany({ where: { id, businessId }, data: input });
    }
  }
  async deactivate(kind: MasterKind, businessId: string, id: string) {
    const data = { isActive: false };
    switch (kind) {
      case 'category':
        return prisma.category.updateMany({ where: { id, businessId }, data });
      case 'subcategory':
        return prisma.subCategory.updateMany({ where: { id, businessId }, data });
      case 'brand':
        return prisma.brand.updateMany({ where: { id, businessId }, data });
      case 'unit':
        return prisma.unit.updateMany({ where: { id, businessId }, data });
    }
  }
  async categoryValid(businessId: string, categoryId: string) {
    return Boolean(
      await prisma.category.findFirst({ where: { id: categoryId, businessId, isActive: true } }),
    );
  }
}
class MasterService {
  constructor(
    private readonly kind: MasterKind,
    private readonly repository = new MasterRepository(),
  ) {}
  list(businessId: string) {
    return this.repository.list(this.kind, businessId);
  }
  async find(businessId: string, id: string) {
    const item = await this.repository.find(this.kind, businessId, id);
    if (!item) throw new AppError(404, 'MASTER_NOT_FOUND', 'Record was not found.');
    return item;
  }
  async create(businessId: string, userId: string, input: MasterInput) {
    if (
      this.kind === 'subcategory' &&
      (!input.categoryId || !(await this.repository.categoryValid(businessId, input.categoryId)))
    )
      throw new AppError(422, 'INVALID_CATEGORY', 'Category is invalid or inactive.');
    return this.repository.create(this.kind, businessId, userId, input);
  }
  async update(businessId: string, id: string, input: MasterInput) {
    const result = await this.repository.update(this.kind, businessId, id, input);
    if (!result.count) throw new AppError(404, 'MASTER_NOT_FOUND', 'Record was not found.');
    return this.find(businessId, id);
  }
  async remove(businessId: string, id: string) {
    const result = await this.repository.deactivate(this.kind, businessId, id);
    if (!result.count) throw new AppError(404, 'MASTER_NOT_FOUND', 'Record was not found.');
    return { deactivated: true };
  }
}
export function createMasterRouter(
  kind: MasterKind,
  auth: AuthService,
  authRepository: AuthRepository,
  createSchema: ZodType,
  updateSchema: ZodType,
  permissionPrefix: 'category' | 'brand' | 'unit',
) {
  const service = new MasterService(kind),
    router = Router();
  router.use(authenticate(auth), resolveTenant(authRepository));
  const handler =
    (operation: 'list' | 'find' | 'create' | 'update' | 'remove'): RequestHandler =>
    (req, res, next) => {
      const action =
        operation === 'list'
          ? service.list(req.tenant!.businessId)
          : operation === 'find'
            ? service.find(req.tenant!.businessId, String(req.params.id))
            : operation === 'create'
              ? service.create(req.tenant!.businessId, req.auth!.id, req.body as MasterInput)
              : operation === 'update'
                ? service.update(
                    req.tenant!.businessId,
                    String(req.params.id),
                    req.body as MasterInput,
                  )
                : service.remove(req.tenant!.businessId, String(req.params.id));
      void Promise.resolve(action)
        .then((data) => success(res, data, operation === 'create' ? 201 : 200))
        .catch(next);
    };
  router.get('/', requirePermission(permissionPrefix + '.read'), handler('list'));
  router.post(
    '/',
    requirePermission(permissionPrefix + '.create'),
    validateBody(createSchema),
    handler('create'),
  );
  router.get('/:id', requirePermission(permissionPrefix + '.read'), handler('find'));
  router.patch(
    '/:id',
    requirePermission(permissionPrefix + '.update'),
    validateBody(updateSchema),
    handler('update'),
  );
  router.delete('/:id', requirePermission(permissionPrefix + '.delete'), handler('remove'));
  return router;
}
