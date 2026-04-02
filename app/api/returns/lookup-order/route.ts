import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

// NOTE: In-memory rate limiter — resets on process restart/redeploy.
// Suitable for Phase 1 single-instance deployment on Railway.
// For multi-instance deployments, replace with Redis/Upstash.
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

  // Cleanup expired entries every 100 calls
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

  if (!order) {
    return NextResponse.json({ error: 'Comanda nu a fost găsită' }, { status: 404 })
  }

  // Extract customer name from shopifyData if available
  const shopifyData = order.shopifyData as Record<string, unknown> | null
  const customerName = (shopifyData?.customer as Record<string, unknown> | null)?.displayName as string
    ?? (shopifyData?.billingAddress as Record<string, unknown> | null)?.name as string
    ?? order.email
    ?? 'Client'

  return NextResponse.json({
    customerName,
    customerEmail: order.email,
    shopifyOrderId: order.shopifyOrderId,
    orderItems: order.items.map((item) => ({
      shopifyProductId: item.shopifyProductId,
      productId: item.productId,
      productTitle: item.title,
      variantTitle: item.variantTitle,
      sku: item.sku,
    })),
  })
}
