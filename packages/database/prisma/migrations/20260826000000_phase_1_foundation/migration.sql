CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Business" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_createdAt_idx" ON "Business"("createdAt");

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

CREATE TABLE "Role" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_businessId_name_key" ON "Role"("businessId", "name");
CREATE INDEX "Role_businessId_createdAt_idx" ON "Role"("businessId", "createdAt");

CREATE TABLE "BusinessMembership" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL, "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessMembership_businessId_userId_key" ON "BusinessMembership"("businessId", "userId");
CREATE INDEX "BusinessMembership_businessId_status_idx" ON "BusinessMembership"("businessId", "status");
CREATE INDEX "BusinessMembership_userId_status_idx" ON "BusinessMembership"("userId", "status");

CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL, "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

CREATE TABLE "LoginSession" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "businessId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL, "refreshTokenHash" TEXT NOT NULL,
  "previousRefreshTokenHash" TEXT, "userAgent" TEXT, "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL, "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3), "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginSession_userId_revokedAt_idx" ON "LoginSession"("userId", "revokedAt");
CREATE INDEX "LoginSession_businessId_createdAt_idx" ON "LoginSession"("businessId", "createdAt");
CREATE INDEX "LoginSession_expiresAt_idx" ON "LoginSession"("expiresAt");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "actorUserId" TEXT,
  "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT,
  "requestId" TEXT, "ipAddress" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");
CREATE INDEX "AuditLog_businessId_entityType_entityId_idx" ON "AuditLog"("businessId", "entityType", "entityId");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

ALTER TABLE "Role" ADD CONSTRAINT "Role_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BusinessMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
