import type { RequestHandler } from 'express';
import { success } from '../../lib/response.js';
import type { AuthService } from './auth.service.js';

const cookieName = 'hello_shop_refresh';

export function authController(service: AuthService, cookieSecure: boolean) {
  const cookie = {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'strict' as const,
    path: '/api/v1/auth',
    maxAge: 30 * 86_400_000,
  };
  const login: RequestHandler = (request, response, next) => {
    const body = request.body as { email: string; password: string };
    const userAgent = request.get('user-agent');
    const ipAddress = request.ip;
    void service
      .login({
        email: body.email,
        password: body.password,
        ...(userAgent ? { userAgent } : {}),
        ...(ipAddress ? { ipAddress } : {}),
      })
      .then((result) => {
        response.cookie(cookieName, result.refreshToken, cookie);
        success(response, {
          accessToken: result.accessToken,
          user: result.user,
          business: result.business,
          permissions: result.permissions,
        });
      })
      .catch(next);
  };
  const register: RequestHandler = (request, response, next) => {
    const body = request.body as {
      email: string;
      password: string;
      displayName: string;
      businessName: string;
      businessSlug: string;
    };
    const userAgent = request.get('user-agent');
    const ipAddress = request.ip;
    void service
      .register({
        ...body,
        ...(userAgent ? { userAgent } : {}),
        ...(ipAddress ? { ipAddress } : {}),
      })
      .then((result) => {
        response.cookie(cookieName, result.refreshToken, cookie);
        success(
          response,
          {
            accessToken: result.accessToken,
            user: result.user,
            business: result.business,
            permissions: result.permissions,
          },
          201,
        );
      })
      .catch(next);
  };
  const refresh: RequestHandler = (request, response, next) => {
    const token = (request.cookies as Record<string, string | undefined>)[cookieName];
    if (!token) {
      response.status(401).json({
        success: false,
        error: { code: 'INVALID_SESSION', message: 'Session is invalid.' },
        meta: { requestId: request.id },
      });
      return;
    }
    void service
      .refresh(token)
      .then((result) => {
        response.cookie(cookieName, result.refreshToken, cookie);
        success(response, { accessToken: result.accessToken });
      })
      .catch(next);
  };
  const logout: RequestHandler = (request, response, next) => {
    if (!request.auth) return next();
    void service
      .logout(request.auth.sessionId, request.auth.id)
      .then(() => {
        response.clearCookie(cookieName, { path: '/api/v1/auth' });
        success(response, { loggedOut: true });
      })
      .catch(next);
  };
  return { register, login, refresh, logout };
}
