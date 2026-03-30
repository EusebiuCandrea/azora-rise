import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  year: z.number().int().min(2020).max(2030),
  month: z.number().int().min(1).max(12),
  category: z.enum(['RENT', 'SALARY', 'COURIER', 'SOFTWARE', 'MARKETING_OTHER', 'ACCOUNTING', 'BANK_FEES', 'OTHER']),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  vatDeductible: z.boolean().optional().default(false),
  vatAmount: z.number().optional().default(0),
  currency: z.string().optional().default('RON'),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)

  const expenses = await db.monthlyExpense.findMany({
    where: { organizationId: orgId, year, month },
    orderBy: { category: 'asc' },
  })

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return NextResponse.json({ expenses, total, year, month })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const expense = await db.monthlyExpense.create({
    data: { ...parsed.data, organizationId: orgId },
  })

  return NextResponse.json({ expense }, { status: 201 })
}
