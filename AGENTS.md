# Repository guidance

`PROJECT_SPEC.md` is the product source of truth. Keep strict tenant isolation, controller/service/repository boundaries, strict TypeScript, server-side permission checks, and reviewable migrations. Never accept a client-provided `businessId` as tenant context. Do not add Phase 2+ modules until Phase 1 tenant-isolation tests pass.
