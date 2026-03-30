import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  shopifyFeeRate: z.number().min(0).max(1),
  incomeTaxType: z.enum(['MICRO_1', 'MICRO_3', 'PROFIT_16']),
  packagingCostDefault: z.number().min(0),
  returnRateDefault: z.number().min(0).max(1),
  shopifyMonthlyFee: z.number().min(0),
  packagingMonthlyBudget: z.number().min(0),
  shippingCostDefault: z.number().min(0),
  isVatPayer: z.boolean(),
  eurToRonFixed: z.number().positive().optional(),
})

const SELECT = {
  shopifyFeeRate: true,
  incomeTaxType: true,
  packagingCostDefault: true,
  returnRateDefault: true,
  shopifyMonthlyFee: true,
  packagingMonthlyBudget: true,
  shippingCostDefault: true,
  isVatPayer: true,
} as const

export async function GET(_req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const org = await db.organization.findUnique({ where: { id: orgId }, select: SELECT })
  return NextResponse.json(org)
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const body = await req.json()
  const data = schema.parse(body)

  const { eurToRonFixed, ...rest } = data
  const org = await db.organization.update({
    where: { id: orgId },
    data: {
      ...rest,
      ...(eurToRonFixed !== undefined && { eurToRonFixed }),
    },
    select: SELECT,
  })
  return NextResponse.json(org)
}
