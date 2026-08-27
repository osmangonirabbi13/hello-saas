import type { AuthenticatedUser, TenantContext } from '@hello-shop/types';

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthenticatedUser & { sessionId: string };
      tenant?: TenantContext;
    }
  }
}

export {};
