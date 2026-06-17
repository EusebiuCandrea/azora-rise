import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  sendAdminReturnNotification,
  sendCustomerReturnConfirmation,
  sendAdminCancellationNotification,
  sendCustomerCancellationConfirmation,
} from '@/lib/email'

// NOTE: In-memory rate limiter — resets on process restart/redeploy.
// Suitable for Phase 1 single-instance deployment on Railway.
// For multi-instance deployments, replace with Redis/Upstash.
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

  if (submitRateLimitMap.size > 1000) {
    const now2 = Date.now()
    for (const [key, val] of submitRateLimitMap.entries()) {
      if (now2 > val.resetAt) submitRateLimitMap.delete(key)
    }
  }

  return true
}

const schema = z.object({
  orgId: z.string().min(10),
  orderNumber: z.string().min(1),
  shopifyOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal('')),
  returnType: z.enum(['REFUND', 'EXCHANGE', 'CANCELLATION']),
  productTitle: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  variantTitle: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  awbNumber: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  ibanHolder: z.string().optional().nullable(),
  cancellationEligible: z.boolean().optional().nullable(),
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

  // Validate required fields based on return type
  if (data.returnType !== 'CANCELLATION') {
    if (!data.productTitle || !data.reason || data.reason.length < 5) {
      return NextResponse.json({ error: 'Date invalide pentru cererea de retur.' }, { status: 400 })
    }
  }

  const org = await db.organization.findUnique({ where: { id: data.orgId } })
  if (!org) {
    return NextResponse.json({ error: 'Organizație invalidă' }, { status: 400 })
  }

  const order = await db.order.findFirst({
    where: {
      organizationId: data.orgId,
      shopifyOrderId: data.shopifyOrderId,
    },
  })

  const isCancellation = data.returnType === 'CANCELLATION'

  const returnRecord = await db.return.create({
    data: {
      organizationId: data.orgId,
      orderId: order?.id ?? null,
      shopifyOrderId: data.shopifyOrderId,
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail || null,
      returnType: data.returnType,
      productTitle: isCancellation ? (data.productTitle || 'Anulare Comandă') : data.productTitle!,
      productId: data.productId ?? null,
      variantTitle: data.variantTitle ?? null,
      sku: data.sku ?? null,
      reason: isCancellation ? (data.reason || 'Anulare Comandă') : data.reason!,
      awbNumber: data.awbNumber ?? null,
      iban: data.iban ?? null,
      ibanHolder: data.ibanHolder ?? null,
      cancellationEligible: isCancellation ? (data.cancellationEligible ?? null) : null,
    },
  })

  const customerEmail = data.customerEmail || undefined

  if (isCancellation) {
    const cancellationData = {
      returnId: returnRecord.id,
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      customerEmail,
      cancellationEligible: data.cancellationEligible ?? false,
    }
    void sendAdminCancellationNotification(cancellationData)
    if (customerEmail && data.cancellationEligible) {
      void sendCustomerCancellationConfirmation(cancellationData)
    }
  } else {
    const emailData = {
      returnId: returnRecord.id,
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      customerEmail,
      productTitle: data.productTitle!,
      variantTitle: data.variantTitle ?? undefined,
      returnType: data.returnType as 'REFUND' | 'EXCHANGE',
      reason: data.reason!,
      awbNumber: data.awbNumber ?? undefined,
      iban: data.iban ?? undefined,
      ibanHolder: data.ibanHolder ?? undefined,
    }
    void sendAdminReturnNotification(emailData)
    if (customerEmail) {
      void sendCustomerReturnConfirmation(emailData)
    }
  }

  return NextResponse.json({ id: returnRecord.id, orderNumber: data.orderNumber }, { status: 201 })
}
