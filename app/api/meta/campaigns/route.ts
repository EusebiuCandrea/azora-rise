import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { createCampaign } from "@/features/meta/client"

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const campaigns = await db.campaign.findMany({
    where: { organizationId },
    include: {
      metrics: { orderBy: { date: "desc" }, take: 30 },
      _count: { select: { adSets: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const enriched = campaigns.map((campaign) => {
    const totalSpend = campaign.metrics.reduce((sum, m) => sum + m.spend, 0)
    const totalPurchases = campaign.metrics.reduce((sum, m) => sum + m.purchases, 0)
    const latestRoas = campaign.metrics[0]?.roas ?? null
    const avgRoas =
      campaign.metrics.length > 0
        ? campaign.metrics.reduce((sum, m) => sum + (m.roas ?? 0), 0) / campaign.metrics.length
        : null

    return {
      ...campaign,
      summary: { totalSpend, totalPurchases, latestRoas, avgRoas, adSetsCount: campaign._count.adSets },
    }
  })

  return NextResponse.json({ campaigns: enriched })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { name, objective, dailyBudget, startDate, endDate } = await req.json()

  if (!name || !objective || !dailyBudget) {
    return NextResponse.json({ error: "Câmpuri obligatorii: name, objective, dailyBudget" }, { status: 400 })
  }

  const connection = await db.metaConnection.findUnique({ where: { organizationId } })
  if (!connection) {
    return NextResponse.json({ error: "Meta neconectat. Configurează conexiunea în Settings." }, { status: 400 })
  }

  const accessToken = decrypt(connection.accessTokenEncrypted)
  const { id: metaCampaignId } = await createCampaign(accessToken, connection.adAccountId, {
    name, objective, dailyBudget, startDate, endDate,
  })

  const campaign = await db.campaign.create({
    data: { organizationId, metaCampaignId, name, objective, budget: dailyBudget, status: "PAUSED",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  })

  return NextResponse.json({ campaign }, { status: 201 })
}
