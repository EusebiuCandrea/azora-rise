import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { CampaignStatusBadge } from '@/features/meta/components/CampaignStatusBadge'
import { RoasBadge } from '@/features/meta/components/RoasBadge'
import { CampaignMetricsChart } from '@/features/meta/components/CampaignMetricsChart'
import { CampaignPauseButton } from '@/features/meta/components/CampaignPauseButton'
import { CampaignAIPanel } from '@/features/meta/components/CampaignAIPanel'
import { AdCreativeTable } from '@/features/meta/components/AdCreativeTable'
import { CampaignReportType } from '@prisma/client'
import { getScalingSuggestionsForCampaign } from '@/features/meta/scaling-rules'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const [campaign, latestAIReport, scalingSuggestions, adMetrics] = await Promise.all([
    db.campaign.findFirst({
      where: { id, organizationId: orgId },
      include: {
        metrics: { orderBy: { date: 'desc' }, take: 30 },
        adSets: { orderBy: { createdAt: 'asc' } },
        alerts: { where: { isResolved: false }, orderBy: { triggeredAt: 'desc' } },
      },
    }),
    db.campaignAIReport.findFirst({
      where: { campaignId: id, reportType: CampaignReportType.CAMPAIGN_DEEP },
      orderBy: { generatedAt: 'desc' },
    }),
    getScalingSuggestionsForCampaign(orgId, id),
    db.ad.findMany({
      where: { organizationId: orgId, adSet: { campaign: { id } } },
      include: {
        metrics: {
          where: { date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          select: { spend: true, impressions: true, clicks: true, purchases: true, purchaseValue: true, ctr: true, videoPlays: true, videoP25: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!campaign) notFound()

  const adSummaries = adMetrics.map((ad) => {
    const spend = ad.metrics.reduce((s, m) => s + m.spend, 0)
    const impressions = ad.metrics.reduce((s, m) => s + m.impressions, 0)
    const clicks = ad.metrics.reduce((s, m) => s + m.clicks, 0)
    const purchases = ad.metrics.reduce((s, m) => s + m.purchases, 0)
    const purchaseValue = ad.metrics.reduce((s, m) => s + (m.purchaseValue ?? 0), 0)
    const videoPlays = ad.metrics.reduce((s, m) => s + (m.videoPlays ?? 0), 0)
    const videoP25 = ad.metrics.reduce((s, m) => s + (m.videoP25 ?? 0), 0)
    const avgCtr = impressions > 0 ? (clicks / impressions) * 100 : null
    return {
      adId: ad.id,
      adName: ad.name,
      spend,
      impressions,
      clicks,
      purchases,
      roas: spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null,
      ctr: avgCtr,
      hookRate: videoPlays > 0 ? videoP25 / videoPlays : null,
    }
  })

  const totalSpend = campaign.metrics.reduce((s, m) => s + m.spend, 0)
  const totalPurchases = campaign.metrics.reduce((s, m) => s + m.purchases, 0)
  const totalPurchaseValue = campaign.metrics.reduce((s, m) => s + (m.purchaseValue ?? 0), 0)
  const avgRoas = totalSpend > 0 && totalPurchaseValue > 0 ? totalPurchaseValue / totalSpend : null
  const avgCtr =
    campaign.metrics.filter((m) => m.ctr !== null).length > 0
      ? campaign.metrics.filter((m) => m.ctr !== null).reduce((s, m) => s + (m.ctr ?? 0), 0) /
        campaign.metrics.filter((m) => m.ctr !== null).length
      : null

  const chartData = [...campaign.metrics]
    .reverse()
    .map((m) => ({
      date: m.date.toISOString(),
      spend: m.spend,
      roas: m.roas,
    }))

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="rounded-lg p-2 text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-[#1C1917]">{campaign.name}</h1>
            <div className="mt-1 flex items-center gap-3">
              <CampaignStatusBadge status={campaign.status} />
              <span className="text-sm text-[#78716C]">{campaign.objective}</span>
              {campaign.metaCampaignId && (
                <a
                  href={`https://www.facebook.com/adsmanager/manage/adsets?act=${campaign.metaCampaignId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#78716C] hover:text-[#1C1917]"
                >
                  <ExternalLink className="h-3 w-3" /> Meta Ads Manager
                </a>
              )}
            </div>
          </div>
        </div>

        {campaign.status === 'ACTIVE' && <CampaignPauseButton campaignId={id} />}
      </div>

      {campaign.alerts.length > 0 && (
        <div className="space-y-2">
          {campaign.alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3"
            >
              <span className="text-[#D97706] text-base">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#92400E]">
                  {alert.type.replace(/_/g, ' ')}
                </p>
                {alert.message && (
                  <p className="text-xs text-[#92690A] mt-0.5">{alert.message}</p>
                )}
              </div>
              <span className="text-xs text-[#A16207] flex-shrink-0">
                {new Date(alert.triggeredAt).toLocaleDateString('ro-RO', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Cheltuieli (30 zile)', value: `${totalSpend.toFixed(0)} RON`, sub: `${campaign.budget} RON/zi buget` },
          { label: 'ROAS mediu', value: avgRoas ? `${avgRoas.toFixed(1)}×` : '—', gold: true },
          { label: 'Achiziții', value: String(totalPurchases) },
          { label: 'CTR mediu', value: avgCtr ? `${avgCtr.toFixed(2)}%` : '—' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#E7E5E4] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#78716C]">{kpi.label}</p>
            <p className={`mt-2 text-[28px] font-bold leading-none ${kpi.gold ? 'text-[#D4AF37]' : 'text-[#1C1917]'}`}>
              {kpi.value}
            </p>
            {kpi.sub && <p className="mt-2 text-xs text-[#78716C]">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      <CampaignAIPanel
        campaignId={id}
        scalingSuggestions={scalingSuggestions}
        initialReport={latestAIReport ? {
          healthScore: latestAIReport.healthScore,
          status: latestAIReport.status as 'excellent' | 'good' | 'warning' | 'critical',
          summary: latestAIReport.summary,
          problems: latestAIReport.problems as never[],
          suggestions: latestAIReport.suggestions as never[],
          videoBrief: latestAIReport.videoBrief as never ?? null,
          generatedAt: latestAIReport.generatedAt.toISOString(),
        } : null}
      />

      <div className="rounded-xl border border-[#E7E5E4] bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-[#1C1917]">Evoluție ROAS + Spend (30 zile)</h2>
        <CampaignMetricsChart metrics={chartData} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white shadow-sm">
        <div className="border-b border-[#E7E5E4] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1C1917]">Metrici zilnice</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-[#F5F5F4] text-xs uppercase tracking-wide text-[#78716C]">
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">Impresii</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">CPM</th>
                <th className="px-4 py-3 text-right">Achiziții</th>
                <th className="px-4 py-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {campaign.metrics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#78716C]">
                    Nu există metrici sincronizate
                  </td>
                </tr>
              ) : (
                campaign.metrics.map((m) => (
                  <tr key={m.id} className="border-b border-[#E7E5E4] transition-colors hover:bg-[#FAFAF9]">
                    <td className="px-4 py-3 text-[#78716C]">
                      {new Date(m.date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#1C1917]">{m.spend.toFixed(0)} RON</td>
                    <td className="px-4 py-3 text-right text-[#78716C]">{m.impressions.toLocaleString('ro-RO')}</td>
                    <td className="px-4 py-3 text-right text-[#78716C]">{m.clicks.toLocaleString('ro-RO')}</td>
                    <td className="px-4 py-3 text-right text-[#78716C]">{m.ctr ? `${m.ctr.toFixed(2)}%` : '—'}</td>
                    <td className="px-4 py-3 text-right text-[#78716C]">{m.cpm ? `${m.cpm.toFixed(1)} RON` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#1C1917]">{m.purchases}</td>
                    <td className="px-4 py-3 text-right">
                      <RoasBadge roas={m.roas} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdCreativeTable ads={adSummaries} />

      {campaign.adSets.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white shadow-sm">
          <div className="border-b border-[#E7E5E4] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#1C1917]">Ad Sets ({campaign.adSets.length})</h2>
          </div>
          <div className="divide-y divide-[#E7E5E4]">
            {campaign.adSets.map((adSet) => (
              <div key={adSet.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-[#1C1917]">{adSet.name}</p>
                  <p className="mt-0.5 text-xs text-[#78716C]">{adSet.status}</p>
                </div>
                <div className="text-right text-sm text-[#78716C]">
                  {adSet.dailyBudget ? `${adSet.dailyBudget} RON/zi` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
