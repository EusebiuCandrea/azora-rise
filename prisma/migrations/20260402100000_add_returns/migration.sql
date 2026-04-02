-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('REFUND', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('NEW', 'RECEIVED', 'APPROVED', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "returnType" "ReturnType" NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productId" TEXT,
    "variantTitle" TEXT,
    "sku" TEXT,
    "reason" TEXT NOT NULL,
    "awbNumber" TEXT,
    "iban" TEXT,
    "ibanHolder" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Return_organizationId_idx" ON "Return"("organizationId");

-- CreateIndex
CREATE INDEX "Return_organizationId_status_idx" ON "Return"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Return_organizationId_createdAt_idx" ON "Return"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Return_orderId_idx" ON "Return"("orderId");

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
