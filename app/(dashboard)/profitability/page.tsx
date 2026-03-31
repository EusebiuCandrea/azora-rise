import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import Link from 'next/link'
import { calculateProductProfitability } from '@/lib/profitability-engine'
import { generateRecommendation } from '@/lib/recommendations'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, BarChart3 } from 'lucide-react'
import { ExpensesPanel } from '@/features/profitability/components/ExpensesPanel'

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] | undefined }>
}) {
  const { days: daysParam } = await searchParams
  const rawDays = Array.isArray(daysParam) ? daysParam[0] : daysParam
  const parsedDays = Number.parseInt(rawDays ?? '30', 10)
  const days = parsedDays === 30 || parsedDays === 60 || parsedDays === 90 ? parsedDays : 30

  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const org = await db.organization.findUnique({ where: { id: orgId } })
  if (!org) return null

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const periodEnd = new Date()
  const periodStartMs = Date.now() - days * 24 * 60 * 60 * 1000
  const periodStart = Number.isFinite(periodStartMs)
    ? new Date(periodStartMs)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const hasValidPeriodStart = !Number.isNaN(periodStart.getTime())
  const periodDateFilter = hasValidPeriodStart
    ? { gte: periodStart, lte: periodEnd }
    : { lte: periodEnd }

  if (!hasValidPeriodStart) {
    console.error('ProfitabilityPage received invalid periodStart', {
      daysParam,
      rawDays,
      parsedDays,
      days,
      periodStartMs,
    })
  }

  const eurToRon = org.eurToRonFixed ?? 4.97
  const taxConfig = {
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shopifyFeeRate: org.shopifyFeeRate,
    eurToRon,
    isVatPayer: org.isVatPayer,
  }

  const [products, campaignMetricsAgg, periodOrderItems] = await Promise.all([
    db.product.findMany({
      where: { organizationId: orgId },
      include: {
        cost: true,
        metaMappings: {
          include: {
            campaign: {
              include: {
                metrics: { where: { date: periodDateFilter } },
                _count: { select: { metaMappings: true } },
              },
            },
          },
        },
      },
    }),
    db.campaignMetrics.aggregate({
      where: {
        campaign: { organizationId: orgId },
        date: periodDateFilter,
      },
      _sum: { spend: true },
    }),
    // Fetch ALL order items for the period — match to products by shopifyProductId
    db.orderItem.findMany({
      where: {
        organizationId: orgId,
        order: {
          organizationId: orgId,
          financialStatus: { in: ['paid', 'partially_refunded', 'pending'] },
          processedAt: periodDateFilter,
        },
      },
      select: {
        shopifyProductId: true,
        quantity: true,
        price: true,
        order: {
          select: {
            id: true,
            totalShipping: true,
          },
        },
      },
    }),
  ])

  const totalMetaAdsSpend = campaignMetricsAgg._sum.spend ?? 0

  // Group order items by shopifyProductId
  // Pre-compute total item quantity per order for proportional shipping allocation
  const itemCountPerOrder = new Map<string, number>()
  for (const item of periodOrderItems) {
    const prev = itemCountPerOrder.get(item.order.id) ?? 0
    itemCountPerOrder.set(item.order.id, prev + item.quantity)
  }

  interface ProductSales {
    unitsSold: number
    grossRevenue: number
    customerShippingTotal: number
  }
  const salesByShopifyId = new Map<string, ProductSales>()

  for (const item of periodOrderItems) {
    const key = item.shopifyProductId
    if (!key) continue
    const existing = salesByShopifyId.get(key) ?? {
      unitsSold: 0,
      grossRevenue: 0,
      customerShippingTotal: 0,
    }
    existing.unitsSold += item.quantity
    existing.grossRevenue += item.price * item.quantity
    // Allocate shipping proportionally by item quantity in the order
    const totalItemsInOrder = itemCountPerOrder.get(item.order.id) ?? 1
    existing.customerShippingTotal += (item.quantity / totalItemsInOrder) * item.order.totalShipping
    salesByShopifyId.set(key, existing)
  }

  const rows = products.map((product) => {
    const sales = salesByShopifyId.get(product.shopifyId)
    const unitsSold = sales?.unitsSold ?? 0
    const grossRevenue = sales?.grossRevenue ?? 0
    const customerShippingTotal = sales?.customerShippingTotal ?? 0
    const adsSpendRon = product.metaMappings.reduce((sum, m) => {
      const campaignSpend = m.campaign.metrics.reduce((s, met) => s + met.spend, 0)
      const productCount = m.campaign._count.metaMappings || 1
      return sum + campaignSpend / productCount
    }, 0)
    const adsPurchases = product.metaMappings.reduce((sum, m) => {
      const campaignPurchases = m.campaign.metrics.reduce((s, met) => s + met.purchases, 0)
      const productCount = m.campaign._count.metaMappings || 1
      return sum + campaignPurchases / productCount
    }, 0)

    if (!product.cost) {
      return {
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        unitsSold,
        grossRevenue,
        netRevenue: grossRevenue,
        netProfit: null as number | null,
        netMarginPct: null as number | null,
        adsSpendRon,
        roas: null as number | null,
        recommendation: unitsSold === 0 ? 'DEAD_STOCK' as const : null,
        recommendationNote: null as string | null,
        hasCostData: false,
      }
    }

    const cost = product.cost
    const result = calculateProductProfitability(
      { unitsSold, grossRevenue, totalDiscounts: 0, customerShippingTotal },
      {
        cogs: cost.cogs,
        supplierVatDeductible: cost.supplierVatDeductible,
        shippingCost: org.shippingCostDefault,
        packagingCost: org.packagingCostDefault,
        vatRate: cost.vatRate,
        returnRate: cost.returnRate,
      },
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
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      unitsSold,
      grossRevenue: result.grossRevenue,
      netRevenue: result.netRevenue,
      netProfit: result.netProfit,
      netMarginPct: result.netMarginPct,
      adsSpendRon: result.adsSpendRon,
      roas: result.roas,
      recommendation: rec.type,
      recommendationNote: rec.note,
      hasCostData: true,
    }
  })

  rows.sort((a, b) => {
    if (a.netProfit === null && b.netProfit === null) return 0
    if (a.netProfit === null) return 1
    if (b.netProfit === null) return -1
    return b.netProfit - a.netProfit
  })

  const totalNetRevenue = rows.reduce((s, r) => s + (r.netRevenue ?? 0), 0)
  const totalNetProfit = rows.filter(r => r.netProfit !== null).reduce((s, r) => s + (r.netProfit ?? 0), 0)
  const totalAdsSpend = totalMetaAdsSpend
  const productsWithData = rows.filter(r => r.hasCostData && r.unitsSold > 0)
  const avgMargin = productsWithData.length > 0
    ? productsWithData.reduce((s, r) => s + (r.netMarginPct ?? 0), 0) / productsWithData.length
    : null

  const expenses = await db.monthlyExpense.findMany({
    where: { organizationId: orgId, year, month },
    orderBy: { category: 'asc' },
  })
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalNetProfitAdjusted = totalNetProfit - totalExpenses

  function RecommendationIcon({ type }: { type: string | null }) {
    if (!type) return null
    const icons: Record<string, React.ReactNode> = {
      SCALE_UP: <TrendingUp className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={2} />,
      MONITOR: <BarChart3 className="w-3.5 h-3.5 text-[#78716C]" strokeWidth={2} />,
      REVIEW_COSTS: <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" strokeWidth={2} />,
      KILL_ADS: <XCircle className="w-3.5 h-3.5 text-[#DC2626]" strokeWidth={2} />,
      DEAD_STOCK: <TrendingDown className="w-3.5 h-3.5 text-[#78716C]" strokeWidth={2} />,
      BREAK_EVEN: <CheckCircle2 className="w-3.5 h-3.5 text-[#D97706]" strokeWidth={2} />,
    }
    return <span title={type}>{icons[type] ?? null}</span>
  }

  function MarginCell({ margin }: { margin: number | null }) {
    if (margin === null) return <span className="text-[#78716C] text-xs">—</span>
    if (margin >= 30) return <span className="font-semibold text-[#16A34A]">{margin.toFixed(1)}%</span>
    if (margin >= 10) return <span className="font-semibold text-[#D97706]">{margin.toFixed(1)}%</span>
    return <span className="font-semibold text-[#DC2626]">{margin.toFixed(1)}%</span>
  }

  const CATEGORY_LABELS: Record<string, string> = {
    RENT: 'Chirie', SALARY: 'Salarii', COURIER: 'Curier', SOFTWARE: 'Software',
    MARKETING_OTHER: 'Marketing', ACCOUNTING: 'Contabilitate', BANK_FEES: 'Bănci', OTHER: 'Diverse',
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Profitabilitate</h1>
          <p className="text-sm text-[#78716C] mt-0.5">Ultimele {days} zile · date calculate din comenzi Shopify + costuri configurate</p>
        </div>
        <div className="flex items-center gap-1">
          {[30, 60, 90].map((d) => (
            <Link
              key={d}
              href={`?days=${d}`}
              className={`px-3 h-7 rounded-lg text-xs font-medium transition-colors ${
                days === d
                  ? 'bg-[#D4AF37] text-[#1C1917]'
                  : 'border border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#F5F5F4]'
              }`}
            >
              {d} zile
            </Link>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">Revenue net</p>
          <p className="text-[26px] font-bold text-[#1C1917] mt-2 leading-none">
            {totalNetRevenue > 0 ? `${totalNetRevenue.toFixed(0)} RON` : '—'}
          </p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">Profit net produse</p>
          <p className={`text-[26px] font-bold mt-2 leading-none ${totalNetProfitAdjusted >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
            {productsWithData.length > 0 ? `${totalNetProfitAdjusted.toFixed(0)} RON` : '—'}
          </p>
          {totalExpenses > 0 && (
            <p className="text-xs text-[#78716C] mt-1">
              Include cheltuieli: -{totalExpenses.toFixed(0)} RON
            </p>
          )}
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">Marjă medie</p>
          <p className={`text-[26px] font-bold mt-2 leading-none ${(avgMargin ?? 0) >= 20 ? 'text-[#D4AF37]' : 'text-[#1C1917]'}`}>
            {avgMargin !== null ? `${avgMargin.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wide">Cheltuieli ads</p>
          <p className="text-[26px] font-bold text-[#1C1917] mt-2 leading-none">
            {totalAdsSpend > 0 ? `${totalAdsSpend.toFixed(0)} RON` : '—'}
          </p>
          <p className="text-xs text-[#78716C] mt-1">Total Meta Ads · {days} zile</p>
        </div>
      </div>

      {/* Products table */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1C1917]">Produse ({rows.length})</h2>
          <Link href="/products" className="text-xs text-[#D4AF37] hover:underline">
            Configurează costuri →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F5F4] text-[#78716C] text-xs uppercase tracking-wide border-b border-[#E7E5E4]">
                <th className="text-left px-4 py-3">Produs</th>
                <th className="text-right px-4 py-3">Vândut</th>
                <th className="text-right px-4 py-3">Revenue net</th>
                <th className="text-right px-4 py-3">Profit net</th>
                <th className="text-right px-4 py-3">Marjă</th>
                <th className="text-right px-4 py-3">Ads spend</th>
                <th className="text-right px-4 py-3">ROAS</th>
                <th className="text-center px-4 py-3">Recomandare</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#78716C]">
                    Fără produse active.{' '}
                    <Link href="/products" className="text-[#D4AF37] hover:underline">Sincronizează Shopify</Link>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#E7E5E4] hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1C1917] line-clamp-1 max-w-[200px]">{row.title}</p>
                      {!row.hasCostData && (
                        <span className="text-[10px] text-[#D97706] bg-[#FFF7ED] px-1.5 py-0.5 rounded">sem costuri</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#78716C]">{row.unitsSold}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#1C1917]">
                      {row.netRevenue > 0 ? `${row.netRevenue.toFixed(0)} RON` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.netProfit !== null
                        ? <span className={`font-semibold ${row.netProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {row.netProfit.toFixed(0)} RON
                          </span>
                        : <span className="text-[#78716C]">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MarginCell margin={row.netMarginPct} />
                    </td>
                    <td className="px-4 py-3 text-right text-[#78716C]">
                      {row.adsSpendRon > 0 ? `${row.adsSpendRon.toFixed(0)} RON` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#D4AF37]">
                      {row.roas ? `${row.roas.toFixed(1)}×` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5" title={row.recommendationNote ?? ''}>
                        <RecommendationIcon type={row.recommendation} />
                        <span className="text-xs text-[#78716C]">{row.recommendation?.replaceAll('_', ' ')}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses section */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1C1917]">Cheltuieli manuale — {new Date(year, month - 1).toLocaleString('ro-RO', { month: 'long', year: 'numeric' })}</h2>
            <p className="text-xs text-[#78716C] mt-0.5">Total: {totalExpenses.toFixed(0)} RON</p>
          </div>
        </div>
        <ExpensesPanel expenses={expenses} year={year} month={month} />
      </div>
    </div>
  )
}
