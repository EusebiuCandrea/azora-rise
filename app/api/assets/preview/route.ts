import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { getPresignedDownloadUrl } from '@/lib/r2'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  // Asigură că cheia aparține org-ului curent (securitate multi-tenant)
  if (!key.startsWith(`${orgId}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = await getPresignedDownloadUrl(key)
  return NextResponse.redirect(url)
}
