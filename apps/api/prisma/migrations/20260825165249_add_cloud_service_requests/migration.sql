-- CreateTable
CREATE TABLE "cloud_service_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "service" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cloud_service_requests_status_createdAt_idx" ON "cloud_service_requests"("status", "createdAt");
