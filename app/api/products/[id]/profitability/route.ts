import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { calculateProductProfitability } from '@/lib/profitability'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { id } = await params
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  // Verifică că produsul aparține organizației
  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
    include: { cost: true },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Setările organizației
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      shopifyFeeRate: true,
      incomeTaxType: true,
      shippingCostDefault: true,
      packagingCostDefault: true,
      isVatPayer: true,
    },
  })
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  // Costurile produsului (fallback dacă nu există configurare)
  const costInput = product.cost
    ? {
        cogs: product.cost.cogs,
        supplierVatDeductible: product.cost.supplierVatDeductible,
        vatRate: product.cost.vatRate,
        returnRate: product.cost.returnRate,
      }
    : {
        cogs: 0,
        supplierVatDeductible: false,
        vatRate: 0.21,
        returnRate: 0.05,
      }

  const orgSettings = {
    shopifyFeeRate: org.shopifyFeeRate,
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shippingCost: org.shippingCostDefault,
    packagingCost: org.packagingCostDefault,
    isVatPayer: org.isVatPayer,
  }

  const perUnitCalc = calculateProductProfitability(product.price, costInput, orgSettings)

  // Period support
  const periodDays = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('period') ?? '90')))
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

  // Date reale: comenzi cu acest produs în perioada selectată
  const orderItems = await db.orderItem.findMany({
    where: {
      organizationId: orgId,
      shopifyProductId: product.shopifyId,
      order: {
        processedAt: { gte: since },
        financialStatus: { in: ['paid', 'partially_refunded'] },
      },
    },
    select: {
      quantity: true,
      price: true,
      order: { select: { processedAt: true, orderNumber: true, financialStatus: true } },
    },
    orderBy: { order: { processedAt: 'desc' } },
  })

  const totalQuantitySold = orderItems.reduce((s, i) => s + i.quantity, 0)
  const totalRevenue = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalProfit = perUnitCalc.profitNet * totalQuantitySold

  return NextResponse.json({
    perUnit: {
      ...perUnitCalc,
      vatRateUsed: costInput.vatRate,
      shippingCostDisplay: orgSettings.shippingCost,
      packagingCostDisplay: orgSettings.packagingCost,
    },
    stats: {
      totalQuantitySold,
      totalRevenue,
      totalProfit,
      period: `${periodDays}d`,
    },
    recentOrderItems: orderItems.slice(0, 10),
    hasCostData: !!product.cost,
  })
}
