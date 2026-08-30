-- STEP 6 Warranty + RMA. Created locally; intentionally not applied by this change.
CREATE TYPE "RmaStatus" AS ENUM ('RECEIVED','INSPECTING','APPROVED','REJECTED','SENT_TO_SUPPLIER','SUPPLIER_PROCESSING','SUPPLIER_RETURNED','READY_FOR_CUSTOMER','DELIVERED','CANCELLED');
CREATE TYPE "RmaIssue" AS ENUM ('NOT_POWERING_ON','DISPLAY_ISSUE','BATTERY_ISSUE','CHARGING_ISSUE','HARDWARE_FAILURE','SOFTWARE_ISSUE','PHYSICAL_DAMAGE','OTHER');
CREATE TYPE "RmaCondition" AS ENUM ('GOOD','SCRATCHED','DENTED','BROKEN','LIQUID_DAMAGE','OTHER');
CREATE TYPE "WarrantyDecision" AS ENUM ('WARRANTY_APPROVED','WARRANTY_REJECTED','OUT_OF_WARRANTY','CUSTOMER_DAMAGE','PAID_SERVICE_REQUIRED');
CREATE TYPE "RmaOutcome" AS ENUM ('REPAIRED','REPLACED','REJECTED','NO_FAULT_FOUND','CUSTOMER_DAMAGE','UNREPAIRABLE');

CREATE TABLE "Rma" (
 "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "rmaNumber" TEXT NOT NULL, "publicToken" TEXT NOT NULL,
 "saleId" TEXT NOT NULL, "saleLineId" TEXT NOT NULL, "productId" TEXT NOT NULL, "serialItemId" TEXT,
 "replacementSerialItemId" TEXT, "customerId" TEXT, "supplierId" TEXT, "quantity" DECIMAL(18,3) NOT NULL DEFAULT 1,
 "status" "RmaStatus" NOT NULL DEFAULT 'RECEIVED', "issue" "RmaIssue" NOT NULL, "issueDescription" TEXT NOT NULL,
 "physicalCondition" "RmaCondition" NOT NULL, "conditionNote" TEXT, "accessories" TEXT[] NOT NULL,
 "accessoriesNote" TEXT, "customerNotes" TEXT, "internalNotes" TEXT, "warrantyEligible" BOOLEAN NOT NULL,
 "warrantyReason" TEXT NOT NULL, "warrantyStart" TIMESTAMP(3), "warrantyEnd" TIMESTAMP(3),
 "warrantyDecision" "WarrantyDecision", "outcome" "RmaOutcome", "supplierReference" TEXT, "courierReference" TEXT,
 "sentToSupplierAt" TIMESTAMP(3), "receivedFromSupplierAt" TIMESTAMP(3),
 "courierCost" DECIMAL(18,2) NOT NULL DEFAULT 0, "supplierServiceCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "otherOperationalCost" DECIMAL(18,2) NOT NULL DEFAULT 0, "estimatedCustomerCharge" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "createdById" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "deliveredAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Rma_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RmaHistory" (
 "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "rmaId" TEXT NOT NULL, "fromStatus" "RmaStatus",
 "toStatus" "RmaStatus" NOT NULL, "action" TEXT NOT NULL, "note" TEXT, "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RmaHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rma_publicToken_key" ON "Rma"("publicToken");
CREATE UNIQUE INDEX "Rma_businessId_rmaNumber_key" ON "Rma"("businessId","rmaNumber");
CREATE INDEX "Rma_businessId_status_receivedAt_idx" ON "Rma"("businessId","status","receivedAt");
CREATE INDEX "Rma_businessId_serialItemId_idx" ON "Rma"("businessId","serialItemId");
CREATE INDEX "Rma_businessId_saleId_idx" ON "Rma"("businessId","saleId");
CREATE INDEX "Rma_businessId_supplierId_idx" ON "Rma"("businessId","supplierId");
CREATE INDEX "RmaHistory_businessId_rmaId_createdAt_idx" ON "RmaHistory"("businessId","rmaId","createdAt");
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "SerialItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_replacementSerialItemId_fkey" FOREIGN KEY ("replacementSerialItemId") REFERENCES "SerialItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RmaHistory" ADD CONSTRAINT "RmaHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RmaHistory" ADD CONSTRAINT "RmaHistory_rmaId_fkey" FOREIGN KEY ("rmaId") REFERENCES "Rma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RmaHistory" ADD CONSTRAINT "RmaHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
