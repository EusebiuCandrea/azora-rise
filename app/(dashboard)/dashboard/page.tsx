import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { TrendingUp, TrendingDown, ArrowUpRight, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { calculateProductProfitability } from '@/lib/profitability-engine'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  const firstName = session.user?.name?.split(' ')[0] ?? session.user?.email?.split('@')[0] ?? 'Eusebiu'

  if (!orgId) {
    return (
      <div className="space-y-6 max-w-[1200px]">
        <h1 className="text-[22px] font-bold text-[#1C1917]">Panou de control</h1>
        <p className="text-sm text-[#78716C]">Configurează organizația pentru a vedea datele.</p>
      </div>
    )
  }

  const org = await db.organization.findUnique({ where: { id: orgId } })
  if (!org) return null

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0, 23, 59, 59)

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prevStart = new Date(prevYear, prevMonth - 1, 1)
  const prevEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59)

  const eurToRon = org.eurToRonFixed ?? 4.97
  const taxConfig = {
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shopifyFeeRate: org.shopifyFeeRate,
    eurToRon,
    isVatPayer: org.isVatPayer,
  }

  const [orders, prevOrders, campaignMetrics, prevCampaignMetrics, manualExpenses, activeCampaigns, orderItemsInPeriod] =
    await Promise.all([
      db.order.findMany({
        where: {
          organizationId: orgId,
          financialStatus: { in: ['paid', 'partially_refunded', 'pending'] },
          processedAt: { gte: periodStart, lte: periodEnd },
        },
        include: { items: { include: { product: { include: { cost: true } } } } },
      }),
      db.order.findMany({
        where: {
          organizationId: orgId,
          financialStatus: { in: ['paid', 'partially_refunded', 'pending'] },
          processedAt: { gte: prevStart, lte: prevEnd },
        },
      }),
      db.campaignMetrics.findMany({
        where: { campaign: { organizationId: orgId }, date: { gte: periodStart, lte: periodEnd } },
      }),
      db.campaignMetrics.findMany({
        where: { campaign: { organizationId: orgId }, date: { gte: prevStart, lte: prevEnd } },
      }),
      db.monthlyExpense.findMany({ where: { organizationId: orgId, year, month } }),
      db.campaign.findMany({
        where: { organizationId: orgId, status: 'ACTIVE' },
        include: {
          metrics: { where: { date: { gte: periodStart, lte: periodEnd } }, orderBy: { date: 'desc' } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      db.orderItem.findMany({
        where: {
          organizationId: orgId,
          order: {
            organizationId: orgId,
            financialStatus: { in: ['paid', 'partially_refunded', 'pending'] },
            processedAt: { gte: periodStart, lte: periodEnd },
          },
        },
        include: {
          product: { include: { cost: true } },
        },
      }),
    ])

  const grossRevenue = orders.reduce((s, o) => s + o.totalPrice, 0)
  const prevRevenue = prevOrders.reduce((s, o) => s + o.totalPrice, 0)
  const totalAdsSpend = campaignMetrics.reduce((s, m) => s + m.spend, 0)
  const prevAdsSpend = prevCampaignMetrics.reduce((s, m) => s + m.spend, 0)
  const totalManualExpenses = manualExpenses.reduce((s, e) => s + e.amount, 0)
  const avgRoas = totalAdsSpend > 0 ? grossRevenue / totalAdsSpend : null
  const prevAvgRoas = prevAdsSpend > 0 ? prevRevenue / prevAdsSpend : null

  let totalCogs = 0
  let totalShipping = 0
  let totalPackaging = 0
  let totalShopifyFees = 0
  let totalReturnProvision = 0

  for (const order of orders) {
    for (const item of order.items) {
      if (item.product?.cost) {
        const cost = item.product.cost
        const result = calculateProductProfitability(
          { unitsSold: item.quantity, grossRevenue: item.price * item.quantity, totalDiscounts: 0, customerShippingTotal: 0 },
          {
            cogs: cost.cogs,
            supplierVatDeductible: cost.supplierVatDeductible,
            shippingCost: org.shippingCostDefault,
            packagingCost: org.packagingCostDefault,
            vatRate: cost.vatRate,
            returnRate: cost.returnRate,
          },
          taxConfig
        )
        totalCogs += result.totalCogs
        totalShipping += result.totalShipping
        totalPackaging += result.totalPackaging
        totalShopifyFees += result.totalShopifyFee
        totalReturnProvision += result.returnProvision
      } else {
        totalShopifyFees += item.price * item.quantity * org.shopifyFeeRate
      }
    }
  }

  const netRevenue = grossRevenue * (1 - org.shopifyFeeRate)
  const grossProfit = netRevenue - totalCogs
  const operatingProfit =
    grossProfit - totalShipping - totalPackaging - totalShopifyFees - totalReturnProvision - totalManualExpenses - totalAdsSpend
  let incomeTax = 0
  if (taxConfig.incomeTaxType === 'MICRO_1') incomeTax = netRevenue * 0.01
  else if (taxConfig.incomeTaxType === 'MICRO_3') incomeTax = netRevenue * 0.03
  else incomeTax = Math.max(0, operatingProfit) * 0.16
  const netProfit = operatingProfit - incomeTax

  const uniqueShopifyProductIds = [...new Set(orderItemsInPeriod.map((item) => item.shopifyProductId).filter(Boolean))]
  const fallbackProducts = uniqueShopifyProductIds.length
    ? await db.product.findMany({
        where: {
          organizationId: orgId,
          shopifyId: { in: uniqueShopifyProductIds },
        },
        include: { cost: true },
      })
    : []
  const fallbackProductsByShopifyId = new Map(fallbackProducts.map((product) => [product.shopifyId, product]))

  const productStats = new Map<
    string,
    {
      product: NonNullable<(typeof orderItemsInPeriod)[number]['product']> | (typeof fallbackProducts)[number]
      unitsSold: number
      revenue: number
    }
  >()

  for (const item of orderItemsInPeriod) {
    const resolvedProduct = item.product ?? fallbackProductsByShopifyId.get(item.shopifyProductId)
    if (!resolvedProduct?.cost) continue

    const existing = productStats.get(resolvedProduct.id)
    if (existing) {
      existing.unitsSold += item.quantity
      existing.revenue += item.price * item.quantity
    } else {
      productStats.set(resolvedProduct.id, {
        product: resolvedProduct,
        unitsSold: item.quantity,
        revenue: item.price * item.quantity,
      })
    }
  }

  const productProfits = [...productStats.values()]
    .map(({ product, unitsSold, revenue }) => {
      if (unitsSold === 0 || !product.cost) return null
      const result = calculateProductProfitability(
        { unitsSold, grossRevenue: revenue, totalDiscounts: 0, customerShippingTotal: 0 },
        {
          cogs: product.cost.cogs,
          supplierVatDeductible: product.cost.supplierVatDeductible,
          shippingCost: org.shippingCostDefault,
          packagingCost: org.packagingCostDefault,
          vatRate: product.cost.vatRate,
          returnRate: product.cost.returnRate,
        },
        taxConfig
      )
      return { product, netProfit: result.netProfit, netMarginPct: result.netMarginPct }
    })
    .filter(Boolean)
    .sort((a, b) => b!.netProfit - a!.netProfit)
    .slice(0, 5) as Array<{ product: (typeof fallbackProducts)[number]; netProfit: number; netMarginPct: number }>

  const revenueGrowth = prevRevenue > 0 ? ((grossRevenue - prevRevenue) / prevRevenue) * 100 : null
  const adsGrowth = prevAdsSpend > 0 ? ((totalAdsSpend - prevAdsSpend) / prevAdsSpend) * 100 : null
  const roasGrowth = prevAvgRoas && avgRoas ? avgRoas - prevAvgRoas : null
  const visibleActiveCampaigns = activeCampaigns.filter((campaign) => campaign.status === 'ACTIVE')

  function GrowthBadge({
    value,
    suffix = '%',
    invert = false,
  }: {
    value: number | null
    suffix?: string
    invert?: boolean
  }) {
    if (value === null) return <span className="text-xs text-[#78716C]">—</span>
    const positive = invert ? value < 0 : value >= 0
    const color = positive ? '#16A34A' : '#DC2626'
    const Icon = positive ? TrendingUp : TrendingDown
    return (
      <div className="flex items-center gap-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
        <span className="text-xs font-medium" style={{ color }}>
          {value >= 0 ? '+' : ''}
          {value.toFixed(1)}
          {suffix} față de luna trecută
        </span>
      </div>
    )
  }

  function MarginBadge({ margin }: { margin: number }) {
    if (margin >= 30)
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
          {margin.toFixed(0)}%
        </span>
      )
    if (margin >= 10)
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FFF7ED] text-[#D97706]">
          {margin.toFixed(0)}%
        </span>
      )
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF2F2] text-[#DC2626]">
        {margin.toFixed(0)}%
      </span>
    )
  }

  const monthName = new Date(year, month - 1).toLocaleString('ro-RO', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Panou de control</h1>
          <p className="text-sm text-[#78716C] mt-0.5 capitalize">
            Bună ziua, {firstName} · {monthName}
          </p>
        </div>
        <Link
          href="/profitability"
          className="flex items-center gap-2 px-4 h-9 border border-[#E7E5E4] bg-white rounded-lg text-sm text-[#1C1917] hover:bg-[#F5F5F4] transition-colors"
        >
          Profitabilitate detaliată
          <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">Vânzări totale</p>
          <p className="text-[28px] font-bold text-[#1C1917] mt-2 leading-none">
            {grossRevenue > 0 ? `${grossRevenue.toFixed(0)} RON` : '—'}
          </p>
          <div className="mt-2">
            <GrowthBadge value={revenueGrowth} />
          </div>
          <p className="text-xs text-[#78716C] mt-1">{orders.length} comenzi</p>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">Cheltuieli publicitate</p>
          <p className="text-[28px] font-bold text-[#1C1917] mt-2 leading-none">
            {totalAdsSpend > 0 ? `${totalAdsSpend.toFixed(0)} RON` : '—'}
          </p>
          <div className="mt-2">
            <GrowthBadge value={adsGrowth} invert />
          </div>
          <p className="text-xs text-[#78716C] mt-1">Meta Ads</p>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">ROAS mediu</p>
          <p className="text-[28px] font-bold text-[#D4AF37] mt-2 leading-none">
            {avgRoas ? `${avgRoas.toFixed(1)}×` : '—'}
          </p>
          <div className="mt-2">
            {roasGrowth !== null ? (
              <GrowthBadge value={roasGrowth} suffix="×" />
            ) : (
              <span className="text-xs text-[#78716C]">—</span>
            )}
          </div>
          <p className="text-xs text-[#78716C] mt-1">Return on ad spend</p>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">Profit net calculat</p>
          <p
            className={`text-[28px] font-bold mt-2 leading-none ${netProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}
          >
            {grossRevenue > 0 ? `${netProfit.toFixed(0)} RON` : '—'}
          </p>
          <div className="mt-2">
            {grossRevenue > 0 && netRevenue > 0 && (
              <span className="text-xs text-[#78716C]">
                Marjă netă: {((netProfit / netRevenue) * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-[#78716C] mt-1">după costuri + taxe</p>
        </div>
      </div>

      {/* Middle row: top products + active campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1C1917] mb-4">Top produse după profit</h2>
          {productProfits.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#78716C]">
              <p>Fără comenzi luna aceasta</p>
              <p className="text-xs mt-1">Sincronizează comenzile Shopify pentru date reale</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productProfits.map(({ product, netProfit: profit, netMarginPct: margin }, i) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F5F4] flex items-center justify-center flex-shrink-0 text-[#78716C] text-xs font-semibold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1C1917] truncate">{product.title}</p>
                    <p className="text-xs text-[#78716C]">{profit.toFixed(0)} RON profit</p>
                  </div>
                  <MarginBadge margin={margin} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-[#E7E5E4]">
            <Link href="/profitability" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
              Profitabilitate completă <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E5E4]">
            <h2 className="text-sm font-semibold text-[#1C1917]">Campanii active</h2>
          </div>
          {visibleActiveCampaigns.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#78716C]">
              Nicio campanie.{' '}
              <Link href="/campaigns" className="text-[#D4AF37] hover:underline">
                Sincronizează Meta Ads
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F5F4]">
                  {['Campanie', 'Stare', 'Buget/zi', 'ROAS', 'Achiziții'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleActiveCampaigns.map((c) => {
                  const purchases = c.metrics.reduce((s, m) => s + m.purchases, 0)
                  const totalSpend = c.metrics.reduce((s, m) => s + m.spend, 0)
                  const totalPurchaseValue = c.metrics.reduce((s, m) => s + (m.purchaseValue ?? 0), 0)
                  const avgMetricRoas = totalSpend > 0 && totalPurchaseValue > 0 ? totalPurchaseValue / totalSpend : null
                  return (
                    <tr key={c.id} className="border-t border-[#E7E5E4] hover:bg-[#FAFAF9] transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="text-sm font-medium text-[#1C1917] hover:text-[#B8971F] transition-colors line-clamp-1 block max-w-[160px]"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-[#78716C] mt-0.5">{c.objective}</p>
                      </td>
                      <td className="px-4 py-3">
                        {c.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                            Activ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FFF7ED] text-[#D97706]">
                            Pauză
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#1C1917]">
                        {c.budget > 0 ? `${c.budget} RON` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#D4AF37]">
                        {avgMetricRoas ? `${avgMetricRoas.toFixed(1)}×` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#1C1917]">{purchases}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
          <div className="px-5 py-3 border-t border-[#E7E5E4] flex justify-end">
            <Link href="/campaigns" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
              Mergi la Campanii <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Waterfall */}
      {grossRevenue > 0 && (
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1C1917] mb-4">
            Waterfall profitabilitate — {monthName}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-1.5 text-sm">
            {[
              { label: 'Revenue brut', value: grossRevenue, color: '#16A34A', plus: true },
              { label: 'COGS (cost marfă)', value: -totalCogs, color: '#DC2626' },
              { label: 'Transport + ambalaj', value: -(totalShipping + totalPackaging), color: '#DC2626' },
              { label: 'Comision Shopify', value: -totalShopifyFees, color: '#D97706' },
              { label: 'Cheltuieli publicitate', value: -totalAdsSpend, color: '#DC2626' },
              { label: 'Cheltuieli manuale', value: -totalManualExpenses, color: '#D97706' },
              { label: 'Impozit venit', value: -incomeTax, color: '#D97706' },
            ].map(({ label, value, color, plus }) => (
              <div key={label} className="flex justify-between items-center py-1 border-b border-[#F5F5F4]">
                <span className="text-[#78716C]">{label}</span>
                <span className="font-medium tabular-nums" style={{ color }}>
                  {plus ? '+' : ''}
                  {value.toFixed(0)} RON
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center py-1.5 col-span-2 border-t-2 border-[#E7E5E4] mt-1">
              <span className="font-semibold text-[#1C1917]">PROFIT NET</span>
              <span
                className={`text-lg font-bold tabular-nums ${netProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}
              >
                {netProfit >= 0 ? '+' : ''}
                {netProfit.toFixed(0)} RON
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
