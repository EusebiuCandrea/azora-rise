import { db } from '@/lib/db'
import { JourneyAlertType } from '@prisma/client'

const DROP_THRESHOLD = 0.20 // 20% drop triggers alert

interface AlertCheck {
  type: JourneyAlertType
  current: number
  baseline: number
  metric: string
}

export async function checkAndCreateAlerts(organizationId: string): Promise<void> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [recent, baseline] = await Promise.all([
    db.journeySnapshot.findFirst({
      where: { organizationId, periodDays: 7, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
    }),
    db.journeySnapshot.findFirst({
      where: { organizationId, periodDays: 7, createdAt: { lt: sevenDaysAgo, gte: fourteenDaysAgo } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!recent || !baseline) return

  const checks: AlertCheck[] = [
    {
      type: JourneyAlertType.CONVERSION_DROP,
      current: recent.overallConversion,
      baseline: baseline.overallConversion,
      metric: 'overallConversion',
    },
    {
      type: JourneyAlertType.LOW_SCROLL_RATE,
      current: recent.rateVisitToScroll,
      baseline: baseline.rateVisitToScroll,
      metric: 'rateVisitToScroll',
    },
    {
      type: JourneyAlertType.AD_CLICK_DROP,
      current: recent.ctrAd,
      baseline: baseline.ctrAd,
      metric: 'ctrAd',
    },
    {
      type: JourneyAlertType.FORM_ABANDON_SPIKE,
      // Abandon = 1 - submit rate; a spike means submit rate dropped
      current: 1 - recent.rateStartToSubmit,
      baseline: 1 - baseline.rateStartToSubmit,
      metric: 'formAbandonRate',
    },
  ]

  for (const check of checks) {
    if (check.baseline <= 0) continue

    const isSpike = check.type === JourneyAlertType.FORM_ABANDON_SPIKE
    const delta = isSpike
      ? (check.current - check.baseline) / check.baseline  // increase is bad
      : (check.baseline - check.current) / check.baseline  // decrease is bad

    if (delta < DROP_THRESHOLD) continue

    // Avoid duplicate unresolved alerts of the same type
    const existing = await db.journeyAlert.findFirst({
      where: { organizationId, type: check.type, resolvedAt: null },
    })
    if (existing) continue

    await db.journeyAlert.create({
      data: {
        organizationId,
        type: check.type,
        severity: delta >= 0.35 ? 'critical' : 'warning',
        metric: check.metric,
        currentValue: check.current,
        baselineValue: check.baseline,
        deltaPercent: delta,
      },
    })
  }
}
