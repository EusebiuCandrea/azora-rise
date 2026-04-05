-- CreateEnum
CREATE TYPE "CampaignReportType" AS ENUM ('DAILY_DIGEST', 'CAMPAIGN_DEEP', 'VIDEO_BRIEF');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'FREQUENCY_HIGH';
ALTER TYPE "AlertType" ADD VALUE 'LANDING_PAGE_DROP';
ALTER TYPE "AlertType" ADD VALUE 'NO_ADD_TO_CART';
ALTER TYPE "AlertType" ADD VALUE 'HOOK_RATE_LOW';

-- AlterTable
ALTER TABLE "AdMetrics" ADD COLUMN     "addToCart" INTEGER,
ADD COLUMN     "frequency" DOUBLE PRECISION,
ADD COLUMN     "initiateCheckout" INTEGER,
ADD COLUMN     "landingPageViews" INTEGER,
ADD COLUMN     "purchaseValue" DOUBLE PRECISION,
ADD COLUMN     "reach" INTEGER,
ADD COLUMN     "videoAvgWatchTimeSec" DOUBLE PRECISION,
ADD COLUMN     "videoP25" INTEGER,
ADD COLUMN     "videoP50" INTEGER,
ADD COLUMN     "videoP75" INTEGER,
ADD COLUMN     "videoP95" INTEGER,
ADD COLUMN     "videoPlays" INTEGER,
ADD COLUMN     "videoThruPlays" INTEGER;

-- AlterTable
ALTER TABLE "AdSetMetrics" ADD COLUMN     "addToCart" INTEGER,
ADD COLUMN     "frequency" DOUBLE PRECISION,
ADD COLUMN     "initiateCheckout" INTEGER,
ADD COLUMN     "landingPageViews" INTEGER,
ADD COLUMN     "purchaseValue" DOUBLE PRECISION,
ADD COLUMN     "reach" INTEGER,
ADD COLUMN     "videoAvgWatchTimeSec" DOUBLE PRECISION,
ADD COLUMN     "videoP25" INTEGER,
ADD COLUMN     "videoP50" INTEGER,
ADD COLUMN     "videoP75" INTEGER,
ADD COLUMN     "videoP95" INTEGER,
ADD COLUMN     "videoPlays" INTEGER,
ADD COLUMN     "videoThruPlays" INTEGER;

-- AlterTable
ALTER TABLE "CampaignMetrics" ADD COLUMN     "addToCart" INTEGER,
ADD COLUMN     "frequency" DOUBLE PRECISION,
ADD COLUMN     "initiateCheckout" INTEGER,
ADD COLUMN     "landingPageViews" INTEGER,
ADD COLUMN     "purchaseValue" DOUBLE PRECISION,
ADD COLUMN     "reach" INTEGER,
ADD COLUMN     "videoAvgWatchTimeSec" DOUBLE PRECISION,
ADD COLUMN     "videoP25" INTEGER,
ADD COLUMN     "videoP50" INTEGER,
ADD COLUMN     "videoP75" INTEGER,
ADD COLUMN     "videoP95" INTEGER,
ADD COLUMN     "videoPlays" INTEGER,
ADD COLUMN     "videoThruPlays" INTEGER;

-- CreateTable
CREATE TABLE "CampaignAIReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "reportType" "CampaignReportType" NOT NULL,
    "healthScore" INTEGER,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "problems" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "videoBrief" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelUsed" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',

    CONSTRAINT "CampaignAIReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignAIReport_organizationId_reportType_generatedAt_idx" ON "CampaignAIReport"("organizationId", "reportType", "generatedAt");

-- CreateIndex
CREATE INDEX "CampaignAIReport_campaignId_idx" ON "CampaignAIReport"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMetrics_campaignId_idx" ON "CampaignMetrics"("campaignId");

-- AddForeignKey
ALTER TABLE "CampaignAIReport" ADD CONSTRAINT "CampaignAIReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAIReport" ADD CONSTRAINT "CampaignAIReport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
