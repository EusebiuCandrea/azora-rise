-- SP3 / SP4 / SP5 Consolidated Migration
-- Safe to run on both fresh DBs and existing ones (IF NOT EXISTS throughout)

-- ─── New Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AlertType" AS ENUM ('ROAS_LOW', 'SPEND_EXCEEDED', 'CTR_LOW', 'CPM_HIGH', 'AUTO_PAUSED', 'LEARNING_PHASE', 'BUDGET_ENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'SALARY', 'COURIER', 'SOFTWARE', 'MARKETING_OTHER', 'ACCOUNTING', 'BANK_FEES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RecommendationType" AS ENUM ('SCALE_UP', 'MONITOR', 'REVIEW_COSTS', 'KILL_ADS', 'DEAD_STOCK', 'BREAK_EVEN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MappingType" AS ENUM ('MANUAL', 'UTM_AUTO', 'NAME_PATTERN', 'AI_SUGGESTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Organization — new columns (SP3 / SP5) ───────────────────────────────────

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "shippingCostDefault" DOUBLE PRECISION NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "isVatPayer" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "ordersLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ordersSyncCursor" TEXT,
  ADD COLUMN IF NOT EXISTS "eurToRonFixed" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "useFixedRate" BOOLEAN NOT NULL DEFAULT true;

-- ─── ShopifyConnection — new columns (SP3) ────────────────────────────────────

ALTER TABLE "ShopifyConnection"
  ADD COLUMN IF NOT EXISTS "ordersWebhookId" TEXT,
  ADD COLUMN IF NOT EXISTS "isOrdersSyncing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ordersLastSyncedAt" TIMESTAMP(3);

-- ─── Campaign — new column (SP4) ──────────────────────────────────────────────

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_metaCampaignId_key" ON "Campaign"("metaCampaignId");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- ─── ProductCost — remove old columns if still present ────────────────────────

ALTER TABLE "ProductCost"
  DROP COLUMN IF EXISTS "packagingCost",
  DROP COLUMN IF EXISTS "shippingCost";

-- ─── Order (SP3) ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "financialStatus" TEXT NOT NULL,
    "fulfillmentStatus" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "subtotalPrice" DOUBLE PRECISION NOT NULL,
    "totalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalShipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "processedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "shopifyData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_organizationId_shopifyOrderId_key" ON "Order"("organizationId", "shopifyOrderId");
CREATE INDEX IF NOT EXISTS "Order_organizationId_idx" ON "Order"("organizationId");
CREATE INDEX IF NOT EXISTS "Order_organizationId_processedAt_idx" ON "Order"("organizationId", "processedAt");
CREATE INDEX IF NOT EXISTS "Order_organizationId_financialStatus_idx" ON "Order"("organizationId", "financialStatus");

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_organizationId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── OrderItem (SP3) ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    "title" TEXT NOT NULL,
    "variantTitle" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_organizationId_idx" ON "OrderItem"("organizationId");
CREATE INDEX IF NOT EXISTS "OrderItem_organizationId_shopifyProductId_idx" ON "OrderItem"("organizationId", "shopifyProductId");

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── AdSet (SP4) ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "metaAdSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dailyBudget" DOUBLE PRECISION,
    "targeting" JSONB,
    "bidStrategy" TEXT,
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdSet_metaAdSetId_key" ON "AdSet"("metaAdSetId");
CREATE INDEX IF NOT EXISTS "AdSet_campaignId_idx" ON "AdSet"("campaignId");
CREATE INDEX IF NOT EXISTS "AdSet_organizationId_idx" ON "AdSet"("organizationId");

ALTER TABLE "AdSet" DROP CONSTRAINT IF EXISTS "AdSet_campaignId_fkey";
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Ad (SP4) ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Ad" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "creativeType" TEXT,
    "creativeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Ad_metaAdId_key" ON "Ad"("metaAdId");
CREATE INDEX IF NOT EXISTS "Ad_adSetId_idx" ON "Ad"("adSetId");
CREATE INDEX IF NOT EXISTS "Ad_organizationId_idx" ON "Ad"("organizationId");

ALTER TABLE "Ad" DROP CONSTRAINT IF EXISTS "Ad_adSetId_fkey";
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey"
  FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AdSetMetrics (SP4) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdSetMetrics" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION,
    "cpm" DOUBLE PRECISION,
    "ctr" DOUBLE PRECISION,
    CONSTRAINT "AdSetMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdSetMetrics_adSetId_date_key" ON "AdSetMetrics"("adSetId", "date");
CREATE INDEX IF NOT EXISTS "AdSetMetrics_adSetId_idx" ON "AdSetMetrics"("adSetId");

ALTER TABLE "AdSetMetrics" DROP CONSTRAINT IF EXISTS "AdSetMetrics_adSetId_fkey";
ALTER TABLE "AdSetMetrics" ADD CONSTRAINT "AdSetMetrics_adSetId_fkey"
  FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AdMetrics (SP4) ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdMetrics" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION,
    "cpm" DOUBLE PRECISION,
    "ctr" DOUBLE PRECISION,
    CONSTRAINT "AdMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdMetrics_adId_date_key" ON "AdMetrics"("adId", "date");
CREATE INDEX IF NOT EXISTS "AdMetrics_adId_idx" ON "AdMetrics"("adId");

ALTER TABLE "AdMetrics" DROP CONSTRAINT IF EXISTS "AdMetrics_adId_fkey";
ALTER TABLE "AdMetrics" ADD CONSTRAINT "AdMetrics_adId_fkey"
  FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CampaignAlert (SP4) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CampaignAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "CampaignAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CampaignAlert_campaignId_idx" ON "CampaignAlert"("campaignId");
CREATE INDEX IF NOT EXISTS "CampaignAlert_organizationId_isRead_idx" ON "CampaignAlert"("organizationId", "isRead");

ALTER TABLE "CampaignAlert" DROP CONSTRAINT IF EXISTS "CampaignAlert_campaignId_fkey";
ALTER TABLE "CampaignAlert" ADD CONSTRAINT "CampaignAlert_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── MetaProductMapping (SP4) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MetaProductMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mappingType" "MappingType" NOT NULL DEFAULT 'MANUAL',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaProductMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetaProductMapping_campaignId_productId_key" ON "MetaProductMapping"("campaignId", "productId");
CREATE INDEX IF NOT EXISTS "MetaProductMapping_organizationId_productId_idx" ON "MetaProductMapping"("organizationId", "productId");

ALTER TABLE "MetaProductMapping" DROP CONSTRAINT IF EXISTS "MetaProductMapping_campaignId_fkey";
ALTER TABLE "MetaProductMapping" ADD CONSTRAINT "MetaProductMapping_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetaProductMapping" DROP CONSTRAINT IF EXISTS "MetaProductMapping_organizationId_fkey";
ALTER TABLE "MetaProductMapping" ADD CONSTRAINT "MetaProductMapping_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetaProductMapping" DROP CONSTRAINT IF EXISTS "MetaProductMapping_productId_fkey";
ALTER TABLE "MetaProductMapping" ADD CONSTRAINT "MetaProductMapping_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── MonthlyExpense (SP5) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MonthlyExpense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vatDeductible" BOOLEAN NOT NULL DEFAULT false,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyExpense_org_year_month_cat_desc_key"
  ON "MonthlyExpense"("organizationId", "year", "month", "category", "description");
CREATE INDEX IF NOT EXISTS "MonthlyExpense_organizationId_year_month_idx"
  ON "MonthlyExpense"("organizationId", "year", "month");

ALTER TABLE "MonthlyExpense" DROP CONSTRAINT IF EXISTS "MonthlyExpense_organizationId_fkey";
ALTER TABLE "MonthlyExpense" ADD CONSTRAINT "MonthlyExpense_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ProductProfitabilitySnapshot (SP5) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ProductProfitabilitySnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adsSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION,
    "recommendation" "RecommendationType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductProfitabilitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductProfitabilitySnapshot_org_product_period_key"
  ON "ProductProfitabilitySnapshot"("organizationId", "productId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "ProductProfitabilitySnapshot_organizationId_periodStart_idx"
  ON "ProductProfitabilitySnapshot"("organizationId", "periodStart");
CREATE INDEX IF NOT EXISTS "ProductProfitabilitySnapshot_organizationId_marginPct_idx"
  ON "ProductProfitabilitySnapshot"("organizationId", "marginPct");

ALTER TABLE "ProductProfitabilitySnapshot" DROP CONSTRAINT IF EXISTS "ProductProfitabilitySnapshot_organizationId_fkey";
ALTER TABLE "ProductProfitabilitySnapshot" ADD CONSTRAINT "ProductProfitabilitySnapshot_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductProfitabilitySnapshot" DROP CONSTRAINT IF EXISTS "ProductProfitabilitySnapshot_productId_fkey";
ALTER TABLE "ProductProfitabilitySnapshot" ADD CONSTRAINT "ProductProfitabilitySnapshot_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── StoreProfitabilitySnapshot (SP5) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StoreProfitabilitySnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "grossRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAdsSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgRoas" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreProfitabilitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreProfitabilitySnapshot_organizationId_year_month_key"
  ON "StoreProfitabilitySnapshot"("organizationId", "year", "month");

ALTER TABLE "StoreProfitabilitySnapshot" DROP CONSTRAINT IF EXISTS "StoreProfitabilitySnapshot_organizationId_fkey";
ALTER TABLE "StoreProfitabilitySnapshot" ADD CONSTRAINT "StoreProfitabilitySnapshot_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
