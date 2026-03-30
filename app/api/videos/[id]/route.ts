import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const video = await db.productVideo.findFirst({
    where: {
      id,
      product: { organizationId: orgId },
    },
    include: {
      product: { select: { title: true, imageUrl: true } },
    },
  })

  if (!video) {
    return NextResponse.json({ error: 'Video negăsit' }, { status: 404 })
  }

  return NextResponse.json(video)
}
