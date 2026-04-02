import { db } from '@/lib/db'

export interface ProductBreakdownItem {
  productId: string
  productName: string
  imageUrl: string | null
  visits: number
  scrollToForm: number
  formStarts: number
  formSubmits: number
  orders: number
  abandonRate: number
}

export interface CampaignBreakdownItem {
  campaignId: string
  name: string
  status: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  sessions: number
  orders: number
  conversionRate: number
}

export interface JourneySnapshotData {
  id: string
  organizationId: string
  date: Date
  periodDays: number
  totalImpressions: number
  totalAdClicks: number
  totalProductViews: number
  totalScrollToForm: number
  totalFormStarts: number
  totalFormSubmits: number
  totalOrders: number
  ctrAd: number
  rateVisitToScroll: number
  rateScrollToStart: number
  rateStartToSubmit: number
  rateSubmitToOrder: number
  overallConversion: number
  totalReturns: number
  totalUndelivered: number
  returnRate: number
  undeliveredRate: number
  avgFormCompletionSec: number
  productBreakdown: ProductBreakdownItem[]
  campaignBreakdown: CampaignBreakdownItem[]
  ga4Data?: unknown
  createdAt: Date
}

export async function calculateJourneySnapshot(
  orgId: string,
  periodDays: 7 | 30 | 90,
): Promise<JourneySnapshotData> {
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

  // Fetch Meta ad metrics (impressions/clicks) via Campaign relation
  const campaignMetrics = await db.campaignMetrics.findMany({
    where: {
      date: { gte: startDate },
      campaign: { organizationId: orgId, status: 'ACTIVE' },
    },
    select: { impressions: true, clicks: true },
  })

  const totalImpressions = campaignMetrics.reduce((s, m) => s + (m.impressions ?? 0), 0)
  const totalAdClicks = campaignMetrics.reduce((s, m) => s + (m.clicks ?? 0), 0)

  const sessions = await db.journeySession.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: startDate },
    },
    select: {
      productId: true,
      campaignId: true,
      reachedProductView: true,
      reachedScrollToForm: true,
      reachedFormStart: true,
      reachedFormSubmit: true,
      reachedOrderConfirmed: true,
    },
  })

  // Avg form completion time: sessions that have both form start and submit timestamps
  const completedFormSessions = sessions.filter(
    (s) => s.reachedFormStart != null && s.reachedFormSubmit != null,
  )
  const avgFormCompletionSec =
    completedFormSessions.length > 0
      ? completedFormSessions.reduce((sum, s) => {
          const ms = s.reachedFormSubmit!.getTime() - s.reachedFormStart!.getTime()
          return sum + Math.max(ms, 0)
        }, 0) /
        completedFormSessions.length /
        1000
      : 0

  // Funnel counts
  const totalProductViews = sessions.filter((s) => s.reachedProductView != null).length
  const totalScrollToForm = sessions.filter((s) => s.reachedScrollToForm != null).length
  const totalFormStarts = sessions.filter((s) => s.reachedFormStart != null).length
  const totalFormSubmits = sessions.filter((s) => s.reachedFormSubmit != null).length
  const totalOrders = sessions.filter((s) => s.reachedOrderConfirmed != null).length

  // Conversion rates (protected against division by zero)
  const rateVisitToScroll = totalProductViews > 0 ? totalScrollToForm / totalProductViews : 0
  const rateScrollToStart = totalScrollToForm > 0 ? totalFormStarts / totalScrollToForm : 0
  const rateStartToSubmit = totalFormStarts > 0 ? totalFormSubmits / totalFormStarts : 0
  const rateSubmitToOrder = totalFormSubmits > 0 ? totalOrders / totalFormSubmits : 0
  const overallConversion = totalProductViews > 0 ? totalOrders / totalProductViews : 0

  // Product breakdown
  const productMap = new Map<
    string,
    { visits: number; scrollToForm: number; formStarts: number; formSubmits: number; orders: number }
  >()

  for (const s of sessions) {
    if (!s.productId) continue
    const existing = productMap.get(s.productId) ?? {
      visits: 0,
      scrollToForm: 0,
      formStarts: 0,
      formSubmits: 0,
      orders: 0,
    }
    if (s.reachedProductView != null) existing.visits++
    if (s.reachedScrollToForm != null) existing.scrollToForm++
    if (s.reachedFormStart != null) existing.formStarts++
    if (s.reachedFormSubmit != null) existing.formSubmits++
    if (s.reachedOrderConfirmed != null) existing.orders++
    productMap.set(s.productId, existing)
  }

  // Resolve Shopify product IDs → names
  const shopifyIds = Array.from(productMap.keys()).filter(Boolean)
  const products = shopifyIds.length > 0
    ? await db.product.findMany({
        where: { organizationId: orgId, shopifyId: { in: shopifyIds } },
        select: { shopifyId: true, title: true, imageUrl: true },
      })
    : []
  const productInfoMap = new Map(products.map((p) => [p.shopifyId, { title: p.title, imageUrl: p.imageUrl }]))

  const productBreakdown: ProductBreakdownItem[] = Array.from(productMap.entries()).map(
    ([productId, counts]) => {
      const info = productInfoMap.get(productId)
      return {
        productId,
        productName: info?.title ?? productId,
        imageUrl: info?.imageUrl ?? null,
        ...counts,
        abandonRate:
          counts.formStarts > 0
            ? (counts.formStarts - counts.formSubmits) / counts.formStarts
            : 0,
      }
    },
  )

  // Campaign breakdown — join CampaignMetrics (impressions/clicks) + JourneySession (visits/orders)
  const campaignsWithMetrics = await db.campaign.findMany({
    where: { organizationId: orgId, status: 'ACTIVE' },
    select: {
      id: true,
      metaCampaignId: true,
      name: true,
      status: true,
      metrics: {
        where: { date: { gte: startDate } },
        select: { impressions: true, clicks: true, spend: true },
      },
    },
  })

  // Session counts per campaignId
  const sessionMap = new Map<string, { sessions: number; orders: number }>()
  for (const s of sessions) {
    if (!s.campaignId) continue
    const existing = sessionMap.get(s.campaignId) ?? { sessions: 0, orders: 0 }
    existing.sessions++
    if (s.reachedOrderConfirmed != null) existing.orders++
    sessionMap.set(s.campaignId, existing)
  }

  const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PAUSED: 1, COMPLETED: 2, DRAFT: 3 }

  const campaignBreakdown: CampaignBreakdownItem[] = campaignsWithMetrics
    .map((c) => {
      const imp = c.metrics.reduce((s, m) => s + (m.impressions ?? 0), 0)
      const clk = c.metrics.reduce((s, m) => s + (m.clicks ?? 0), 0)
      const spd = c.metrics.reduce((s, m) => s + (m.spend ?? 0), 0)
      const sess = sessionMap.get(c.metaCampaignId ?? '') ?? sessionMap.get(c.id) ?? { sessions: 0, orders: 0 }
      return {
        campaignId: c.id,
        name: c.name,
        status: c.status,
        impressions: imp,
        clicks: clk,
        ctr: imp > 0 ? clk / imp : 0,
        spend: spd,
        sessions: sess.sessions,
        orders: sess.orders,
        conversionRate: sess.sessions > 0 ? sess.orders / sess.sessions : 0,
      }
    })
    .filter((c) => c.impressions > 0 || c.sessions > 0)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  const today = new Date(new Date().setHours(0, 0, 0, 0))

  const snapshot = await db.journeySnapshot.upsert({
    where: {
      organizationId_date_periodDays: {
        organizationId: orgId,
        date: today,
        periodDays,
      },
    },
    update: {
      totalImpressions,
      totalAdClicks,
      totalProductViews,
      totalScrollToForm,
      totalFormStarts,
      totalFormSubmits,
      totalOrders,
      ctrAd: totalAdClicks > 0 && totalImpressions > 0 ? totalAdClicks / totalImpressions : 0,
      rateVisitToScroll,
      rateScrollToStart,
      rateStartToSubmit,
      rateSubmitToOrder,
      overallConversion,
      totalReturns: 0,
      totalUndelivered: 0,
      returnRate: 0,
      undeliveredRate: 0,
      avgFormCompletionSec,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productBreakdown: productBreakdown as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      campaignBreakdown: campaignBreakdown as any,
    },
    create: {
      organizationId: orgId,
      date: today,
      periodDays,
      totalImpressions,
      totalAdClicks,
      totalProductViews,
      totalScrollToForm,
      totalFormStarts,
      totalFormSubmits,
      totalOrders,
      ctrAd: totalAdClicks > 0 && totalImpressions > 0 ? totalAdClicks / totalImpressions : 0,
      rateVisitToScroll,
      rateScrollToStart,
      rateStartToSubmit,
      rateSubmitToOrder,
      overallConversion,
      totalReturns: 0,
      totalUndelivered: 0,
      returnRate: 0,
      undeliveredRate: 0,
      avgFormCompletionSec,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productBreakdown: productBreakdown as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      campaignBreakdown: campaignBreakdown as any,
    },
  })

  return {
    ...snapshot,
    productBreakdown: snapshot.productBreakdown as unknown as ProductBreakdownItem[],
    campaignBreakdown: snapshot.campaignBreakdown as unknown as CampaignBreakdownItem[],
  }
}
