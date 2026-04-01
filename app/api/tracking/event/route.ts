import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

// ─── Rate limiting ─────────────────────────────────────────────────────────────

const rateMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT = 100
const RATE_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    // Cleanup stale entries periodically (roughly 1% of requests)
    if (Math.random() < 0.01) {
      for (const [key, val] of rateMap.entries()) {
        if (now > val.resetAt) rateMap.delete(key)
      }
    }
    return true
  }

  entry.count += 1
  if (entry.count > RATE_LIMIT) return false
  return true
}

// ─── Schema ────────────────────────────────────────────────────────────────────

const TrackingPayloadSchema = z.object({
  event: z.string().min(1).max(100),
  session_id: z.string().min(1).max(500),
  ad_source: z.string().max(500).optional(),
  organization_id: z.string().min(1),
  timestamp: z.number().int(),
  data: z.record(z.string(), z.unknown()),
})

type TrackingPayload = z.infer<typeof TrackingPayloadSchema>

// ─── Event → JourneySession field mapping ─────────────────────────────────────

function getJourneyTimestampField(
  event: string,
): 'reachedProductView' | 'reachedScrollToForm' | 'reachedFormStart' | 'reachedFormSubmit' | 'reachedOrderConfirmed' | null {
  switch (event) {
    case 'product_view':
      return 'reachedProductView'
    case 'scroll_to_form':
      return 'reachedScrollToForm'
    case 'form_interaction_start':
      return 'reachedFormStart'
    case 'form_submit_cod':
    case 'form_submit_card':
      return 'reachedFormSubmit'
    case 'order_confirmed':
      return 'reachedOrderConfirmed'
    default:
      return null
  }
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: CORS_HEADERS })
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  // Validate schema
  const parsed = TrackingPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400, headers: CORS_HEADERS })
  }

  const payload: TrackingPayload = parsed.data

  // Verify organization exists
  let orgExists: boolean
  try {
    const org = await db.organization.findUnique({
      where: { id: payload.organization_id },
      select: { id: true },
    })
    orgExists = org !== null
  } catch {
    return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
  }

  if (!orgExists) {
    return NextResponse.json({ ok: false, error: 'Organization not found' }, { status: 400, headers: CORS_HEADERS })
  }

  const eventTimestamp = new Date(payload.timestamp)
  const productId =
    typeof payload.data.product_id === 'string' ? payload.data.product_id : undefined

  // Save TrackingEvent
  try {
    await db.trackingEvent.create({
      data: {
        organizationId: payload.organization_id,
        sessionId: payload.session_id,
        adSource: payload.ad_source,
        event: payload.event,
        productId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: payload.data as any,
        createdAt: eventTimestamp,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
  }

  // Upsert JourneySession
  try {
    const timestampField = getJourneyTimestampField(payload.event)

    const isOrderConfirmed = payload.event === 'order_confirmed'
    const orderId =
      isOrderConfirmed && typeof payload.data.order_id === 'string'
        ? payload.data.order_id
        : undefined
    const paymentMethod =
      isOrderConfirmed && typeof payload.data.payment_method === 'string'
        ? payload.data.payment_method
        : undefined

    const timestampUpdate = timestampField ? { [timestampField]: eventTimestamp } : {}
    const adSourceUpdate = payload.ad_source ? { adSource: payload.ad_source } : {}
    const orderUpdate = isOrderConfirmed
      ? { ...(orderId !== undefined && { orderId }), ...(paymentMethod !== undefined && { paymentMethod }) }
      : {}

    await db.journeySession.upsert({
      where: { sessionId: payload.session_id },
      create: {
        organizationId: payload.organization_id,
        sessionId: payload.session_id,
        adSource: payload.ad_source,
        productId,
        campaignId: null,
        ...timestampUpdate,
      },
      update: {
        ...timestampUpdate,
        ...adSourceUpdate,
        ...orderUpdate,
        ...(productId !== undefined && { productId }),
      },
    })
  } catch {
    // Fire-and-forget: session upsert failure is non-fatal
    // TrackingEvent was already saved — return ok
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS })
}
