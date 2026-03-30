-- AddColumn matchPattern to MetaProductMapping
ALTER TABLE "MetaProductMapping" ADD COLUMN IF NOT EXISTS "matchPattern" TEXT;
