import { categoryCreateSchema, categoryUpdateSchema } from '@hello-shop/validation';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { createMasterRouter } from '../master/master.js';

export const createCategoryRouter = (auth: AuthService, repository: AuthRepository) =>
  createMasterRouter(
    'category',
    auth,
    repository,
    categoryCreateSchema,
    categoryUpdateSchema,
    'category',
  );
