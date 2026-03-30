import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { validateMetaToken } from "@/features/meta/client"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { syncCampaignsFromMeta } from "@/features/meta/campaigns-sync"

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { accessToken, adAccountId, pageId, pixelId } = await req.json()

  if (!adAccountId?.startsWith("act_")) {
    return NextResponse.json({ error: "Ad Account ID trebuie să înceapă cu 'act_'" }, { status: 400 })
  }

  const validation = await validateMetaToken(accessToken, adAccountId)
  if (!validation.valid) {
    return NextResponse.json({ error: `Token invalid: ${validation.reason}` }, { status: 400 })
  }

  const accessTokenEncrypted = encrypt(accessToken)

  await db.metaConnection.upsert({
    where: { organizationId },
    create: { organizationId, adAccountId, pageId: pageId || null, pixelId: pixelId || null, accessTokenEncrypted },
    update: { adAccountId, pageId: pageId || null, pixelId: pixelId || null, accessTokenEncrypted },
  })

  syncCampaignsFromMeta(organizationId).catch(console.error)

  return NextResponse.json({ success: true, adAccountId })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  await db.metaConnection.delete({ where: { organizationId } })

  return NextResponse.json({ success: true })
}
