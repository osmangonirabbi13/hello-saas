# Step 3 offline workflows

Hello Shop remains server-authoritative. IndexedDB provides a user-and-business-partitioned working copy for Product, Customer, Supplier, Purchase Draft, and Sale Draft create/update workflows. Category, Brand, and Unit records are bounded read-only offline references in Step 3.

## Mutation contract

Retryable creates send the durable operation UUID as the Idempotency-Key header. The API scopes the claim by the authenticated server-derived business, operation scope, and key. A canonical SHA-256 request hash prevents a reused key from returning a result for different input. The claim, domain create, BusinessSequence allocation, audit write, and sanitized response are committed in one serializable PostgreSQL transaction.

Product, Customer, Supplier, Purchase, and Sale carry integer version values. Offline updates send their base version through If-Match. A stale version becomes RECORD_CHANGED; a Purchase/Sale that is no longer DRAFT becomes a lifecycle conflict. There is no blind overwrite action.

Migration 20260902000000_offline_sync_safety creates MutationIdempotency and the five version columns. It is intentionally created but not applied.

## Local relationships and reads

Local IDs are collision-safe and never impersonate server IDs. Draft payload relationships are resolved centrally from the Step 2 ID mapping store. Outbox dependencies force Supplier/Customer/Product creates to complete before dependent Purchase/Sale drafts. Effective lists merge cached server records, local creates, and pending overlays and suppress the cached duplicate after a local-to-server mapping exists.

Authenticated hydration is explicitly bounded to the first 100 Products, Customers, Suppliers, Categories, Brands, and Units. Snapshot metadata records lastFetchedAt, lastSyncedAt, and record count. Large businesses need cursor-based incremental snapshots in a future scaling step.

## Conflict and retry behavior

Sync normalizes unique, validation, record changed/deleted, permission, authentication, and network failures. Network failures remain retryable. Authentication pauses the run and retains data. Permission loss and validation/version conflicts move to Needs Review and do not retry automatically. Sync Center provides review, corrected retry, and discard; it never offers blind server overwrite.

## Online-only authority

The following are never executed or queued offline:

- Purchase posting
- Sale posting and final POS checkout
- payments or accounting entries
- StockMovement, StockBalance, or adjustment mutation
- Serial/IMEI validation, reservation, or consumption

Cached stock is informational only. An offline Sale Draft may retain serial text as unverified draft input, but the server must revalidate it online before posting.

## Security and limitations

The local business reference partitions data; it is never sent or trusted as tenant authority. The API derives business context from the authenticated persisted session and membership. Offline payload guards reject token, password, secret, cookie, and key-shaped fields. No authoritative audit entry is created locally.

Step 3 does not claim full offline POS, authoritative offline inventory, offline serial consumption, or offline payments.
