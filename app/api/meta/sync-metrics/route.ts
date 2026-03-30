import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { syncDailyMetrics } from "@/features/meta/campaigns-sync"
import { checkAlertsForOrganization } from "@/features/meta/alerts"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { organizationId, date } = body

  const orgIds: string[] = organizationId
    ? [organizationId]
    : await db.metaConnection.findMany({ select: { organizationId: true } })
        .then((conns) => conns.map((c) => c.organizationId))

  const results = []
  for (const orgId of orgIds) {
    const result = await syncDailyMetrics(orgId, date)
    await checkAlertsForOrganization(orgId)
    results.push({ organizationId: orgId, ...result })
  }

  return NextResponse.json({ success: true, results })
}
