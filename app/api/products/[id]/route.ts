import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
    include: { cost: true },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ product })
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const body = await request.json()
  const updated = await db.product.update({
    where: { id },
    data: body,
  })

  return NextResponse.json({ product: updated })
}
