-- AlterTable
ALTER TABLE "esims" ADD COLUMN     "alertedThresholds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "expiryAlerted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "initialBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "remainingBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "usageUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "usage_snapshots" (
    "id" TEXT NOT NULL,
    "esimId" TEXT NOT NULL,
    "remainingBytes" BIGINT NOT NULL,
    "pctUsed" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'poll',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB,
    "state" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_snapshots_esimId_capturedAt_idx" ON "usage_snapshots"("esimId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "notification_logs_userId_createdAt_idx" ON "notification_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "usage_snapshots" ADD CONSTRAINT "usage_snapshots_esimId_fkey" FOREIGN KEY ("esimId") REFERENCES "esims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
