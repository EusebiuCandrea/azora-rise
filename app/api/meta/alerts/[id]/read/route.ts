import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id } = await params
  const alert = await db.campaignAlert.findFirst({ where: { id, organizationId } })
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await db.campaignAlert.update({ where: { id }, data: { isRead: true } })
  return NextResponse.json({ alert: updated })
}
