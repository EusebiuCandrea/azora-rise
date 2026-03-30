import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { updateCampaignStatus, updateCampaignBudget } from "@/features/meta/client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id } = await params
  const campaign = await db.campaign.findFirst({
    where: { id, organizationId },
    include: {
      metrics: { orderBy: { date: "desc" }, take: 30 },
      adSets: {
        include: { _count: { select: { ads: true } } },
        orderBy: { createdAt: "asc" },
      },
      alerts: { where: { isResolved: false }, orderBy: { triggeredAt: "desc" } },
    },
  })

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ campaign })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id } = await params
  const { status, dailyBudget, name } = await req.json()

  const campaign = await db.campaign.findFirst({ where: { id, organizationId } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (campaign.metaCampaignId && (status || dailyBudget)) {
    const connection = await db.metaConnection.findUnique({ where: { organizationId } })
    if (connection) {
      const accessToken = decrypt(connection.accessTokenEncrypted)
      if (status) await updateCampaignStatus(accessToken, campaign.metaCampaignId, status)
      if (dailyBudget) await updateCampaignBudget(accessToken, campaign.metaCampaignId, dailyBudget)
    }
  }

  const updated = await db.campaign.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(dailyBudget && { budget: dailyBudget }),
      ...(name && { name }),
    },
  })

  return NextResponse.json({ campaign: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id } = await params
  const campaign = await db.campaign.findFirst({ where: { id, organizationId } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.campaign.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
