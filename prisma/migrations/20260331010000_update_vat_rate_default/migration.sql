-- Update ProductCost vatRate default from 0.19 to 0.21
-- Effective 2026-01-01: Romania's standard VAT rate increased from 19% to 21%

ALTER TABLE "ProductCost" ALTER COLUMN "vatRate" SET DEFAULT 0.21;
