CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

CREATE TABLE "Purchase" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "purchaseNumber" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "supplierInvoiceNumber" TEXT,
  "reference" TEXT, "purchaseDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3),
  "subtotal" DECIMAL(18,2) NOT NULL, "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "additionalCost" DECIMAL(18,2) NOT NULL DEFAULT 0, "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(18,2) NOT NULL, "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "dueAmount" DECIMAL(18,2) NOT NULL, "note" TEXT, "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL, "postedById" TEXT, "postedAt" TIMESTAMP(3),
  "cancelledById" TEXT, "cancelledAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseLine" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "purchaseId" TEXT NOT NULL, "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL, "unitCost" DECIMAL(18,2) NOT NULL,
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(18,2) NOT NULL, "warrantyDuration" INTEGER, "warrantyUnit" "WarrantyUnit",
  "serialNumbers" TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Purchase_businessId_purchaseNumber_key" ON "Purchase"("businessId","purchaseNumber");
CREATE INDEX "Purchase_businessId_status_idx" ON "Purchase"("businessId","status");
CREATE INDEX "Purchase_businessId_supplierId_idx" ON "Purchase"("businessId","supplierId");
CREATE INDEX "Purchase_businessId_warehouseId_idx" ON "Purchase"("businessId","warehouseId");
CREATE INDEX "Purchase_businessId_purchaseDate_idx" ON "Purchase"("businessId","purchaseDate");
CREATE UNIQUE INDEX "PurchaseLine_purchaseId_productId_key" ON "PurchaseLine"("purchaseId","productId");
CREATE INDEX "PurchaseLine_businessId_productId_idx" ON "PurchaseLine"("businessId","productId");
CREATE INDEX "PurchaseLine_businessId_purchaseId_idx" ON "PurchaseLine"("businessId","purchaseId");
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SerialItem" ADD CONSTRAINT "SerialItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
