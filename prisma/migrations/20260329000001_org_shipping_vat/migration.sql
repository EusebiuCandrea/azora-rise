-- Add new org fields
ALTER TABLE "Organization" ADD COLUMN "shippingCostDefault" DOUBLE PRECISION NOT NULL DEFAULT 20;
ALTER TABLE "Organization" ADD COLUMN "isVatPayer" BOOLEAN NOT NULL DEFAULT true;

-- Remove product cost fields
ALTER TABLE "ProductCost" DROP COLUMN IF EXISTS "shippingCost";
ALTER TABLE "ProductCost" DROP COLUMN IF EXISTS "packagingCost";
