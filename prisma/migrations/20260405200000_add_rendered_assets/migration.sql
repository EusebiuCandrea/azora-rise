-- AlterEnum
ALTER TYPE "AssetType" ADD VALUE 'RENDERED';

-- AlterTable
ALTER TABLE "VideoAsset" ADD COLUMN "outputFormat" TEXT,
ADD COLUMN "parentAssetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VideoAsset_parentAssetId_outputFormat_key" ON "VideoAsset"("parentAssetId", "outputFormat");

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
