import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id: campaignId } = await params
  const { productId } = await req.json()

  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 })

  const campaign = await db.campaign.findFirst({ where: { id: campaignId, organizationId: orgId } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const product = await db.product.findFirst({ where: { id: productId, organizationId: orgId } })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  const mapping = await db.metaProductMapping.upsert({
    where: { campaignId_productId: { campaignId, productId } },
    create: {
      organizationId: orgId,
      campaignId,
      productId,
      mappingType: "MANUAL",
      createdBy: session.user?.id ?? "manual",
    },
    update: { mappingType: "MANUAL" },
  })

  return NextResponse.json({ success: true, mapping })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id: campaignId } = await params
  const { productId } = await req.json()

  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 })

  await db.metaProductMapping.deleteMany({
    where: { campaignId, productId, organizationId: orgId },
  })

  return NextResponse.json({ success: true })
}
