# Offline foundation

IndexedDB is a partitioned local cache and outbox, never the business authority. Records are scoped by authenticated user ID plus a business reference. The server still derives the tenant from the authenticated session and validates permissions, stock, serial status, money, and numbering.

## Cache policy

The service worker caches only same-origin public shell routes and icons. It bypasses `/api/*`, authorization-bearing requests, non-GET requests, and cross-origin traffic. Sensitive ERP data is managed explicitly through typed Dexie repositories. Tokens, passwords, secrets, cookies, and keys are rejected from offline payloads.

## Step 2 capability boundary

Offline-safe foundations: Product, Customer, Supplier and master-data changes; Purchase and Sale drafts. Online-required: Purchase/Sale posting, final POS checkout, inventory adjustment/movement, payments, and Serial/IMEI mutation. Step 2 does not wire forms to offline mutation persistence; that is Step 3.

## Backend idempotency audit for Step 3

- `PATCH` draft/resource endpoints are naturally retry-tolerant only when the same target ID is already server-mapped, but still need version/conflict checks.
- Product, Customer, Supplier, Purchase draft and Sale draft `POST` endpoints are currently non-idempotent. Future offline create sync must send an operation ID and the server must persist/deduplicate it before those adapters are enabled.
- Purchase and Sale posting are transactional but must remain online-only. They require durable server idempotency keys before any retrying client workflow.
- Deletes require server state/version handling and must not be blindly retried.
- Health and lookup `GET` endpoints are read-only; Serial lookup is tenant-scoped but cached serial data must never authorize consumption.

## Privacy and logout

Unsynced data remains partitioned on logout so it can be resumed by the same user/business context. Another account cannot query that partition. Browser-local business data is not encrypted in Step 2; managed-device policy and optional vetted encryption-at-rest can be evaluated later. Custom cryptography is intentionally not introduced.
