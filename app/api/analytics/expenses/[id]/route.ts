import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { id } = await params
  const expense = await db.monthlyExpense.findFirst({ where: { id, organizationId: orgId } })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.monthlyExpense.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
