import { db } from '@/lib/db'
import { createShopifyClient } from './client'
import type { ShopifyProduct, ShopifySyncResult } from './types'

export async function syncProducts(orgId: string): Promise<ShopifySyncResult> {
  const result: ShopifySyncResult = { synced: 0, updated: 0, errors: [] }

  const connection = await db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
  })

  if (!connection) {
    throw new Error('Shopify connection not found')
  }

  // Verifică isSyncing flag — previne race conditions
  if (connection.isSyncing) {
    throw new Error('Sync already in progress')
  }

  // Setează isSyncing = true
  await db.shopifyConnection.update({
    where: { organizationId: orgId },
    data: { isSyncing: true },
  })

  try {
    const client = createShopifyClient(connection.shopDomain, connection.accessTokenEncrypted)

    let pageInfo: string | undefined = undefined

    // Cursor pagination loop — preia toate paginile
    do {
      const { data, nextPageInfo } = await client.getProducts(250, pageInfo)
      const products: ShopifyProduct[] = data.products

      for (const product of products) {
        try {
          if (!product.variants || product.variants.length === 0) {
            result.errors.push(`Product ${product.id} has no variants — skipped`)
            continue
          }

          const firstVariant = product.variants[0]
          const price = parseFloat(firstVariant.price)
          const compareAtPrice = firstVariant.compare_at_price
            ? parseFloat(firstVariant.compare_at_price)
            : null
          const imageUrl = product.images?.[0]?.src ?? null

          // Stocare selectivă — nu raw Shopify response complet
          const shopifyData = {
            variants: product.variants.map((v) => ({
              id: v.id,
              price: v.price,
              compare_at_price: v.compare_at_price,
              inventory_quantity: v.inventory_quantity,
            })),
            images: product.images?.map((img) => ({ src: img.src })) ?? [],
          }

          const existing = await db.product.findUnique({
            where: {
              organizationId_shopifyId: {
                organizationId: orgId,
                shopifyId: String(product.id),
              },
            },
          })

          await db.product.upsert({
            where: {
              organizationId_shopifyId: {
                organizationId: orgId,
                shopifyId: String(product.id),
              },
            },
            create: {
              organizationId: orgId,
              shopifyId: String(product.id),
              title: product.title,
              handle: product.handle,
              price,
              compareAtPrice,
              imageUrl,
              status: product.status,
              shopifyData,
            },
            update: {
              title: product.title,
              handle: product.handle,
              price,
              compareAtPrice,
              imageUrl,
              status: product.status,
              shopifyData,
            },
          })

          if (existing) {
            result.updated++
          } else {
            result.synced++
          }
        } catch (err) {
          result.errors.push(`Product ${product.id}: ${String(err)}`)
        }
      }

      pageInfo = nextPageInfo ?? undefined
    } while (pageInfo)

    // Actualizează lastSyncedAt
    await db.shopifyConnection.update({
      where: { organizationId: orgId },
      data: { lastSyncedAt: new Date() },
    })
  } finally {
    // Eliberează lock-ul indiferent de rezultat
    await db.shopifyConnection.update({
      where: { organizationId: orgId },
      data: { isSyncing: false },
    })
  }

  return result
}
