-- STEP 3: durable retry deduplication and optimistic concurrency.
-- Reviewable migration only; intentionally not applied by Codex.
CREATE TABLE MutationIdempotency (
  id TEXT NOT NULL,
  businessId TEXT NOT NULL,
  userId TEXT NOT NULL,
  operationId TEXT NOT NULL,
  operationScope TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  status TEXT NOT NULL,
  resourceId TEXT,
  responseData JSONB,
  createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt TIMESTAMP(3),
  CONSTRAINT MutationIdempotency_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX MutationIdempotency_businessId_operationId_operationScope_key ON MutationIdempotency(businessId, operationId, operationScope);
CREATE INDEX MutationIdempotency_businessId_createdAt_idx ON MutationIdempotency(businessId, createdAt);
CREATE INDEX MutationIdempotency_businessId_status_idx ON MutationIdempotency(businessId, status);
ALTER TABLE Product ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE Customer ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE Supplier ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE Purchase ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE Sale ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
