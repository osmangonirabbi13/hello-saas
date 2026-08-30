-- STEP 7 Service Management and Quotation. Created locally; intentionally unapplied.
CREATE TYPE "ServiceStatus" AS ENUM ('RECEIVED','DIAGNOSING','WAITING_FOR_APPROVAL','IN_PROGRESS','WAITING_FOR_PARTS','READY_FOR_DELIVERY','DELIVERED','CANCELLED');
CREATE TYPE "ServiceType" AS ENUM ('REPAIR','DIAGNOSTIC','INSTALLATION','SOFTWARE','HARDWARE','MAINTENANCE','OTHER');
CREATE TYPE "ServicePriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE "ServiceApprovalStatus" AS ENUM ('NOT_REQUIRED','PENDING','APPROVED','REJECTED');
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CONVERTED','CANCELLED');
CREATE TABLE "ServiceJob" (
 "id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"serviceNumber" TEXT NOT NULL,"customerId" TEXT,"productId" TEXT,"serialItemId" TEXT,"assigneeId" TEXT,"deliveredById" TEXT,
 "type" "ServiceType" NOT NULL,"typeDescription" TEXT,"priority" "ServicePriority" NOT NULL DEFAULT 'NORMAL',"status" "ServiceStatus" NOT NULL DEFAULT 'RECEIVED',"approvalStatus" "ServiceApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
 "deviceName" TEXT NOT NULL,"deviceBrand" TEXT,"deviceModel" TEXT,"externalSerialNumber" TEXT,"color" TEXT,"condition" "RmaCondition" NOT NULL,"conditionNote" TEXT,"accessories" TEXT[] NOT NULL,"accessoriesNote" TEXT,
 "customerComplaint" TEXT NOT NULL,"diagnosis" TEXT,"recommendedWork" TEXT,"workPerformed" TEXT,
 "estimatedServiceCharge" DECIMAL(18,2) NOT NULL DEFAULT 0,"estimatedPartsCost" DECIMAL(18,2) NOT NULL DEFAULT 0,"serviceCharge" DECIMAL(18,2) NOT NULL DEFAULT 0,"partsCharge" DECIMAL(18,2) NOT NULL DEFAULT 0,"discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,"taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,"grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "estimatedCompletionAt" TIMESTAMP(3),"receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"deliveredAt" TIMESTAMP(3),"cancelledAt" TIMESTAMP(3),"createdById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"version" INTEGER NOT NULL DEFAULT 1,CONSTRAINT "ServiceJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServicePart" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"serviceJobId" TEXT NOT NULL,"productId" TEXT,"description" TEXT NOT NULL,"quantity" DECIMAL(18,3) NOT NULL,"unitPrice" DECIMAL(18,2) NOT NULL,"lineTotal" DECIMAL(18,2) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ServicePart_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ServiceHistory" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"serviceJobId" TEXT NOT NULL,"fromStatus" "ServiceStatus","toStatus" "ServiceStatus" NOT NULL,"action" TEXT NOT NULL,"note" TEXT,"actorUserId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ServiceHistory_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Quotation" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"quotationNumber" TEXT NOT NULL,"customerId" TEXT,"prospectName" TEXT,"prospectPhone" TEXT,"quotationDate" TIMESTAMP(3) NOT NULL,"validUntil" TIMESTAMP(3) NOT NULL,"reference" TEXT,"status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',"subtotal" DECIMAL(18,2) NOT NULL,"discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,"taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,"grandTotal" DECIMAL(18,2) NOT NULL,"customerNote" TEXT,"internalNote" TEXT,"terms" TEXT,"convertedSaleId" TEXT,"createdById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"version" INTEGER NOT NULL DEFAULT 1,CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id"));
CREATE TABLE "QuotationLine" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"quotationId" TEXT NOT NULL,"productId" TEXT NOT NULL,"description" TEXT,"quantity" DECIMAL(18,3) NOT NULL,"unitPrice" DECIMAL(18,2) NOT NULL,"discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,"taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,"lineTotal" DECIMAL(18,2) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id"));
CREATE TABLE "QuotationHistory" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"quotationId" TEXT NOT NULL,"fromStatus" "QuotationStatus","toStatus" "QuotationStatus" NOT NULL,"action" TEXT NOT NULL,"note" TEXT,"actorUserId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "QuotationHistory_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ServiceJob_businessId_serviceNumber_key" ON "ServiceJob"("businessId","serviceNumber");
CREATE INDEX "ServiceJob_businessId_status_receivedAt_idx" ON "ServiceJob"("businessId","status","receivedAt");
CREATE INDEX "ServiceJob_businessId_customerId_idx" ON "ServiceJob"("businessId","customerId");
CREATE INDEX "ServiceJob_businessId_serialItemId_idx" ON "ServiceJob"("businessId","serialItemId");
CREATE INDEX "ServiceJob_businessId_assigneeId_idx" ON "ServiceJob"("businessId","assigneeId");
CREATE INDEX "ServicePart_businessId_serviceJobId_idx" ON "ServicePart"("businessId","serviceJobId");
CREATE INDEX "ServicePart_businessId_productId_idx" ON "ServicePart"("businessId","productId");
CREATE INDEX "ServiceHistory_businessId_serviceJobId_createdAt_idx" ON "ServiceHistory"("businessId","serviceJobId","createdAt");
CREATE UNIQUE INDEX "Quotation_convertedSaleId_key" ON "Quotation"("convertedSaleId");
CREATE UNIQUE INDEX "Quotation_businessId_quotationNumber_key" ON "Quotation"("businessId","quotationNumber");
CREATE INDEX "Quotation_businessId_status_quotationDate_idx" ON "Quotation"("businessId","status","quotationDate");
CREATE INDEX "Quotation_businessId_customerId_idx" ON "Quotation"("businessId","customerId");
CREATE INDEX "Quotation_businessId_validUntil_idx" ON "Quotation"("businessId","validUntil");
CREATE UNIQUE INDEX "QuotationLine_quotationId_productId_key" ON "QuotationLine"("quotationId","productId");
CREATE INDEX "QuotationLine_businessId_productId_idx" ON "QuotationLine"("businessId","productId");
CREATE INDEX "QuotationHistory_businessId_quotationId_createdAt_idx" ON "QuotationHistory"("businessId","quotationId","createdAt");
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "SerialItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePart" ADD CONSTRAINT "ServicePart_serviceJobId_fkey" FOREIGN KEY ("serviceJobId") REFERENCES "ServiceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePart" ADD CONSTRAINT "ServicePart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceHistory" ADD CONSTRAINT "ServiceHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceHistory" ADD CONSTRAINT "ServiceHistory_serviceJobId_fkey" FOREIGN KEY ("serviceJobId") REFERENCES "ServiceJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceHistory" ADD CONSTRAINT "ServiceHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_convertedSaleId_fkey" FOREIGN KEY ("convertedSaleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationHistory" ADD CONSTRAINT "QuotationHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationHistory" ADD CONSTRAINT "QuotationHistory_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationHistory" ADD CONSTRAINT "QuotationHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
