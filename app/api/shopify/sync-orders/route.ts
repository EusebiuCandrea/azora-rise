import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { syncOrders } from '@/features/shopify/orders-sync'

export async function POST() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  try {
    const result = await syncOrders(orgId)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Orders sync already in progress') {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('SHOPIFY_MISSING_SCOPE')) {
      return NextResponse.json({
        error: 'Lipsă permisiuni Shopify. Adaugă scopul read_orders în Custom App și regenerează token-ul.',
      }, { status: 403 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
