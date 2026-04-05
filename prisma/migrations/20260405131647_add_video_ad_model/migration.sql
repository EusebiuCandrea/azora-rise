-- AlterTable
ALTER TABLE "VideoAsset" ADD COLUMN     "adId" TEXT;

-- CreateTable
CREATE TABLE "VideoAd" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoAd_organizationId_idx" ON "VideoAd"("organizationId");

-- CreateIndex
CREATE INDEX "VideoAd_productId_idx" ON "VideoAd"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoAd_productId_name_key" ON "VideoAd"("productId", "name");

-- CreateIndex
CREATE INDEX "VideoAsset_organizationId_adId_idx" ON "VideoAsset"("organizationId", "adId");

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_adId_fkey" FOREIGN KEY ("adId") REFERENCES "VideoAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAd" ADD CONSTRAINT "VideoAd_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAd" ADD CONSTRAINT "VideoAd_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
