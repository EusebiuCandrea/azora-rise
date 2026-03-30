import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

const costSchema = z.object({
  cogs: z.number().min(0),
  supplierVatDeductible: z.boolean(),
  vatRate: z.number().min(0).max(1),
  returnRate: z.number().min(0).max(1),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  // Verifică că produsul aparține acestei organizații
  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const body = await request.json()
  const result = costSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid data', details: result.error.flatten() }, { status: 400 })
  }

  const cost = await db.productCost.upsert({
    where: { productId: id },
    create: { productId: id, ...result.data },
    update: result.data,
  })

  return NextResponse.json({ cost })
}
