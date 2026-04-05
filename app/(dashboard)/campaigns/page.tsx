import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { getYesterdayUTC } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { CampaignsTable } from '@/features/meta/components/CampaignsTable'
import { CampaignsSummaryBar } from '@/features/meta/components/CampaignsSummaryBar'
import { MetaAlertBanner } from '@/features/meta/components/MetaAlertBanner'
import { SyncButton } from '@/features/meta/components/SyncButton'
import { DailyDigestBanner } from '@/features/meta/components/DailyDigestBanner'
import { KPIBenchmarksPanel } from '@/features/meta/components/KPIBenchmarksPanel'
import { CampaignReportType } from '@prisma/client'

export default async function CampaignsPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  const yesterday = getYesterdayUTC()

  const metaConnected = orgId
    ? !!(await db.metaConnection.findUnique({ where: { organizationId: orgId }, select: { id: true } }))
    : false

  const [rawCampaigns, latestDigest] = orgId
    ? await Promise.all([
        db.campaign.findMany({
          where: { organizationId: orgId },
          include: {
            metrics: { where: { date: { lte: yesterday } }, orderBy: { date: 'desc' }, take: 30 },
            aiReports: {
              where: { reportType: CampaignReportType.CAMPAIGN_DEEP },
              orderBy: { generatedAt: 'desc' },
              take: 1,
              select: { healthScore: true },
            },
            _count: { select: { adSets: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        db.campaignAIReport.findFirst({
          where: { organizationId: orgId, reportType: CampaignReportType.DAILY_DIGEST },
          orderBy: { generatedAt: 'desc' },
          select: { summary: true, generatedAt: true },
        }),
      ])
    : [[], null]

  const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PAUSED: 1, DRAFT: 2, COMPLETED: 3 }
  const campaigns = rawCampaigns
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
    .map((campaign) => {
    const totalSpend = campaign.metrics.reduce((sum, m) => sum + m.spend, 0)
    const totalPurchases = campaign.metrics.reduce((sum, m) => sum + m.purchases, 0)
    const totalPurchaseValue = campaign.metrics.reduce((sum, m) => sum + (m.purchaseValue ?? 0), 0)
    const avgRoas = totalSpend > 0 && totalPurchaseValue > 0 ? totalPurchaseValue / totalSpend : null

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      budget: campaign.budget,
      objective: campaign.objective,
      metaCampaignId: campaign.metaCampaignId,
      healthScore: campaign.aiReports[0]?.healthScore ?? null,
      summary: {
        totalSpend,
        totalPurchases,
        latestRoas: campaign.metrics[0]?.roas ?? null,
        avgRoas,
        adSetsCount: campaign._count.adSets,
      },
    }
  })

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Campanii Meta Ads</h1>
          <p className="mt-1 text-sm text-[#78716C]">
            {campaigns.length} campanii{metaConnected ? '' : ' — Meta neconectat'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metaConnected && <SyncButton />}
          <Link
            href="/campaigns/new"
            className="flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Campanie nouă
          </Link>
        </div>
      </div>

      {!metaConnected && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5 shadow-sm">
          <p className="text-sm text-[#D97706] font-medium">Meta neconectat</p>
          <p className="text-sm text-[#78716C] mt-1">
            Conectează Meta Ads din{' '}
            <Link href="/settings" className="text-[#D4AF37] underline">Settings</Link>{' '}
            pentru a sincroniza campanii și metrici.
          </p>
        </div>
      )}

      <MetaAlertBanner />

      {latestDigest && (
        <DailyDigestBanner
          summary={latestDigest.summary}
          generatedAt={latestDigest.generatedAt}
          campaignCount={campaigns.length}
        />
      )}

      <KPIBenchmarksPanel />

      <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden shadow-sm">
        <CampaignsTable campaigns={campaigns} />
      </div>

      {campaigns.length > 0 && (
        <div>
          <CampaignsSummaryBar campaigns={campaigns} />
        </div>
      )}
    </div>
  )
}
