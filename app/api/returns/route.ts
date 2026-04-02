import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { sendAdminReturnNotification } from '@/lib/email'
import { ReturnStatus, ReturnType } from '@prisma/client'

export async function GET(request: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const status = searchParams.get('status') as ReturnStatus | null
  const returnType = searchParams.get('returnType') as ReturnType | null
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where = {
    organizationId: orgId,
    ...(status && { status }),
    ...(returnType && { returnType }),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      },
    } : {}),
  }

  const [returns, total] = await Promise.all([
    db.return.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
    }),
    db.return.count({ where }),
  ])

  // Stats
  const [totalCount, newCount, receivedCount, completedCount] = await Promise.all([
    db.return.count({ where: { organizationId: orgId } }),
    db.return.count({ where: { organizationId: orgId, status: 'NEW' } }),
    db.return.count({ where: { organizationId: orgId, status: 'RECEIVED' } }),
    db.return.count({ where: { organizationId: orgId, status: 'COMPLETED' } }),
  ])

  return NextResponse.json({
    returns,
    total,
    page,
    totalPages: Math.ceil(total / 25),
    stats: { total: totalCount, new: newCount, received: receivedCount, completed: completedCount },
  })
}

const createSchema = z.object({
  orderNumber: z.string().min(1),
  shopifyOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal('')),
  returnType: z.enum(['REFUND', 'EXCHANGE']),
  productTitle: z.string().min(1),
  productId: z.string().optional().nullable(),
  variantTitle: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  reason: z.string().min(1),
  awbNumber: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  ibanHolder: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  const order = await db.order.findFirst({
    where: { organizationId: orgId, shopifyOrderId: data.shopifyOrderId },
  })

  const returnRecord = await db.return.create({
    data: {
      organizationId: orgId,
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
      adminNotes: data.adminNotes ?? null,
    },
  })

  // Send admin notification (manual creation by admin — no customer email)
  await sendAdminReturnNotification({
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
  })

  return NextResponse.json(returnRecord, { status: 201 })
}
