CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT','POSTED','CANCELLED');
CREATE TYPE "PurchaseReturnReason" AS ENUM ('WRONG_ITEM','DAMAGED','SUPPLIER_REQUEST','EXCESS_STOCK','OTHER');
CREATE TYPE "SaleReturnReason" AS ENUM ('CUSTOMER_RETURN','DEFECTIVE','WRONG_ITEM','EXCHANGE','OTHER');
ALTER TYPE "SerialStatus" ADD VALUE 'RETURNED_TO_SUPPLIER';

CREATE TABLE "PurchaseReturn" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "returnNumber" TEXT NOT NULL,
 "purchaseId" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL,
 "returnDate" TIMESTAMP(3) NOT NULL, "reason" "PurchaseReturnReason" NOT NULL, "note" TEXT,
 "subtotal" DECIMAL(18,2) NOT NULL, "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "grandTotal" DECIMAL(18,2) NOT NULL,
 "status" "ReturnStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
 "createdById" TEXT NOT NULL, "postedById" TEXT, "postedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PurchaseReturnLine" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "purchaseReturnId" TEXT NOT NULL,
 "purchaseLineId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" DECIMAL(18,3) NOT NULL,
 "unitCost" DECIMAL(18,2) NOT NULL, "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "lineTotal" DECIMAL(18,2) NOT NULL,
 "serialNumbers" TEXT[] NOT NULL
);
CREATE TABLE "SaleReturn" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "returnNumber" TEXT NOT NULL,
 "saleId" TEXT NOT NULL, "customerId" TEXT, "warehouseId" TEXT NOT NULL,
 "returnDate" TIMESTAMP(3) NOT NULL, "reason" "SaleReturnReason" NOT NULL, "note" TEXT,
 "subtotal" DECIMAL(18,2) NOT NULL, "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "grandTotal" DECIMAL(18,2) NOT NULL,
 "status" "ReturnStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
 "createdById" TEXT NOT NULL, "postedById" TEXT, "postedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "SaleReturnLine" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "saleReturnId" TEXT NOT NULL,
 "saleLineId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" DECIMAL(18,3) NOT NULL,
 "unitPrice" DECIMAL(18,2) NOT NULL, "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "lineTotal" DECIMAL(18,2) NOT NULL,
 "serialNumbers" TEXT[] NOT NULL
);
CREATE TABLE "SerialHistory" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "serialItemId" TEXT NOT NULL,
 "eventType" TEXT NOT NULL, "referenceType" TEXT NOT NULL, "referenceId" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PurchaseReturn_businessId_returnNumber_key" ON "PurchaseReturn"("businessId","returnNumber");
CREATE UNIQUE INDEX "PurchaseReturnLine_purchaseReturnId_purchaseLineId_key" ON "PurchaseReturnLine"("purchaseReturnId","purchaseLineId");
CREATE UNIQUE INDEX "SaleReturn_businessId_returnNumber_key" ON "SaleReturn"("businessId","returnNumber");
CREATE UNIQUE INDEX "SaleReturnLine_saleReturnId_saleLineId_key" ON "SaleReturnLine"("saleReturnId","saleLineId");
CREATE INDEX "PurchaseReturn_businessId_purchaseId_idx" ON "PurchaseReturn"("businessId","purchaseId");
CREATE INDEX "PurchaseReturn_businessId_status_idx" ON "PurchaseReturn"("businessId","status");
CREATE INDEX "PurchaseReturnLine_businessId_productId_idx" ON "PurchaseReturnLine"("businessId","productId");
CREATE INDEX "SaleReturn_businessId_saleId_idx" ON "SaleReturn"("businessId","saleId");
CREATE INDEX "SaleReturn_businessId_status_idx" ON "SaleReturn"("businessId","status");
CREATE INDEX "SaleReturnLine_businessId_productId_idx" ON "SaleReturnLine"("businessId","productId");
CREATE INDEX "SerialHistory_businessId_serialItemId_occurredAt_idx" ON "SerialHistory"("businessId","serialItemId","occurredAt");
CREATE INDEX "SerialHistory_referenceType_referenceId_idx" ON "SerialHistory"("referenceType","referenceId");
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE;
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseLine"("id") ON DELETE RESTRICT;
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE;
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "SerialHistory" ADD CONSTRAINT "SerialHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT;
ALTER TABLE "SerialHistory" ADD CONSTRAINT "SerialHistory_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "SerialItem"("id") ON DELETE RESTRICT;
