CREATE TYPE "SaleType" AS ENUM ('REGULAR', 'VAT', 'POS');
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "type" "SaleType" NOT NULL DEFAULT 'REGULAR',
    "saleDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "reference" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "additionalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dueAmount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "warrantyDuration" INTEGER,
    "warrantyUnit" "WarrantyUnit",
    "serialNumbers" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sale_businessId_saleNumber_key" ON "Sale"("businessId", "saleNumber");
CREATE UNIQUE INDEX "Sale_businessId_invoiceNumber_key" ON "Sale"("businessId", "invoiceNumber");
CREATE INDEX "Sale_businessId_status_idx" ON "Sale"("businessId", "status");
CREATE INDEX "Sale_businessId_type_idx" ON "Sale"("businessId", "type");
CREATE INDEX "Sale_businessId_customerId_idx" ON "Sale"("businessId", "customerId");
CREATE INDEX "Sale_businessId_warehouseId_idx" ON "Sale"("businessId", "warehouseId");
CREATE INDEX "Sale_businessId_saleDate_idx" ON "Sale"("businessId", "saleDate");
CREATE INDEX "Sale_businessId_createdAt_idx" ON "Sale"("businessId", "createdAt");
CREATE UNIQUE INDEX "SaleLine_saleId_productId_key" ON "SaleLine"("saleId", "productId");
CREATE INDEX "SaleLine_businessId_productId_idx" ON "SaleLine"("businessId", "productId");
CREATE INDEX "SaleLine_businessId_saleId_idx" ON "SaleLine"("businessId", "saleId");
CREATE UNIQUE INDEX "Invoice_saleId_key" ON "Invoice"("saleId");
CREATE UNIQUE INDEX "Invoice_businessId_invoiceNumber_key" ON "Invoice"("businessId", "invoiceNumber");
CREATE INDEX "Invoice_businessId_issuedAt_idx" ON "Invoice"("businessId", "issuedAt");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SerialItem" ADD CONSTRAINT "SerialItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SerialItem" ADD CONSTRAINT "SerialItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
