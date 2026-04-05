import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

const createSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = createSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Date invalide', details: result.error.flatten() }, { status: 400 })
  }

  const { productId, name } = result.data

  // Verify product belongs to this org
  const product = await db.product.findFirst({
    where: { id: productId, organizationId: orgId },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })

  try {
    const ad = await db.videoAd.create({
      data: { organizationId: orgId, productId, name },
      select: { id: true, name: true, productId: true },
    })
    return NextResponse.json(ad, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Există deja o reclamă cu acest nume pentru produsul selectat' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Eroare server' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const ads = await db.videoAd.findMany({
    where: { organizationId: orgId, productId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(ads)
}
