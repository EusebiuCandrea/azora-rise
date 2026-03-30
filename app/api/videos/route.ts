import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

const REMOTION_SERVICE_URL = process.env.REMOTION_SERVICE_URL ?? 'http://localhost:3001'
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET!

const createVideoSchema = z.object({
  productId: z.string().min(1),
  template: z.enum(['ProductShowcase', 'BeforeAfter', 'Slideshow']),
  formats: z.array(z.enum(['9x16', '4x5', '1x1', '16x9'])).min(1),
  params: z.record(z.string(), z.unknown()),
})

export async function GET() {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const videos = await db.productVideo.findMany({
    where: { product: { organizationId: orgId } },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { title: true } } },
  })

  return NextResponse.json(videos)
}

export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const parsed = createVideoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Date invalide', details: parsed.error.flatten() }, { status: 400 })
  }

  const { productId, template, formats, params } = parsed.data

  // Verify product belongs to org
  const product = await db.product.findFirst({
    where: { id: productId, organizationId: orgId },
  })
  if (!product) {
    return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })
  }

  // Create ProductVideo record
  const video = await db.productVideo.create({
    data: {
      productId,
      organizationId: orgId,
      template,
      formats,
      params: params as object,
      status: 'PENDING',
    },
  })

  // Dispatch to remotion-service
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/render/webhook`

  try {
    const renderRes = await fetch(`${REMOTION_SERVICE_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify({
        template,
        organizationId: orgId,
        params,
        formats,
        webhookUrl,
      }),
    })

    if (renderRes.ok) {
      const { jobId } = await renderRes.json()
      await db.productVideo.update({
        where: { id: video.id },
        data: { renderJobId: jobId, status: 'RENDERING' },
      })
    } else {
      await db.productVideo.update({
        where: { id: video.id },
        data: { status: 'FAILED' },
      })
    }
  } catch {
    await db.productVideo.update({
      where: { id: video.id },
      data: { status: 'FAILED' },
    })
  }

  return NextResponse.json({ videoId: video.id }, { status: 201 })
}
