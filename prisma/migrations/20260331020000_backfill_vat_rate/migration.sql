-- Backfill ProductCost records from old TVA rate (0.19) to current Romania TVA rate (0.21)
-- Effective since January 2026
UPDATE "ProductCost" SET "vatRate" = 0.21 WHERE "vatRate" = 0.19;
