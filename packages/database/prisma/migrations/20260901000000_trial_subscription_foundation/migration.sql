CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

CREATE TABLE "BusinessSubscription" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "planCode" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "trialStartedAt" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessSubscription_businessId_key" ON "BusinessSubscription"("businessId");
CREATE INDEX "BusinessSubscription_status_trialEndsAt_idx" ON "BusinessSubscription"("status", "trialEndsAt");
ALTER TABLE "BusinessSubscription" ADD CONSTRAINT "BusinessSubscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BusinessSubscription" ("id", "businessId", "status", "trialStartedAt", "trialEndsAt", "createdAt", "updatedAt")
SELECT concat('sub_', md5(random()::text || clock_timestamp()::text || "id")), "id", 'TRIALING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business"
ON CONFLICT ("businessId") DO NOTHING;
