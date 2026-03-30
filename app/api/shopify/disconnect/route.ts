import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function POST() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  await db.$transaction([
    db.product.deleteMany({ where: { organizationId: orgId } }),
    db.shopifyConnection.deleteMany({ where: { organizationId: orgId } }),
  ])

  return NextResponse.json({ ok: true })
}
