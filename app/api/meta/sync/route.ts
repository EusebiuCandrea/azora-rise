import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { syncCampaignsFromMeta, syncDailyMetrics } from "@/features/meta/campaigns-sync"

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const campaignsResult = await syncCampaignsFromMeta(organizationId)

  const from = new Date()
  from.setDate(from.getDate() - 30)
  const thirtyDaysAgo = from.toISOString().split("T")[0]
  const metricsResult = await syncDailyMetrics(organizationId, thirtyDaysAgo)

  return NextResponse.json({
    success: true,
    ...campaignsResult,
    metricsUpserted: metricsResult.metricsUpserted,
    syncedAt: new Date().toISOString(),
  })
}
