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

  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
    include: {
      cost: true,
      metaMappings: {
        include: {
          campaign: {
            include: {
              _count: { select: { metaMappings: true } },
            },
          },
        },
      },
    },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

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

  // Period support
  const periodDays = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('period') ?? '90')))
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

  // Fetch order items — match by shopifyProductId (works even if productId is null)
  const orderItems = await db.orderItem.findMany({
    where: {
      organizationId: orgId,
      shopifyProductId: product.shopifyId,
      order: {
        processedAt: { gte: since },
        financialStatus: { in: ['paid', 'partially_refunded', 'pending'] },
      },
    },
    select: {
      quantity: true,
      price: true,
      order: {
        select: {
          id: true,
          processedAt: true,
          orderNumber: true,
          financialStatus: true,
          totalShipping: true,
        },
      },
    },
    orderBy: { order: { processedAt: 'desc' } },
  })

  const totalQuantitySold = orderItems.reduce((s, i) => s + i.quantity, 0)
  const totalRevenue = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)

  // Calculate net transport per unit (proportional: this product's items / total items in each order)
  // For simplicity in product detail: assume this product is the only/main product in each order
  // (full proportional allocation happens in the profitability page aggregation)
  const seenOrderIds = new Set<string>()
  let totalCustomerShipping = 0
  for (const item of orderItems) {
    if (!seenOrderIds.has(item.order.id)) {
      totalCustomerShipping += item.order.totalShipping
      seenOrderIds.add(item.order.id)
    }
  }
  const ordersCount = seenOrderIds.size
  const totalCourierCost = ordersCount * org.shippingCostDefault
  const netTransportTotal = totalCustomerShipping - totalCourierCost
  const netTransportPerUnit = totalQuantitySold > 0 ? netTransportTotal / totalQuantitySold : 0

  // Ads spend allocated to this product
  const periodDateFilter = { gte: since, lte: new Date() }
  const adsCampaignIds = product.metaMappings.map((m) => ({
    campaignId: m.campaignId,
    mappingCount: m.campaign._count.metaMappings || 1,
  }))

  let adsSpendRon = 0
  let adsPurchases = 0
  if (adsCampaignIds.length > 0) {
    const metricsResults = await Promise.all(
      adsCampaignIds.map(({ campaignId, mappingCount }) =>
        db.campaignMetrics.aggregate({
          where: { campaignId, date: periodDateFilter },
          _sum: { spend: true, purchases: true },
        }).then((agg) => ({
          spend: (agg._sum.spend ?? 0) / mappingCount,
          purchases: Math.round((agg._sum.purchases ?? 0) / mappingCount),
        }))
      )
    )
    adsSpendRon = metricsResults.reduce((s, r) => s + r.spend, 0)
    adsPurchases = metricsResults.reduce((s, r) => s + r.purchases, 0)
  }

  const orgSettings = {
    shopifyFeeRate: org.shopifyFeeRate,
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shippingCost: org.shippingCostDefault,
    packagingCost: org.packagingCostDefault,
    isVatPayer: org.isVatPayer,
    netTransportPerUnit,
  }

  const perUnitCalc = calculateProductProfitability(product.price, costInput, orgSettings)
  const totalProfit = perUnitCalc.profitNet * totalQuantitySold

  // Break-Even KPIs — Blueprint Formula (Sheet 3, L12)
  // ROAS_BE = AOV / (avgPriceExVat × (1 - fees%) - COGS)
  const avgPriceExVat = product.price / (1 + costInput.vatRate)
  const cppBeCalc = avgPriceExVat * (1 - org.shopifyFeeRate) - costInput.cogs
  const cppBe = cppBeCalc > 0 ? cppBeCalc : null
  const roasBe = cppBe != null ? product.price / cppBe : null

  // Target KPIs with 20% profit margin
  const TARGET_PROFIT_PCT = 0.20
  const cppTargetCalc = cppBe != null ? cppBe - product.price * TARGET_PROFIT_PCT : null
  const cppTarget = cppTargetCalc != null && cppTargetCalc > 0 ? cppTargetCalc : null
  const roasTarget = cppTarget != null ? product.price / cppTarget : null

  return NextResponse.json({
    perUnit: {
      ...perUnitCalc,
      vatRateUsed: costInput.vatRate,
      shippingCostDisplay: org.shippingCostDefault,
      packagingCostDisplay: org.packagingCostDefault,
      shopifyFeeRatePct: Math.round(org.shopifyFeeRate * 100),
      netTransportPerUnit,
      adsSpendPerUnit: totalQuantitySold > 0 ? adsSpendRon / totalQuantitySold : 0,
      cppBe,
      roasBe,
      cppTarget,
      roasTarget,
    },
    stats: {
      totalQuantitySold,
      totalRevenue,
      totalProfit,
      period: `${periodDays}d`,
      adsSpendRon,
      adsPurchases,
      adsRoas: totalRevenue > 0 && adsSpendRon > 0 ? totalRevenue / adsSpendRon : null,
    },
    recentOrderItems: orderItems.slice(0, 10),
    hasCostData: !!product.cost,
    isVatPayer: org.isVatPayer,
  })
}
