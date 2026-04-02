/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `MetaProductMapping` table. All the data in the column will be lost.
  - You are about to drop the column `adsSpend` on the `ProductProfitabilitySnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ProductProfitabilitySnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `roas` on the `ProductProfitabilitySnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `avgRoas` on the `StoreProfitabilitySnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `StoreProfitabilitySnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `totalExpenses` on the `StoreProfitabilitySnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `StoreProfitabilitySnapshot` table. All the data in the column will be lost.
  - Added the required column `avgSellingPrice` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grossProfit` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `incomeTax` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operatingProfit` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ordersCount` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodDays` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `returnProvision` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCogs` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPackaging` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalShipping` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalShopifyFee` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatCollected` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatDeductible` to the `ProductProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grossProfit` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `incomeTax` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `netMarginPct` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operatingProfit` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCogs` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPackaging` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalShipping` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalShopifyFees` to the `StoreProfitabilitySnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CampaignMetrics" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "MetaProductMapping" DROP COLUMN "updatedAt",
ALTER COLUMN "mappingType" DROP DEFAULT,
ALTER COLUMN "createdBy" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductProfitabilitySnapshot" DROP COLUMN "adsSpend",
DROP COLUMN "createdAt",
DROP COLUMN "roas",
ADD COLUMN     "adsPurchases" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "adsRoas" DOUBLE PRECISION,
ADD COLUMN     "adsSpendRON" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "avgSellingPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "grossProfit" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "incomeTax" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "isStale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operatingProfit" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "ordersCount" INTEGER NOT NULL,
ADD COLUMN     "periodDays" INTEGER NOT NULL,
ADD COLUMN     "recommendationNote" TEXT,
ADD COLUMN     "returnProvision" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalCogs" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalPackaging" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalShipping" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalShopifyFee" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "unitsReturned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vatCollected" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "vatDeductible" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "unitsSold" DROP DEFAULT,
ALTER COLUMN "grossRevenue" DROP DEFAULT,
ALTER COLUMN "netRevenue" DROP DEFAULT,
ALTER COLUMN "netProfit" DROP DEFAULT,
ALTER COLUMN "marginPct" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StoreProfitabilitySnapshot" DROP COLUMN "avgRoas",
DROP COLUMN "createdAt",
DROP COLUMN "totalExpenses",
DROP COLUMN "updatedAt",
ADD COLUMN     "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "grossProfit" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "growthPct" DOUBLE PRECISION,
ADD COLUMN     "incomeTax" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "netMarginPct" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "operatingProfit" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "prevMonthNetProfit" DOUBLE PRECISION,
ADD COLUMN     "refunds" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalAdsPurchases" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCogs" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalManualExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalPackaging" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalReturnProvision" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalShipping" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalShopifyFees" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalVatCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalVatDeductible" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "grossRevenue" DROP DEFAULT,
ALTER COLUMN "netRevenue" DROP DEFAULT,
ALTER COLUMN "netProfit" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "MonthlyExpense_org_year_month_cat_desc_key" RENAME TO "MonthlyExpense_organizationId_year_month_category_descripti_key";

-- RenameIndex
ALTER INDEX "ProductProfitabilitySnapshot_org_product_period_key" RENAME TO "ProductProfitabilitySnapshot_organizationId_productId_perio_key";
