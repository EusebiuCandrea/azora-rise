-- AlterTable: Organization — add orders sync fields
ALTER TABLE "Organization" ADD COLUMN "ordersLastSyncedAt" TIMESTAMP(3),
ADD COLUMN "ordersSyncCursor" TEXT;

-- AlterTable: ShopifyConnection — add orders webhook/sync fields
ALTER TABLE "ShopifyConnection" ADD COLUMN "ordersWebhookId" TEXT,
ADD COLUMN "isOrdersSyncing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ordersLastSyncedAt" TIMESTAMP(3);

-- CreateTable: Order
CREATE TABLE "Order" (
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

-- CreateTable: OrderItem
CREATE TABLE "OrderItem" (
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

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_shopifyOrderId_key" ON "Order"("organizationId", "shopifyOrderId");
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");
CREATE INDEX "Order_organizationId_processedAt_idx" ON "Order"("organizationId", "processedAt");
CREATE INDEX "Order_organizationId_financialStatus_idx" ON "Order"("organizationId", "financialStatus");

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_organizationId_idx" ON "OrderItem"("organizationId");
CREATE INDEX "OrderItem_organizationId_shopifyProductId_idx" ON "OrderItem"("organizationId", "shopifyProductId");

-- AddForeignKey: Order → Organization
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OrderItem → Order
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OrderItem → Product
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
