import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const searchParams = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const status = searchParams.get('status') // null = toate
  const skip = (page - 1) * limit

  const where = {
    organizationId: orgId,
    ...(status ? { financialStatus: status } : {}),
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        items: {
          select: {
            id: true,
            title: true,
            quantity: true,
            price: true,
            shopifyProductId: true,
          },
        },
      },
      orderBy: { processedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.order.count({ where }),
  ])

  return NextResponse.json({
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
