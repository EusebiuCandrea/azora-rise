import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { syncCampaignsFromMeta, syncDailyMetrics, syncAdSetMetrics, syncAdMetrics } from "@/features/meta/campaigns-sync"

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const campaignsResult = await syncCampaignsFromMeta(organizationId)

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [metricsResult, adSetMetricsResult, adMetricsResult] = await Promise.all([
    syncDailyMetrics(organizationId, thirtyDaysAgo, yesterday),
    syncAdSetMetrics(organizationId, thirtyDaysAgo, yesterday),
    syncAdMetrics(organizationId, thirtyDaysAgo, yesterday),
  ])

  return NextResponse.json({
    success: true,
    ...campaignsResult,
    metricsUpserted: metricsResult.metricsUpserted,
    adSetMetricsUpserted: adSetMetricsResult.metricsUpserted,
    adMetricsUpserted: adMetricsResult.metricsUpserted,
    syncedAt: new Date().toISOString(),
  })
}
