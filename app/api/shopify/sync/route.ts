import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { syncProducts } from '@/features/shopify/sync'

export async function POST(request: Request) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  // Enqueue async — returnează imediat
  const jobId = `sync-${orgId}-${Date.now()}`
  syncProducts(orgId).catch((err) => {
    console.error(`[shopify/sync] job ${jobId} error:`, err)
  })

  return NextResponse.json({ jobId, status: 'queued' })
}
