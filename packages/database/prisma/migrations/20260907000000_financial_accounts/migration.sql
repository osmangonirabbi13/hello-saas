CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD', 'OTHER');
CREATE TYPE "FinancialTransactionType" AS ENUM ('OPENING_BALANCE', 'MONEY_IN', 'MONEY_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');
CREATE TYPE "FinancialDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "FinancialTransactionStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

CREATE TABLE "FinancialAccount" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "accountCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FinancialAccountType" NOT NULL,
  "description" TEXT,
  "bankName" TEXT,
  "accountHolder" TEXT,
  "accountNumber" TEXT,
  "branch" TEXT,
  "mobileNumber" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialTransfer" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "transferNo" TEXT NOT NULL,
  "sourceAccountId" TEXT NOT NULL,
  "destinationAccountId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "transferDate" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialTransfer_distinct_accounts" CHECK ("sourceAccountId" <> "destinationAccountId"),
  CONSTRAINT "FinancialTransfer_positive_amount" CHECK ("amount" > 0)
);

CREATE TABLE "FinancialTransaction" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "transferId" TEXT,
  "transactionNo" TEXT NOT NULL,
  "type" "FinancialTransactionType" NOT NULL,
  "direction" "FinancialDirection" NOT NULL,
  "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'POSTED',
  "amount" DECIMAL(18,2) NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "counterparty" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdById" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialTransaction_positive_amount" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "FinancialAccount_businessId_accountCode_key" ON "FinancialAccount"("businessId", "accountCode");
CREATE UNIQUE INDEX "FinancialAccount_businessId_name_key" ON "FinancialAccount"("businessId", "name");
CREATE INDEX "FinancialAccount_businessId_type_isActive_idx" ON "FinancialAccount"("businessId", "type", "isActive");
CREATE INDEX "FinancialAccount_businessId_createdAt_idx" ON "FinancialAccount"("businessId", "createdAt");
CREATE UNIQUE INDEX "FinancialTransaction_businessId_transactionNo_key" ON "FinancialTransaction"("businessId", "transactionNo");
CREATE INDEX "FinancialTransaction_businessId_accountId_transactionDate_createdAt_idx" ON "FinancialTransaction"("businessId", "accountId", "transactionDate", "createdAt");
CREATE INDEX "FinancialTransaction_businessId_type_direction_idx" ON "FinancialTransaction"("businessId", "type", "direction");
CREATE INDEX "FinancialTransaction_businessId_status_transactionDate_idx" ON "FinancialTransaction"("businessId", "status", "transactionDate");
CREATE INDEX "FinancialTransaction_businessId_sourceType_sourceId_idx" ON "FinancialTransaction"("businessId", "sourceType", "sourceId");
CREATE UNIQUE INDEX "FinancialTransfer_businessId_transferNo_key" ON "FinancialTransfer"("businessId", "transferNo");
CREATE INDEX "FinancialTransfer_businessId_transferDate_idx" ON "FinancialTransfer"("businessId", "transferDate");
CREATE INDEX "FinancialTransfer_businessId_sourceAccountId_idx" ON "FinancialTransfer"("businessId", "sourceAccountId");
CREATE INDEX "FinancialTransfer_businessId_destinationAccountId_idx" ON "FinancialTransfer"("businessId", "destinationAccountId");

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "FinancialTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
