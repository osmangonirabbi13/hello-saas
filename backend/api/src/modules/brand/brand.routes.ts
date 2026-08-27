import { brandCreateSchema, brandUpdateSchema } from '@hello-shop/validation';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { createMasterRouter } from '../master/master.js';
export const createBrandRouter = (auth: AuthService, repo: AuthRepository) =>
  createMasterRouter('brand', auth, repo, brandCreateSchema, brandUpdateSchema, 'brand');
