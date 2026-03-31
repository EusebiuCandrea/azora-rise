-- Add missing createdBy column to MetaProductMapping
ALTER TABLE "MetaProductMapping" ADD COLUMN IF NOT EXISTS "createdBy" TEXT NOT NULL DEFAULT '';
