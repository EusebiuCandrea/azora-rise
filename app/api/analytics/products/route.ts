import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { calculateProductProfitability } from '@/lib/profitability-engine'
import { generateRecommendation } from '@/lib/recommendations'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const periodEnd = new Date()
  const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const org = await db.organization.findUnique({ where: { id: orgId } })
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const eurToRon = org.eurToRonFixed ?? 4.97
  const taxConfig = {
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shopifyFeeRate: org.shopifyFeeRate,
    eurToRon,
    isVatPayer: org.isVatPayer,
  }

  // Fetch products with order items in period
  const products = await db.product.findMany({
    where: { organizationId: orgId, status: 'active' },
    include: {
      cost: true,
      orderItems: {
        where: {
          order: {
            organizationId: orgId,
            financialStatus: { in: ['paid', 'partially_refunded'] },
            processedAt: { gte: periodStart, lte: periodEnd },
          },
        },
        include: { order: true },
      },
      metaMappings: {
        include: {
          campaign: {
            include: {
              metrics: {
                where: { date: { gte: periodStart, lte: periodEnd } },
              },
              _count: { select: { metaMappings: true } },
            },
          },
        },
      },
    },
  })

  const results = products.map((product) => {
    const unitsSold = product.orderItems.reduce((s, i) => s + i.quantity, 0)
    const grossRevenue = product.orderItems.reduce((s, i) => s + i.price * i.quantity, 0)

    if (unitsSold === 0 && !product.cost) {
      return {
        productId: product.id,
        productTitle: product.title,
        productHandle: product.handle,
        imageUrl: product.imageUrl,
        unitsSold: 0,
        netRevenue: 0,
        netProfit: 0,
        netMarginPct: 0,
        adsSpendRon: 0,
        roas: null,
        recommendation: 'DEAD_STOCK' as const,
        hasCostData: false,
        isStale: false,
      }
    }

    // Ads spend for this product via Meta mappings — split proportionally across mapped products
    const adsSpendRon = product.metaMappings.reduce((sum, mapping) => {
      const campaignSpend = mapping.campaign.metrics.reduce((s, m) => s + m.spend, 0)
      const productCount = mapping.campaign._count.metaMappings || 1
      return sum + campaignSpend / productCount
    }, 0)
    const adsPurchases = product.metaMappings.reduce((sum, mapping) => {
      const campaignPurchases = mapping.campaign.metrics.reduce((s, m) => s + m.purchases, 0)
      const productCount = mapping.campaign._count.metaMappings || 1
      return sum + campaignPurchases / productCount
    }, 0)

    if (!product.cost) {
      return {
        productId: product.id,
        productTitle: product.title,
        productHandle: product.handle,
        imageUrl: product.imageUrl,
        unitsSold,
        netRevenue: grossRevenue,
        netProfit: null,
        netMarginPct: null,
        adsSpendRon,
        roas: null,
        recommendation: null,
        hasCostData: false,
        isStale: false,
      }
    }

    const cost = product.cost
    const costConfig = {
      cogs: cost.cogs,
      supplierVatDeductible: cost.supplierVatDeductible,
      shippingCost: org.shippingCostDefault,
      packagingCost: org.packagingCostDefault,
      vatRate: cost.vatRate,
      returnRate: cost.returnRate,
    }

    const result = calculateProductProfitability(
      { unitsSold, grossRevenue, totalDiscounts: 0, customerShippingTotal: 0 },
      costConfig,
      taxConfig,
      { spendEur: 0, spendRon: adsSpendRon, purchases: adsPurchases }
    )

    const rec = generateRecommendation({
      netMarginPct: result.netMarginPct,
      adsRoas: result.roas,
      unitsSold,
      adsSpendRON: adsSpendRon,
      periodDays: days,
      maxSustainableAdsBudget: result.maxSustainableAdsBudget,
    })

    return {
      productId: product.id,
      productTitle: product.title,
      productHandle: product.handle,
      imageUrl: product.imageUrl,
      unitsSold,
      grossRevenue: result.grossRevenue,
      netRevenue: result.netRevenue,
      netProfit: result.netProfit,
      netMarginPct: result.netMarginPct,
      grossMarginPct: result.grossMarginPct,
      operatingMarginPct: result.operatingMarginPct,
      adsSpendRon: result.adsSpendRon,
      roas: result.roas,
      totalCogs: result.totalCogs,
      totalShipping: result.totalShipping,
      totalPackaging: result.totalPackaging,
      totalShopifyFee: result.totalShopifyFee,
      vatCollected: result.vatCollected,
      operatingProfit: result.operatingProfit,
      incomeTax: result.incomeTax,
      breakEvenUnits: result.breakEvenUnits === Infinity ? null : result.breakEvenUnits,
      maxSustainableAdsBudget: result.maxSustainableAdsBudget,
      recommendation: rec.type,
      recommendationNote: rec.note,
      hasCostData: true,
      isStale: false,
    }
  })

  // Sort by netProfit desc (products with cost data first)
  results.sort((a, b) => {
    if (a.netProfit === null && b.netProfit === null) return 0
    if (a.netProfit === null) return 1
    if (b.netProfit === null) return -1
    return b.netProfit - a.netProfit
  })

  return NextResponse.json({ products: results, periodDays: days })
}
