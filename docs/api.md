# Phase 1 API

- `GET /health` — process liveness
- `GET /health/ready` — PostgreSQL and Redis readiness
- `POST /api/v1/auth/login` — credentials to access token plus refresh cookie
- `POST /api/v1/auth/refresh` — rotate refresh token and issue access token
- `POST /api/v1/auth/logout` — revoke the authenticated session
- `GET /api/v1/dashboard/context` — verify authentication, tenant membership, and `dashboard.read`

Application responses use the standard success/data/error and request-ID metadata envelope. Errors never include stack traces or persistence details.
