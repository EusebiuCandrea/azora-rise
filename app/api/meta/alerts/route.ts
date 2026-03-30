import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const alerts = await db.campaignAlert.findMany({
    where: { organizationId, isResolved: false },
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { triggeredAt: "desc" },
  })

  return NextResponse.json({ alerts })
}
