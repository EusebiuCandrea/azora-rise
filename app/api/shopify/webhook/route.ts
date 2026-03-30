import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { upsertOrder } from '@/features/shopify/orders-sync'
import type { ShopifyOrder } from '@/features/shopify/types'

export async function POST(request: Request) {
  const body = await request.text()
  const hmacHeader = request.headers.get('X-Shopify-Hmac-SHA256')

  if (!hmacHeader) {
    return NextResponse.json({ error: 'Missing HMAC header' }, { status: 401 })
  }

  // Obținem shopDomain din header pentru a găsi webhookSecret-ul corect
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain')
  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain header' }, { status: 401 })
  }

  const connection = await db.shopifyConnection.findFirst({
    where: { shopDomain },
  })

  if (!connection) {
    return NextResponse.json({ error: 'Unknown shop' }, { status: 401 })
  }

  // Verifică HMAC-SHA256 — obligatoriu
  const digest = createHmac('sha256', connection.webhookSecret)
    .update(body, 'utf8')
    .digest('base64')

  const digestBuffer = Buffer.from(digest)
  const hmacBuffer = Buffer.from(hmacHeader)

  if (digestBuffer.length !== hmacBuffer.length || !timingSafeEqual(digestBuffer, hmacBuffer)) {
    return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 })
  }

  // Procesează webhook-ul
  const topic = request.headers.get('X-Shopify-Topic')
  const payload = JSON.parse(body)

  if (topic === 'products/update' || topic === 'products/create') {
    const product = payload
    if (product.id) {
      await db.product.updateMany({
        where: {
          organizationId: connection.organizationId,
          shopifyId: String(product.id),
        },
        data: {
          title: product.title,
          handle: product.handle,
          status: product.status,
          price: parseFloat(product.variants?.[0]?.price ?? '0'),
          imageUrl: product.images?.[0]?.src ?? null,
        },
      })
    }
  }

  if (topic === 'orders/paid') {
    const order = payload as ShopifyOrder
    await upsertOrder(order, connection.organizationId)
  }

  return NextResponse.json({ received: true })
}
