import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

// NOTE: In-memory rate limiter — resets on process restart/redeploy.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (record.count >= maxRequests) return false
  record.count++

  if (rateLimitMap.size > 1000) {
    const now2 = Date.now()
    for (const [key, val] of rateLimitMap.entries()) {
      if (now2 > val.resetAt) rateLimitMap.delete(key)
    }
  }

  return true
}

const querySchema = z.object({
  orderNumber: z.string().regex(/^\d+$/, 'Număr comandă invalid'),
  orgId: z.string().min(10),
})

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (!checkRateLimit(ip, 20, 60_000)) {
    return NextResponse.json({ error: 'Prea multe cereri. Încearcă din nou în câteva minute.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)

  const result = querySchema.safeParse({
    orderNumber: searchParams.get('orderNumber')?.replace('#', '').trim() ?? '',
    orgId: searchParams.get('orgId') ?? '',
  })

  if (!result.success) {
    return NextResponse.json({ error: 'Parametri invalizi' }, { status: 400 })
  }

  const { orderNumber, orgId } = result.data

  // 1. Try Rise DB first (fast path)
  const order = await db.order.findFirst({
    where: {
      organizationId: orgId,
      orderNumber: parseInt(orderNumber, 10),
    },
    include: {
      items: {
        select: {
          shopifyProductId: true,
          title: true,
          variantTitle: true,
          sku: true,
          productId: true,
        },
      },
    },
  })

  if (order) {
    const shopifyData = order.shopifyData as Record<string, unknown> | null
    const customerName =
      ((shopifyData?.customer as Record<string, unknown> | null)?.displayName as string)?.trim() ||
      ((shopifyData?.billingAddress as Record<string, unknown> | null)?.name as string)?.trim() ||
      order.email ||
      'Client'

    return NextResponse.json({
      customerName,
      customerEmail: order.email,
      shopifyOrderId: order.shopifyOrderId,
      fulfillmentStatus: order.fulfillmentStatus,
      orderItems: order.items.map((item) => ({
        shopifyProductId: item.shopifyProductId,
        productId: item.productId,
        productTitle: item.title,
        variantTitle: item.variantTitle,
        sku: item.sku,
      })),
    })
  }

  // 2. Fallback: query Shopify API directly (order not synced yet to Rise DB)
  const connection = await db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
  })

  if (!connection) {
    return NextResponse.json({ error: 'Comanda nu a fost găsită' }, { status: 404 })
  }

  try {
    const shopifyResult = await fetchOrderFromShopify(
      connection.shopDomain,
      connection.accessTokenEncrypted,
      orderNumber,
    )

    if (!shopifyResult) {
      return NextResponse.json({ error: 'Comanda nu a fost găsită' }, { status: 404 })
    }

    return NextResponse.json(shopifyResult)
  } catch (err) {
    console.error('[lookup-order] Shopify fallback error:', err)
    return NextResponse.json({ error: 'Comanda nu a fost găsită' }, { status: 404 })
  }
}

interface ShopifyOrderRaw {
  id: number
  order_number: number
  email: string | null
  financial_status: string
  fulfillment_status: string | null
  billing_address: { name?: string } | null
  customer: { first_name?: string; last_name?: string } | null
  line_items: {
    product_id: number | null
    title: string
    variant_title: string | null
    sku: string | null
  }[]
}

async function fetchOrderFromShopify(
  shopDomain: string,
  accessTokenEncrypted: string,
  orderNumber: string,
) {
  const accessToken = decrypt(accessTokenEncrypted)

  const params = new URLSearchParams({
    name: `#${orderNumber}`,
    status: 'any',
    limit: '1',
    fields: 'id,order_number,email,financial_status,fulfillment_status,line_items,billing_address,customer',
  })

  const res = await fetch(
    `https://${shopDomain}/admin/api/2025-01/orders.json?${params}`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!res.ok) return null

  const data = await res.json() as { orders: ShopifyOrderRaw[] }
  const o = data.orders?.[0]
  if (!o) return null

  const nameParts = [o.customer?.first_name, o.customer?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  const customerName =
    nameParts ||
    o.billing_address?.name?.trim() ||
    o.email ||
    'Client'

  return {
    customerName,
    customerEmail: o.email || null,
    shopifyOrderId: String(o.id),
    fulfillmentStatus: o.fulfillment_status ?? null,
    orderItems: (o.line_items ?? []).map((item) => ({
      shopifyProductId: item.product_id ? String(item.product_id) : '',
      productId: null as string | null,
      productTitle: item.title,
      variantTitle: item.variant_title || null,
      sku: item.sku || null,
    })),
  }
}
