# Phase 1 database

The initial PostgreSQL migration creates users, businesses, memberships, roles, permissions, role-permission grants, login sessions, and tenant-scoped audit logs. Tenant-owned indexes begin with `businessId` where applicable. The checked-in migration is local and has not been applied to any database.
