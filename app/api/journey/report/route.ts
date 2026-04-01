import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { calculateJourneySnapshot } from '@/lib/journey/snapshot'
import { generateJourneyAIReport } from '@/lib/journey/ai-report'

export async function POST() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // Always recompute snapshot first
  const snapshot = await calculateJourneySnapshot(orgId, 30)

  if (snapshot.totalProductViews === 0) {
    return NextResponse.json({ error: 'No data yet — install tracking on azora-shop first' }, { status: 422 })
  }

  const report = await generateJourneyAIReport(snapshot)

  // Upsert: one report per snapshot (@@unique[snapshotId])
  const saved = await db.journeyAIReport.upsert({
    where: { snapshotId: snapshot.id },
    create: {
      organizationId: orgId,
      snapshotId: snapshot.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      problems: report.problems as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suggestions: report.suggestions as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickWins: report.quickWins as any,
    },
    update: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      problems: report.problems as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suggestions: report.suggestions as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickWins: report.quickWins as any,
      generatedAt: new Date(),
    },
  })

  return NextResponse.json(saved)
}
