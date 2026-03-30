import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ connected: false })

  const conn = await db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
    select: { shopDomain: true, createdAt: true },
  })

  return NextResponse.json({ connected: !!conn, shopDomain: conn?.shopDomain ?? null })
}
