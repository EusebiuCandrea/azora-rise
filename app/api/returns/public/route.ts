import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { sendAdminReturnNotification, sendCustomerReturnConfirmation } from '@/lib/email'

// Rate limit: 10 submissions per hour per IP
const submitRateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = submitRateLimitMap.get(ip)
  if (!record || now > record.resetAt) {
    submitRateLimitMap.set(ip, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (record.count >= 10) return false
  record.count++
  return true
}

const schema = z.object({
  orgId: z.string().min(10),
  orderNumber: z.string().min(1),
  shopifyOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal('')),
  returnType: z.enum(['REFUND', 'EXCHANGE']),
  productTitle: z.string().min(1),
  productId: z.string().optional().nullable(),
  variantTitle: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  reason: z.string().min(5),
  awbNumber: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  ibanHolder: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Ai depășit limita de cereri. Încearcă mâine.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Date invalide', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  // Validate orgId exists
  const org = await db.organization.findUnique({ where: { id: data.orgId } })
  if (!org) {
    return NextResponse.json({ error: 'Organizație invalidă' }, { status: 400 })
  }

  // Find the order in DB to get the orderId
  const order = await db.order.findFirst({
    where: {
      organizationId: data.orgId,
      shopifyOrderId: data.shopifyOrderId,
    },
  })

  const returnRecord = await db.return.create({
    data: {
      organizationId: data.orgId,
      orderId: order?.id ?? null,
      shopifyOrderId: data.shopifyOrderId,
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail || null,
      returnType: data.returnType,
      productTitle: data.productTitle,
      productId: data.productId ?? null,
      variantTitle: data.variantTitle ?? null,
      sku: data.sku ?? null,
      reason: data.reason,
      awbNumber: data.awbNumber ?? null,
      iban: data.iban ?? null,
      ibanHolder: data.ibanHolder ?? null,
    },
  })

  // Send notifications (non-blocking)
  const emailData = {
    returnId: returnRecord.id,
    orderNumber: data.orderNumber,
    customerName: data.customerName,
    customerEmail: data.customerEmail || undefined,
    productTitle: data.productTitle,
    variantTitle: data.variantTitle ?? undefined,
    returnType: data.returnType,
    reason: data.reason,
    awbNumber: data.awbNumber ?? undefined,
    iban: data.iban ?? undefined,
    ibanHolder: data.ibanHolder ?? undefined,
  }

  await sendAdminReturnNotification(emailData)
  if (data.customerEmail) {
    await sendCustomerReturnConfirmation(emailData)
  }

  return NextResponse.json({ id: returnRecord.id, orderNumber: data.orderNumber }, { status: 201 })
}
