import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get("days") ?? "30", 10)

  const campaign = await db.campaign.findFirst({ where: { id, organizationId } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)

  const metrics = await db.campaignMetrics.findMany({
    where: { campaignId: id, date: { gte: dateFrom } },
    orderBy: { date: "desc" },
  })

  return NextResponse.json({ metrics })
}
