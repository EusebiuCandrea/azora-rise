import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const rawDays = searchParams.get('days') ?? '30'
  const periodDays = ([7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30) as 7 | 30 | 90

  const [snapshot, alerts, history] = await Promise.all([
    db.journeySnapshot.findFirst({
      where: { organizationId: orgId, periodDays },
      orderBy: { createdAt: 'desc' },
      include: {
        aiReports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    }),
    db.journeyAlert.findMany({
      where: { organizationId: orgId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Last 30 daily snapshots (periodDays=7) for the conversion rate chart
    db.journeySnapshot.findMany({
      where: { organizationId: orgId, periodDays: 7 },
      orderBy: { date: 'asc' },
      take: 30,
      select: { date: true, overallConversion: true, totalOrders: true, totalProductViews: true },
    }),
  ])

  const aiReport = snapshot?.aiReports[0] ?? null

  return NextResponse.json({
    snapshot: snapshot ? { ...snapshot, aiReports: undefined } : null,
    aiReport,
    alerts,
    history,
  })
}
