import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { updateCampaignStatus } from "@/features/meta/client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id } = await params
  const campaign = await db.campaign.findFirst({ where: { id, organizationId } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (campaign.metaCampaignId) {
    const connection = await db.metaConnection.findUnique({ where: { organizationId } })
    if (connection) {
      const accessToken = decrypt(connection.accessTokenEncrypted)
      await updateCampaignStatus(accessToken, campaign.metaCampaignId, "PAUSED")
    }
  }

  const updated = await db.campaign.update({ where: { id }, data: { status: "PAUSED" } })
  return NextResponse.json({ campaign: updated })
}
