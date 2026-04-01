import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const alerts = await db.journeyAlert.findMany({
    where: { organizationId: orgId, resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json(alerts)
}

export async function PATCH(req: Request) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { alertId } = await req.json() as { alertId: string }
  if (!alertId) return NextResponse.json({ error: 'alertId required' }, { status: 400 })

  await db.journeyAlert.updateMany({
    where: { id: alertId, organizationId: orgId },
    data: { resolvedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
