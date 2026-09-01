-- STEP 10: proper accounting foundation. Created for review; intentionally not applied.
CREATE TYPE "AccountingAccountType" AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
CREATE TYPE "AccountingNormalBalance" AS ENUM ('DEBIT','CREDIT');
CREATE TYPE "AccountingSystemKey" AS ENUM ('CASH_AND_BANK','ACCOUNTS_RECEIVABLE','INVENTORY','INPUT_VAT','OTHER_CURRENT_ASSET','ACCOUNTS_PAYABLE','EXPENSE_PAYABLE','VAT_PAYABLE','OTHER_CURRENT_LIABILITY','OWNER_CAPITAL','RETAINED_EARNINGS','OPENING_BALANCE_EQUITY','SALES_REVENUE','SERVICE_REVENUE','OTHER_INCOME','SALES_RETURN','COGS','INVENTORY_DAMAGE_LOSS','RENT_EXPENSE','UTILITY_EXPENSE','MARKETING_EXPENSE','DELIVERY_EXPENSE','OTHER_EXPENSE');
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN','CLOSED');
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT','POSTED','REVERSED');
CREATE TYPE "OpenItemStatus" AS ENUM ('OPEN','PARTIALLY_PAID','PAID','CANCELLED');
CREATE TYPE "PartyCreditKind" AS ENUM ('CUSTOMER_CREDIT','SUPPLIER_CREDIT');
CREATE TYPE "PartyCreditStatus" AS ENUM ('AVAILABLE','PARTIALLY_APPLIED','APPLIED','CANCELLED');

ALTER TABLE "ExpenseCategory" ADD COLUMN "chartAccountId" TEXT;
ALTER TABLE "FinancialAccount" ADD COLUMN "chartAccountId" TEXT;

CREATE TABLE "ChartAccount" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "accountType" "AccountingAccountType" NOT NULL, "accountSubType" TEXT, "normalBalance" "AccountingNormalBalance" NOT NULL,
  "systemKey" "AccountingSystemKey", "parentId" TEXT, "description" TEXT, "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "allowManualPosting" BOOLEAN NOT NULL DEFAULT true, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ChartAccount_businessId_code_key" ON "ChartAccount"("businessId","code");
CREATE UNIQUE INDEX "ChartAccount_businessId_systemKey_key" ON "ChartAccount"("businessId","systemKey");
CREATE INDEX "ChartAccount_businessId_accountType_isActive_idx" ON "ChartAccount"("businessId","accountType","isActive");
CREATE INDEX "ChartAccount_businessId_parentId_idx" ON "ChartAccount"("businessId","parentId");

CREATE TABLE "AccountingSettings" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "accountingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1, "receivableAccountId" TEXT, "payableAccountId" TEXT,
  "expensePayableAccountId" TEXT, "inventoryAccountId" TEXT, "salesRevenueAccountId" TEXT, "serviceRevenueAccountId" TEXT,
  "cogsAccountId" TEXT, "salesReturnAccountId" TEXT, "damageLossAccountId" TEXT, "inputVatAccountId" TEXT,
  "outputVatAccountId" TEXT, "openingBalanceEquityAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AccountingSettings_businessId_key" ON "AccountingSettings"("businessId");

CREATE TABLE "FiscalPeriod" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "name" TEXT NOT NULL, "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL, "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalPeriod_valid_dates" CHECK ("endDate" >= "startDate")
);
CREATE UNIQUE INDEX "FiscalPeriod_businessId_name_key" ON "FiscalPeriod"("businessId","name");
CREATE INDEX "FiscalPeriod_businessId_status_startDate_endDate_idx" ON "FiscalPeriod"("businessId","status","startDate","endDate");

CREATE TABLE "JournalEntry" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "journalNumber" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "memo" TEXT NOT NULL, "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT', "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL, "sourceEvent" TEXT NOT NULL, "fiscalPeriodId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "postedById" TEXT, "postedAt" TIMESTAMP(3), "reversalOfId" TEXT, "reversedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "JournalEntry_businessId_journalNumber_key" ON "JournalEntry"("businessId","journalNumber");
CREATE UNIQUE INDEX "JournalEntry_businessId_sourceType_sourceId_sourceEvent_key" ON "JournalEntry"("businessId","sourceType","sourceId","sourceEvent");
CREATE UNIQUE INDEX "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");
CREATE INDEX "JournalEntry_businessId_status_date_idx" ON "JournalEntry"("businessId","status","date");
CREATE INDEX "JournalEntry_businessId_fiscalPeriodId_idx" ON "JournalEntry"("businessId","fiscalPeriodId");

CREATE TABLE "JournalLine" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "journalEntryId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0, "credit" DECIMAL(18,2) NOT NULL DEFAULT 0, "description" TEXT,
  "customerId" TEXT, "supplierId" TEXT, "financialAccountId" TEXT, "productId" TEXT, "sourceLineId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalLine_one_sided_positive" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))
);
CREATE INDEX "JournalLine_businessId_accountId_createdAt_idx" ON "JournalLine"("businessId","accountId","createdAt");
CREATE INDEX "JournalLine_businessId_customerId_idx" ON "JournalLine"("businessId","customerId");
CREATE INDEX "JournalLine_businessId_supplierId_idx" ON "JournalLine"("businessId","supplierId");
CREATE INDEX "JournalLine_businessId_productId_idx" ON "JournalLine"("businessId","productId");
CREATE INDEX "ExpenseCategory_businessId_chartAccountId_idx" ON "ExpenseCategory"("businessId","chartAccountId");
CREATE INDEX "FinancialAccount_businessId_chartAccountId_idx" ON "FinancialAccount"("businessId","chartAccountId");

CREATE TABLE "ReceivableItem" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "customerId" TEXT, "saleId" TEXT NOT NULL, "invoiceId" TEXT,
  "originalAmount" DECIMAL(18,2) NOT NULL, "settledAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "dueDate" TIMESTAMP(3),
  "status" "OpenItemStatus" NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ReceivableItem_saleId_key" ON "ReceivableItem"("saleId");
CREATE INDEX "ReceivableItem_businessId_status_dueDate_idx" ON "ReceivableItem"("businessId","status","dueDate");
CREATE INDEX "ReceivableItem_businessId_customerId_status_idx" ON "ReceivableItem"("businessId","customerId","status");

CREATE TABLE "PayableItem" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "purchaseId" TEXT NOT NULL,
  "originalAmount" DECIMAL(18,2) NOT NULL, "settledAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "dueDate" TIMESTAMP(3),
  "status" "OpenItemStatus" NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PayableItem_purchaseId_key" ON "PayableItem"("purchaseId");
CREATE INDEX "PayableItem_businessId_status_dueDate_idx" ON "PayableItem"("businessId","status","dueDate");
CREATE INDEX "PayableItem_businessId_supplierId_status_idx" ON "PayableItem"("businessId","supplierId","status");

CREATE TABLE "ReceivableAllocation" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "receivableItemId" TEXT NOT NULL, "financialTransactionId" TEXT NOT NULL,
 "journalEntryId" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "allocatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ReceivableAllocation_financialTransactionId_key" ON "ReceivableAllocation"("financialTransactionId");
CREATE UNIQUE INDEX "ReceivableAllocation_journalEntryId_key" ON "ReceivableAllocation"("journalEntryId");
CREATE INDEX "ReceivableAllocation_businessId_receivableItemId_allocatedAt_idx" ON "ReceivableAllocation"("businessId","receivableItemId","allocatedAt");

CREATE TABLE "PayableAllocation" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "payableItemId" TEXT NOT NULL, "financialTransactionId" TEXT NOT NULL,
 "journalEntryId" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "allocatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PayableAllocation_financialTransactionId_key" ON "PayableAllocation"("financialTransactionId");
CREATE UNIQUE INDEX "PayableAllocation_journalEntryId_key" ON "PayableAllocation"("journalEntryId");
CREATE INDEX "PayableAllocation_businessId_payableItemId_allocatedAt_idx" ON "PayableAllocation"("businessId","payableItemId","allocatedAt");

CREATE TABLE "PartyCredit" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "kind" "PartyCreditKind" NOT NULL,
 "customerId" TEXT, "supplierId" TEXT, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL,
 "documentNumber" TEXT NOT NULL, "originalAmount" DECIMAL(18,2) NOT NULL,
 "appliedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "status" "PartyCreditStatus" NOT NULL DEFAULT 'AVAILABLE',
 "occurredAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PartyCredit_businessId_sourceType_sourceId_key" ON "PartyCredit"("businessId","sourceType","sourceId");
CREATE INDEX "PartyCredit_businessId_kind_status_occurredAt_idx" ON "PartyCredit"("businessId","kind","status","occurredAt");
CREATE INDEX "PartyCredit_businessId_customerId_status_idx" ON "PartyCredit"("businessId","customerId","status");
CREATE INDEX "PartyCredit_businessId_supplierId_status_idx" ON "PartyCredit"("businessId","supplierId","status");

CREATE TABLE "PartyCreditApplication" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "partyCreditId" TEXT NOT NULL,
 "receivableItemId" TEXT, "payableItemId" TEXT, "journalEntryId" TEXT NOT NULL,
 "amount" DECIMAL(18,2) NOT NULL, "appliedAt" TIMESTAMP(3) NOT NULL,
 "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PartyCreditApplication_journalEntryId_key" ON "PartyCreditApplication"("journalEntryId");
CREATE UNIQUE INDEX "PartyCreditApplication_businessId_sourceType_sourceId_key" ON "PartyCreditApplication"("businessId","sourceType","sourceId");
CREATE INDEX "PartyCreditApplication_businessId_partyCreditId_appliedAt_idx" ON "PartyCreditApplication"("businessId","partyCreditId","appliedAt");
CREATE INDEX "PartyCreditApplication_businessId_receivableItemId_idx" ON "PartyCreditApplication"("businessId","receivableItemId");
CREATE INDEX "PartyCreditApplication_businessId_payableItemId_idx" ON "PartyCreditApplication"("businessId","payableItemId");

CREATE TABLE "InventoryCostState" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "productId" TEXT NOT NULL,
 "quantity" DECIMAL(18,3) NOT NULL DEFAULT 0, "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "averageUnitCost" DECIMAL(18,6) NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "InventoryCostState_businessId_warehouseId_productId_key" ON "InventoryCostState"("businessId","warehouseId","productId");
CREATE INDEX "InventoryCostState_businessId_productId_idx" ON "InventoryCostState"("businessId","productId");

CREATE TABLE "InventoryCostMovement" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "productId" TEXT NOT NULL, "stockMovementId" TEXT NOT NULL,
 "quantityDelta" DECIMAL(18,3) NOT NULL, "unitCost" DECIMAL(18,6) NOT NULL, "totalCostDelta" DECIMAL(18,2) NOT NULL,
 "costBefore" DECIMAL(18,2) NOT NULL, "costAfter" DECIMAL(18,2) NOT NULL, "averageBefore" DECIMAL(18,6) NOT NULL,
 "averageAfter" DECIMAL(18,6) NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InventoryCostMovement_stockMovementId_key" ON "InventoryCostMovement"("stockMovementId");
CREATE INDEX "InventoryCostMovement_businessId_warehouseId_productId_createdAt_idx" ON "InventoryCostMovement"("businessId","warehouseId","productId","createdAt");
CREATE INDEX "InventoryCostMovement_businessId_sourceType_sourceId_idx" ON "InventoryCostMovement"("businessId","sourceType","sourceId");

ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableItem" ADD CONSTRAINT "ReceivableItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableItem" ADD CONSTRAINT "ReceivableItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableItem" ADD CONSTRAINT "ReceivableItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableItem" ADD CONSTRAINT "PayableItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableItem" ADD CONSTRAINT "PayableItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableItem" ADD CONSTRAINT "PayableItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableAllocation" ADD CONSTRAINT "ReceivableAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableAllocation" ADD CONSTRAINT "ReceivableAllocation_receivableItemId_fkey" FOREIGN KEY ("receivableItemId") REFERENCES "ReceivableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableAllocation" ADD CONSTRAINT "ReceivableAllocation_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableAllocation" ADD CONSTRAINT "ReceivableAllocation_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableAllocation" ADD CONSTRAINT "PayableAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableAllocation" ADD CONSTRAINT "PayableAllocation_payableItemId_fkey" FOREIGN KEY ("payableItemId") REFERENCES "PayableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableAllocation" ADD CONSTRAINT "PayableAllocation_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableAllocation" ADD CONSTRAINT "PayableAllocation_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCredit" ADD CONSTRAINT "PartyCredit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCredit" ADD CONSTRAINT "PartyCredit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCredit" ADD CONSTRAINT "PartyCredit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCreditApplication" ADD CONSTRAINT "PartyCreditApplication_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCreditApplication" ADD CONSTRAINT "PartyCreditApplication_partyCreditId_fkey" FOREIGN KEY ("partyCreditId") REFERENCES "PartyCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCreditApplication" ADD CONSTRAINT "PartyCreditApplication_receivableItemId_fkey" FOREIGN KEY ("receivableItemId") REFERENCES "ReceivableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCreditApplication" ADD CONSTRAINT "PartyCreditApplication_payableItemId_fkey" FOREIGN KEY ("payableItemId") REFERENCES "PayableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCreditApplication" ADD CONSTRAINT "PartyCreditApplication_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostState" ADD CONSTRAINT "InventoryCostState_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostState" ADD CONSTRAINT "InventoryCostState_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostState" ADD CONSTRAINT "InventoryCostState_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostMovement" ADD CONSTRAINT "InventoryCostMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostMovement" ADD CONSTRAINT "InventoryCostMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostMovement" ADD CONSTRAINT "InventoryCostMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostMovement" ADD CONSTRAINT "InventoryCostMovement_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
