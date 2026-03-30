import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const products = await db.product.findMany({
    where: { organizationId: orgId },
    include: { cost: true },
    orderBy: { title: 'asc' },
  })

  return NextResponse.json({ products })
}
