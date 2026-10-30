-- Additive migration: retain all historical orders/credentials and amounts.
ALTER TABLE "orders" ADD COLUMN "requestHash" TEXT, ADD COLUMN "startDate" TEXT, ADD COLUMN "endDate" TEXT,
  ADD COLUMN "supplierDestination" TEXT, ADD COLUMN "supplierMode" TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN "unlimited" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accessToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "payments" ADD COLUMN "expectedAmount" INTEGER,
  ADD COLUMN "chargeCurrency" TEXT NOT NULL DEFAULT 'KES',
  ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'legacy', ADD COLUMN "checkoutUrl" TEXT;
ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'paystack';
DROP INDEX IF EXISTS "esims_orderId_key";
CREATE INDEX "esims_orderId_idx" ON "esims"("orderId");
ALTER TABLE "esims" ADD COLUMN "unlimited" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supplierMode" TEXT NOT NULL DEFAULT 'mock';
CREATE TABLE "fulfilments" (
  "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "index" INTEGER NOT NULL, "reference" TEXT NOT NULL UNIQUE,
  "state" TEXT NOT NULL DEFAULT 'READY', "sentAt" TIMESTAMP(3),
  "purchaseId" TEXT UNIQUE, "esimId" TEXT REFERENCES "esims"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "remainingBytes" BIGINT NOT NULL DEFAULT 0, "initialBytes" BIGINT NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "error" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("orderId", "index")
);
CREATE INDEX "fulfilments_state_updatedAt_idx" ON "fulfilments"("state", "updatedAt");
-- Unknown historical supplier modes stay mock: never reprocess historical tests live.
-- Existing settled orders need no new billable attempt records.
ALTER TABLE "payments" ADD COLUMN "emailSentAt" TIMESTAMP(3), ADD COLUMN "emailAttemptAt" TIMESTAMP(3);
ALTER TABLE "esims" ADD COLUMN "emailSentAt" TIMESTAMP(3), ADD COLUMN "emailAttemptAt" TIMESTAMP(3);
ALTER TABLE "webhook_events" ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "webhook_events_source_processedAt_nextAttemptAt_idx" ON "webhook_events"("source", "processedAt", "nextAttemptAt");
