import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { deleteR2Object } from '@/lib/r2'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await requireAuth()
    const orgId = await getCurrentOrgId(session)
    if (!orgId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const asset = await db.videoAsset.findFirst({
      where: { id, organizationId: orgId },
      select: {
        id: true,
        r2Key: true,
        renderedVersions: { select: { r2Key: true } },
      },
    })
    if (!asset) return NextResponse.json({ error: 'Asset negăsit' }, { status: 404 })

    // Șterge din R2: video sursă + toate randările (best-effort)
    await Promise.all([
      deleteR2Object(asset.r2Key).catch(() => {}),
      ...asset.renderedVersions.map((r) => deleteR2Object(r.r2Key).catch(() => {})),
    ])

    // Cascade în DB șterge automat randările (onDelete: Cascade pe parentAssetId)
    await db.videoAsset.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Eroare la ștergere' }, { status: 500 })
  }
}
