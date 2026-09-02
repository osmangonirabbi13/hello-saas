ALTER TYPE "MembershipStatus" ADD VALUE 'INACTIVE';
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','INTERN','OTHER');
CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING','ACCEPTED','EXPIRED','REVOKED');
CREATE TYPE "ApprovalActionType" AS ENUM ('SALE_HIGH_DISCOUNT','PURCHASE_POST','SALE_RETURN_POST','PURCHASE_RETURN_POST','DAMAGE_POST','EXPENSE_POST','FINANCIAL_MONEY_OUT','FINANCIAL_TRANSFER','FINANCIAL_ADJUSTMENT','MANUAL_JOURNAL_POST','JOURNAL_REVERSE','FISCAL_PERIOD_CLOSE','TEAM_ROLE_CHANGE','TEAM_SUSPEND');
CREATE TYPE "ApprovalThresholdType" AS ENUM ('NONE','ALWAYS','AMOUNT','PERCENTAGE');
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING','APPROVED','EXECUTING','REJECTED','CANCELLED','EXPIRED','EXECUTED','STALE');
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVED','REJECTED');

ALTER TABLE "BusinessMembership" ADD COLUMN "employeeCode" TEXT, ADD COLUMN "jobTitle" TEXT, ADD COLUMN "phone" TEXT, ADD COLUMN "employmentType" "EmploymentType", ADD COLUMN "joinedAt" TIMESTAMP(3), ADD COLUMN "notes" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "JournalEntry" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FiscalPeriod" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Role" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "createdById" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT, ADD COLUMN "summary" TEXT;

CREATE TABLE "TeamInvitation" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "email" TEXT NOT NULL, "roleId" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "jobTitle" TEXT, "employeeCode" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ApprovalPolicy" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "actionType" "ApprovalActionType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "thresholdType" "ApprovalThresholdType" NOT NULL DEFAULT 'NONE',
  "thresholdValue" DECIMAL(18,4), "requiredApprovals" INTEGER NOT NULL DEFAULT 1, "approverRoleId" TEXT,
  "allowSelfApproval" BOOLEAN NOT NULL DEFAULT false, "expiresAfterHours" INTEGER, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ApprovalRequest" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "policyId" TEXT NOT NULL, "approvalNumber" TEXT NOT NULL,
  "actionType" "ApprovalActionType" NOT NULL, "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL, "reviewedById" TEXT, "reason" TEXT NOT NULL, "requesterNote" TEXT,
  "reviewerNote" TEXT, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "sourceVersion" INTEGER NOT NULL,
  "payloadSnapshot" JSONB NOT NULL, "payloadHash" TEXT NOT NULL, "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ApprovalDecision" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "approvalRequestId" TEXT NOT NULL, "reviewerId" TEXT NOT NULL,
  "decision" "ApprovalDecisionType" NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");
CREATE UNIQUE INDEX "TeamInvitation_pending_business_email_key" ON "TeamInvitation"("businessId", lower("email")) WHERE "status" = 'PENDING';
CREATE INDEX "TeamInvitation_businessId_status_createdAt_idx" ON "TeamInvitation"("businessId","status","createdAt");
CREATE INDEX "TeamInvitation_businessId_email_status_idx" ON "TeamInvitation"("businessId","email","status");
CREATE INDEX "TeamInvitation_expiresAt_status_idx" ON "TeamInvitation"("expiresAt","status");
CREATE UNIQUE INDEX "ApprovalPolicy_businessId_actionType_key" ON "ApprovalPolicy"("businessId","actionType");
CREATE INDEX "ApprovalPolicy_businessId_enabled_actionType_idx" ON "ApprovalPolicy"("businessId","enabled","actionType");
CREATE UNIQUE INDEX "ApprovalRequest_businessId_approvalNumber_key" ON "ApprovalRequest"("businessId","approvalNumber");
CREATE INDEX "ApprovalRequest_businessId_status_requestedAt_idx" ON "ApprovalRequest"("businessId","status","requestedAt");
CREATE INDEX "ApprovalRequest_businessId_actionType_status_idx" ON "ApprovalRequest"("businessId","actionType","status");
CREATE INDEX "ApprovalRequest_businessId_sourceType_sourceId_status_idx" ON "ApprovalRequest"("businessId","sourceType","sourceId","status");
CREATE INDEX "ApprovalRequest_businessId_requestedById_requestedAt_idx" ON "ApprovalRequest"("businessId","requestedById","requestedAt");
CREATE UNIQUE INDEX "ApprovalDecision_approvalRequestId_reviewerId_key" ON "ApprovalDecision"("approvalRequestId","reviewerId");
CREATE INDEX "ApprovalDecision_businessId_createdAt_idx" ON "ApprovalDecision"("businessId","createdAt");
CREATE INDEX "Role_businessId_isActive_name_idx" ON "Role"("businessId","isActive","name");
CREATE INDEX "AuditLog_businessId_action_createdAt_idx" ON "AuditLog"("businessId","action","createdAt");

ALTER TABLE "Role" ADD CONSTRAINT "Role_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ApprovalPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
