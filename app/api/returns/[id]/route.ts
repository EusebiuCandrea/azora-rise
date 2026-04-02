import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const { id } = await params

  const returnRecord = await db.return.findFirst({
    where: { id, organizationId: orgId },
    include: { order: { select: { id: true, orderNumber: true } } },
  })

  if (!returnRecord) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 })
  }

  return NextResponse.json(returnRecord)
}

const updateSchema = z.object({
  awbNumber: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  ibanHolder: z.string().optional().nullable(),
  status: z.enum(['NEW', 'RECEIVED', 'APPROVED', 'COMPLETED', 'REJECTED']).optional(),
  adminNotes: z.string().optional().nullable(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const { id } = await params

  const existing = await db.return.findFirst({
    where: { id, organizationId: orgId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await db.return.update({
    where: { id },
    data: {
      ...(parsed.data.awbNumber !== undefined && { awbNumber: parsed.data.awbNumber }),
      ...(parsed.data.iban !== undefined && { iban: parsed.data.iban }),
      ...(parsed.data.ibanHolder !== undefined && { ibanHolder: parsed.data.ibanHolder }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.adminNotes !== undefined && { adminNotes: parsed.data.adminNotes }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const { id } = await params

  const existing = await db.return.findFirst({
    where: { id, organizationId: orgId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 })
  }

  await db.return.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
