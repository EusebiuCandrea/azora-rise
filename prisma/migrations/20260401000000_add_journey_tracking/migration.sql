-- CreateEnum
CREATE TYPE "JourneyAlertType" AS ENUM ('FORM_ABANDON_SPIKE', 'LOW_SCROLL_RATE', 'AD_CLICK_DROP', 'CONVERSION_DROP');

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "adSource" TEXT,
    "event" TEXT NOT NULL,
    "productId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneySession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "adSource" TEXT,
    "campaignId" TEXT,
    "productId" TEXT,
    "reachedProductView" TIMESTAMP(3),
    "reachedScrollToForm" TIMESTAMP(3),
    "reachedFormStart" TIMESTAMP(3),
    "reachedFormSubmit" TIMESTAMP(3),
    "reachedOrderConfirmed" TIMESTAMP(3),
    "orderId" TEXT,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JourneySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneySnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalAdClicks" INTEGER NOT NULL DEFAULT 0,
    "totalProductViews" INTEGER NOT NULL DEFAULT 0,
    "totalScrollToForm" INTEGER NOT NULL DEFAULT 0,
    "totalFormStarts" INTEGER NOT NULL DEFAULT 0,
    "totalFormSubmits" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "ctrAd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateVisitToScroll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateScrollToStart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateStartToSubmit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateSubmitToOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallConversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReturns" INTEGER NOT NULL DEFAULT 0,
    "totalUndelivered" INTEGER NOT NULL DEFAULT 0,
    "returnRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "undeliveredRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productBreakdown" JSONB NOT NULL,
    "campaignBreakdown" JSONB NOT NULL,
    "ga4Data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JourneySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyAIReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "problems" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "quickWins" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelUsed" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    CONSTRAINT "JourneyAIReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "JourneyAlertType" NOT NULL,
    "severity" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "baselineValue" DOUBLE PRECISION NOT NULL,
    "deltaPercent" DOUBLE PRECISION NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JourneyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingEvent_organizationId_event_createdAt_idx" ON "TrackingEvent"("organizationId", "event", "createdAt");
CREATE INDEX "TrackingEvent_sessionId_organizationId_idx" ON "TrackingEvent"("sessionId", "organizationId");
CREATE INDEX "TrackingEvent_organizationId_createdAt_idx" ON "TrackingEvent"("organizationId", "createdAt");
CREATE UNIQUE INDEX "JourneySession_sessionId_key" ON "JourneySession"("sessionId");
CREATE INDEX "JourneySession_organizationId_createdAt_idx" ON "JourneySession"("organizationId", "createdAt");
CREATE INDEX "JourneySession_organizationId_campaignId_idx" ON "JourneySession"("organizationId", "campaignId");
CREATE INDEX "JourneySession_organizationId_productId_idx" ON "JourneySession"("organizationId", "productId");
CREATE UNIQUE INDEX "JourneySnapshot_organizationId_date_periodDays_key" ON "JourneySnapshot"("organizationId", "date", "periodDays");
CREATE INDEX "JourneySnapshot_organizationId_date_idx" ON "JourneySnapshot"("organizationId", "date");
CREATE UNIQUE INDEX "JourneyAIReport_snapshotId_key" ON "JourneyAIReport"("snapshotId");
CREATE INDEX "JourneyAIReport_snapshotId_idx" ON "JourneyAIReport"("snapshotId");
CREATE INDEX "JourneyAIReport_organizationId_generatedAt_idx" ON "JourneyAIReport"("organizationId", "generatedAt");
CREATE INDEX "JourneyAlert_organizationId_resolvedAt_createdAt_idx" ON "JourneyAlert"("organizationId", "resolvedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JourneySession" ADD CONSTRAINT "JourneySession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JourneySnapshot" ADD CONSTRAINT "JourneySnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JourneyAIReport" ADD CONSTRAINT "JourneyAIReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JourneyAIReport" ADD CONSTRAINT "JourneyAIReport_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "JourneySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JourneyAlert" ADD CONSTRAINT "JourneyAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
