import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { calculateProductProfitability } from '@/lib/profitability-engine'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0, 23, 59, 59)

  const org = await db.organization.findUnique({ where: { id: orgId } })
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const eurToRon = org.eurToRonFixed ?? 4.97
  const taxConfig = {
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shopifyFeeRate: org.shopifyFeeRate,
    eurToRon,
    isVatPayer: org.isVatPayer,
  }

  // All paid orders this month
  const orders = await db.order.findMany({
    where: {
      organizationId: orgId,
      financialStatus: { in: ['paid', 'partially_refunded'] },
      processedAt: { gte: periodStart, lte: periodEnd },
    },
    include: { items: { include: { product: { include: { cost: true } } } } },
  })

  // Meta ads spend this month
  const campaignMetrics = await db.campaignMetrics.findMany({
    where: {
      campaign: { organizationId: orgId },
      date: { gte: periodStart, lte: periodEnd },
    },
  })

  const totalAdsSpend = campaignMetrics.reduce((s, m) => s + m.spend, 0)
  const totalAdsPurchases = campaignMetrics.reduce((s, m) => s + m.purchases, 0)

  // Manual expenses this month
  const manualExpenses = await db.monthlyExpense.findMany({
    where: { organizationId: orgId, year, month },
  })
  const totalManualExpenses = manualExpenses.reduce((s, e) => s + e.amount, 0)

  // Aggregate per product
  const grossRevenue = orders.reduce((s, o) => s + o.totalPrice, 0)
  const refunds = orders.filter(o => o.financialStatus === 'partially_refunded')
    .reduce((s, o) => s + (o.totalPrice * 0.1), 0) // estimate

  let totalCogs = 0
  let totalShipping = 0
  let totalPackaging = 0
  let totalShopifyFees = 0
  let totalReturnProvision = 0
  let totalVatCollected = 0
  let totalVatDeductible = 0

  for (const order of orders) {
    for (const item of order.items) {
      const unitsSold = item.quantity
      const itemRevenue = item.price * item.quantity

      if (item.product?.cost) {
        const cost = item.product.cost
        const costConfig = {
          cogs: cost.cogs,
          supplierVatDeductible: cost.supplierVatDeductible,
          shippingCost: org.shippingCostDefault,
          packagingCost: org.packagingCostDefault,
          vatRate: cost.vatRate,
          returnRate: cost.returnRate,
        }

        const result = calculateProductProfitability(
          { unitsSold, grossRevenue: itemRevenue, totalDiscounts: 0, customerShippingTotal: 0, ordersCount: 0 },
          costConfig,
          taxConfig
        )

        totalCogs += result.totalCogs
        totalShipping += result.totalShipping
        totalPackaging += result.totalPackaging
        totalShopifyFees += result.totalShopifyFee
        totalReturnProvision += result.returnProvision
        totalVatCollected += result.vatCollected
        totalVatDeductible += result.vatDeductibleAmount
      } else {
        totalShopifyFees += itemRevenue * taxConfig.shopifyFeeRate
        totalVatCollected += itemRevenue * 0.19 / 1.19
      }
    }
  }

  const netRevenue = grossRevenue - refunds
  const grossProfit = netRevenue - totalCogs
  const operatingProfit = grossProfit - totalShipping - totalPackaging - totalShopifyFees - totalReturnProvision - totalManualExpenses - totalAdsSpend

  let incomeTax = 0
  if (taxConfig.incomeTaxType === 'MICRO_1') {
    incomeTax = netRevenue * 0.01
  } else if (taxConfig.incomeTaxType === 'MICRO_3') {
    incomeTax = netRevenue * 0.03
  } else {
    incomeTax = Math.max(0, operatingProfit) * 0.16
  }

  const netProfit = operatingProfit - incomeTax
  const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0

  // Prev month for comparison
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prevStart = new Date(prevYear, prevMonth - 1, 1)
  const prevEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59)

  const prevOrders = await db.order.findMany({
    where: {
      organizationId: orgId,
      financialStatus: { in: ['paid', 'partially_refunded'] },
      processedAt: { gte: prevStart, lte: prevEnd },
    },
  })
  const prevRevenue = prevOrders.reduce((s, o) => s + o.totalPrice, 0)

  const prevMetrics = await db.campaignMetrics.findMany({
    where: {
      campaign: { organizationId: orgId },
      date: { gte: prevStart, lte: prevEnd },
    },
  })
  const prevAdsSpend = prevMetrics.reduce((s, m) => s + m.spend, 0)

  const prevExpenses = await db.monthlyExpense.findMany({
    where: { organizationId: orgId, year: prevYear, month: prevMonth },
  })
  const prevManualExpenses = prevExpenses.reduce((s, e) => s + e.amount, 0)

  // Simplified prev month profit estimate
  const prevNetRevenue = prevRevenue * 0.95
  const prevEstimatedCosts = prevRevenue * (totalCogs / Math.max(grossRevenue, 1))
  const prevOperatingProfit = prevNetRevenue - prevEstimatedCosts - prevAdsSpend - prevManualExpenses
  let prevIncomeTax = 0
  if (taxConfig.incomeTaxType === 'MICRO_1') prevIncomeTax = prevNetRevenue * 0.01
  else if (taxConfig.incomeTaxType === 'MICRO_3') prevIncomeTax = prevNetRevenue * 0.03
  else prevIncomeTax = Math.max(0, prevOperatingProfit) * 0.16
  const prevNetProfit = prevOperatingProfit - prevIncomeTax

  const growthPct = prevNetProfit !== 0
    ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
    : null

  return NextResponse.json({
    year,
    month,
    ordersCount: orders.length,
    grossRevenue,
    netRevenue,
    totalCogs,
    totalShipping,
    totalPackaging,
    totalShopifyFees,
    totalAdsSpend,
    totalAdsPurchases,
    totalManualExpenses,
    totalReturnProvision,
    totalVatCollected,
    totalVatDeductible,
    grossProfit,
    operatingProfit,
    incomeTax,
    netProfit,
    netMarginPct,
    eurToRon,
    prevMonthNetProfit: prevNetProfit,
    growthPct,
    avgRoas: totalAdsSpend > 0 ? netRevenue / totalAdsSpend : null,
  })
}
