CREATE TYPE "CustomerType" AS ENUM ('RETAIL', 'WHOLESALE', 'DEALER', 'CORPORATE', 'OTHER');

CREATE TABLE "BusinessSequence" (
  "businessId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BusinessSequence_pkey" PRIMARY KEY ("businessId", "key")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "customerCode" TEXT NOT NULL,
  "name" TEXT NOT NULL, "companyName" TEXT, "customerType" "CustomerType" NOT NULL DEFAULT 'RETAIL',
  "phone" TEXT NOT NULL, "alternatePhone" TEXT, "email" TEXT,
  "addressLine1" TEXT, "addressLine2" TEXT, "area" TEXT, "city" TEXT, "district" TEXT,
  "postalCode" TEXT, "country" TEXT NOT NULL DEFAULT 'Bangladesh', "taxId" TEXT, "binNumber" TEXT,
  "creditLimit" DECIMAL(18,2), "notes" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "supplierCode" TEXT NOT NULL,
  "name" TEXT NOT NULL, "companyName" TEXT, "contactPerson" TEXT, "phone" TEXT NOT NULL,
  "alternatePhone" TEXT, "email" TEXT, "addressLine1" TEXT, "addressLine2" TEXT,
  "area" TEXT, "city" TEXT, "district" TEXT, "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'Bangladesh', "taxId" TEXT, "binNumber" TEXT,
  "notes" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_businessId_customerCode_key" ON "Customer"("businessId", "customerCode");
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");
CREATE INDEX "Customer_businessId_phone_idx" ON "Customer"("businessId", "phone");
CREATE INDEX "Customer_businessId_isActive_idx" ON "Customer"("businessId", "isActive");
CREATE UNIQUE INDEX "Supplier_businessId_supplierCode_key" ON "Supplier"("businessId", "supplierCode");
CREATE INDEX "Supplier_businessId_idx" ON "Supplier"("businessId");
CREATE INDEX "Supplier_businessId_name_idx" ON "Supplier"("businessId", "name");
CREATE INDEX "Supplier_businessId_phone_idx" ON "Supplier"("businessId", "phone");
CREATE INDEX "Supplier_businessId_isActive_idx" ON "Supplier"("businessId", "isActive");

ALTER TABLE "BusinessSequence" ADD CONSTRAINT "BusinessSequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
