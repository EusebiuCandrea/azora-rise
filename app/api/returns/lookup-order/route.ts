import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Simple in-memory rate limiter: max 20 req/min per IP
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
  return true
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (!checkRateLimit(ip, 20, 60_000)) {
    return NextResponse.json({ error: 'Prea multe cereri. Încearcă din nou în câteva minute.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const orderNumber = searchParams.get('orderNumber')?.replace('#', '').trim()
  const orgId = searchParams.get('orgId')

  if (!orderNumber || !orgId) {
    return NextResponse.json({ error: 'Parametri lipsă' }, { status: 400 })
  }

  // Validate orgId format (basic check)
  if (!/^[a-z0-9-]{10,}$/i.test(orgId)) {
    return NextResponse.json({ error: 'Organizație invalidă' }, { status: 400 })
  }

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

  return NextResponse.json({
    customerName: order.email ?? 'Client',
    customerEmail: order.email,
    orderItems: order.items.map((item) => ({
      shopifyProductId: item.shopifyProductId,
      productId: item.productId,
      productTitle: item.title,
      variantTitle: item.variantTitle,
      sku: item.sku,
    })),
  })
}
