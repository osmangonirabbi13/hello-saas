export type ApiSuccess<T> = { success: true; data: T; meta: { requestId: string } };
export type ApiError = {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string[]> };
  meta: { requestId: string };
};

export type AccessTokenClaims = { sub: string; sid: string };
export type AuthenticatedUser = { id: string; email: string };
export type TenantContext = {
  businessId: string;
  membershipId: string;
  permissions: ReadonlySet<string>;
};
