import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { calculateJourneySnapshot } from '@/lib/journey/snapshot'

export async function POST() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const [s7, s30, s90] = await Promise.all([
    calculateJourneySnapshot(orgId, 7),
    calculateJourneySnapshot(orgId, 30),
    calculateJourneySnapshot(orgId, 90),
  ])

  return NextResponse.json({ ok: true, snapshots: [s7.id, s30.id, s90.id] })
}
