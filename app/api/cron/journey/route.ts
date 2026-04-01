import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateJourneySnapshot } from '@/lib/journey/snapshot'
import { generateJourneyAIReport } from '@/lib/journey/ai-report'
import { checkAndCreateAlerts } from '@/lib/journey/alerts'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const orgs = await db.organization.findMany({ select: { id: true } })
  const results: Record<string, string> = {}

  for (const org of orgs) {
    try {
      // Compute snapshots for all periods
      const [, snapshot30] = await Promise.all([
        calculateJourneySnapshot(org.id, 7),
        calculateJourneySnapshot(org.id, 30),
        calculateJourneySnapshot(org.id, 90),
      ])

      // Generate AI report only if there's meaningful data
      if (snapshot30.totalProductViews > 0) {
        const report = await generateJourneyAIReport(snapshot30)
        await db.journeyAIReport.upsert({
          where: { snapshotId: snapshot30.id },
          create: {
            organizationId: org.id,
            snapshotId: snapshot30.id,
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
      }

      await checkAndCreateAlerts(org.id)
      results[org.id] = 'ok'
    } catch (err) {
      console.error(`Journey cron failed for org ${org.id}:`, err)
      results[org.id] = err instanceof Error ? err.message : 'error'
    }
  }

  return NextResponse.json({ ok: true, results })
}
