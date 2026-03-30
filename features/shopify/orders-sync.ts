import { db } from '@/lib/db'
import { createShopifyClient } from './client'
import type { ShopifyOrder, ShopifyOrdersSyncResult } from './types'

const RATE_LIMIT_DELAY_MS = 500  // 500ms între pagini = 2 req/s
const INITIAL_SYNC_DAYS = 90     // preia ultimele 90 zile la primul sync

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function syncOrders(orgId: string): Promise<ShopifyOrdersSyncResult> {
  const result: ShopifyOrdersSyncResult = {
    synced: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  // 1. Preia conexiunea Shopify
  const connection = await db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
  })

  if (!connection) {
    throw new Error('Shopify connection not found')
  }

  // 2. Anti-race condition
  if (connection.isOrdersSyncing) {
    throw new Error('Orders sync already in progress')
  }

  // 3. Setează flag sync activ
  await db.shopifyConnection.update({
    where: { organizationId: orgId },
    data: { isOrdersSyncing: true },
  })

  try {
    const client = createShopifyClient(connection.shopDomain, connection.accessTokenEncrypted)

    // 4. Determină punctul de start pentru sync
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { ordersSyncCursor: true },
    })

    const isInitialSync = !org?.ordersSyncCursor
    const processedAtMin = isInitialSync
      ? new Date(Date.now() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : undefined
    const sinceId = org?.ordersSyncCursor ?? undefined

    let pageInfo: string | undefined = undefined
    let isFirstPage = true
    let latestShopifyOrderId: string | null = null

    // 5. Cursor pagination loop
    do {
      let ordersResult

      try {
        ordersResult = await client.getOrders({
          pageInfo,
          sinceId: isFirstPage ? sinceId : undefined,
          processedAtMin: isFirstPage ? processedAtMin : undefined,
          status: 'any',
          limit: 250,
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'SHOPIFY_RATE_LIMIT') {
          // Rate limit: așteaptă 1s și încearcă din nou
          await sleep(1000)
          ordersResult = await client.getOrders({
            pageInfo,
            sinceId: isFirstPage ? sinceId : undefined,
            processedAtMin: isFirstPage ? processedAtMin : undefined,
            status: 'any',
            limit: 250,
          })
        } else {
          throw err
        }
      }

      isFirstPage = false
      const { orders, nextPageInfo } = ordersResult

      // 6. Procesează fiecare comandă
      for (const order of orders) {
        try {
          const isNew = await upsertOrder(order, orgId)

          const INCLUDED_STATUSES = ['paid', 'partially_refunded', 'refunded']
          if (INCLUDED_STATUSES.includes(order.financial_status)) {
            if (isNew) {
              result.synced++
            } else {
              result.updated++
            }
          } else {
            result.skipped++
          }

          // Reține cel mai mare Shopify ID pentru cursor incremental
          const shopifyIdNum = order.id
          if (!latestShopifyOrderId || shopifyIdNum > parseInt(latestShopifyOrderId)) {
            latestShopifyOrderId = String(shopifyIdNum)
          }
        } catch (err) {
          result.errors.push(`Order ${order.order_number}: ${String(err)}`)
        }
      }

      pageInfo = nextPageInfo ?? undefined

      // 7. Rate limiting — pauză între pagini
      if (pageInfo) {
        await sleep(RATE_LIMIT_DELAY_MS)
      }
    } while (pageInfo)

    // 8. Salvează cursorul pentru sync incremental ulterior
    if (latestShopifyOrderId) {
      await db.organization.update({
        where: { id: orgId },
        data: { ordersSyncCursor: latestShopifyOrderId },
      })
    }

    // 9. Backfill productId pe toate orderItems cu productId null
    const nullItems = await db.orderItem.findMany({
      where: {
        organizationId: orgId,
        productId: null,
        shopifyProductId: { not: '' },
      },
      select: { id: true, shopifyProductId: true },
    })

    if (nullItems.length > 0) {
      const uniqueShopifyIds = [...new Set(nullItems.map((i) => i.shopifyProductId))]
      const localProducts = await db.product.findMany({
        where: { organizationId: orgId, shopifyId: { in: uniqueShopifyIds } },
        select: { id: true, shopifyId: true },
      })
      const productMap = new Map(localProducts.map((p) => [p.shopifyId, p.id]))

      for (const [shopifyId, productId] of productMap) {
        await db.orderItem.updateMany({
          where: { organizationId: orgId, shopifyProductId: shopifyId, productId: null },
          data: { productId },
        })
      }
    }

    // 11. Actualizează timestamp sync
    await db.shopifyConnection.update({
      where: { organizationId: orgId },
      data: { ordersLastSyncedAt: new Date() },
    })
  } finally {
    // 12. Eliberează lock indiferent de erori
    await db.shopifyConnection.update({
      where: { organizationId: orgId },
      data: { isOrdersSyncing: false },
    })
  }

  return result
}

/**
 * Upsert o comandă Shopify în DB.
 * Returns true if newly created, false if updated.
 * Idempotent — poate fi apelat de mai multe ori pentru aceeași comandă.
 */
export async function upsertOrder(order: ShopifyOrder, orgId: string): Promise<boolean> {
  const shopifyOrderId = String(order.id)
  const totalShipping = parseFloat(
    order.total_shipping_price_set?.shop_money?.amount ?? '0'
  )

  // Extragem ID-urile produselor pentru matching cu Product table
  const productShopifyIds = order.line_items
    .map((li) => li.product_id)
    .filter((id): id is number => id !== null)
    .map(String)

  // Lookup produse locale prin Shopify ID
  const localProducts =
    productShopifyIds.length > 0
      ? await db.product.findMany({
          where: {
            organizationId: orgId,
            shopifyId: { in: productShopifyIds },
          },
          select: { id: true, shopifyId: true },
        })
      : []

  const productMap = new Map(localProducts.map((p) => [p.shopifyId, p.id]))

  // Check if order already exists
  const existing = await db.order.findUnique({
    where: {
      organizationId_shopifyOrderId: {
        organizationId: orgId,
        shopifyOrderId,
      },
    },
    select: { id: true },
  })

  // Upsert Order
  await db.order.upsert({
    where: {
      organizationId_shopifyOrderId: {
        organizationId: orgId,
        shopifyOrderId,
      },
    },
    create: {
      organizationId: orgId,
      shopifyOrderId,
      orderNumber: order.order_number,
      email: order.email,
      phone: order.phone,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: parseFloat(order.total_price),
      subtotalPrice: parseFloat(order.subtotal_price),
      totalTax: parseFloat(order.total_tax),
      totalShipping,
      currency: order.currency,
      processedAt: new Date(order.processed_at),
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
      shopifyData: {
        order_number: order.order_number,
        financial_status: order.financial_status,
      },
      items: {
        create: order.line_items.map((li) => ({
          organizationId: orgId,
          shopifyProductId: String(li.product_id ?? ''),
          shopifyVariantId: li.variant_id ? String(li.variant_id) : null,
          productId: li.product_id ? (productMap.get(String(li.product_id)) ?? null) : null,
          title: li.title,
          variantTitle: li.variant_title,
          sku: li.sku,
          quantity: li.quantity,
          price: parseFloat(li.price),
          totalDiscount: parseFloat(li.total_discount),
          requiresShipping: li.requires_shipping,
        })),
      },
    },
    update: {
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: parseFloat(order.total_price),
      subtotalPrice: parseFloat(order.subtotal_price),
      totalTax: parseFloat(order.total_tax),
      totalShipping,
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
    },
  })

  // Backfill productId on existing items where it's still null (e.g. orders synced before products)
  if (productMap.size > 0) {
    for (const [shopifyId, productId] of productMap) {
      await db.orderItem.updateMany({
        where: {
          order: { shopifyOrderId, organizationId: orgId },
          shopifyProductId: shopifyId,
          productId: null,
        },
        data: { productId },
      })
    }
  }

  return !existing  // true = newly created
}
