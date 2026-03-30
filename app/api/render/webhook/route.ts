import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('X-Webhook-Signature')

  const secret = process.env.RENDER_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  // Constant-time comparison — pad buffers to equal length
  const sigBuffer = Buffer.from(signature.padEnd(expected.length, '\0'))
  const expBuffer = Buffer.from(expected)

  if (sigBuffer.length !== expBuffer.length || !timingSafeEqual(sigBuffer, expBuffer)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { jobId, status, videos } = JSON.parse(body) as {
    jobId: string
    status: string
    videos?: Record<string, string>
  }

  // The webhook jobId is the BullMQ job id, but ProductVideo stores the renderJobId.
  // Look up by renderJobId first, fall back to id (for test purposes).
  const video = await db.productVideo.findFirst({
    where: { renderJobId: jobId },
  })

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  await db.productVideo.update({
    where: { id: video.id },
    data: {
      status: status === 'completed' ? 'DONE' : 'FAILED',
      ...(videos ? { outputUrls: videos } : {}),
    },
  })

  return NextResponse.json({ received: true })
}
