import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { getYesterdayUTC } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { CampaignsTable } from '@/features/meta/components/CampaignsTable'
import { CampaignsSummaryBar } from '@/features/meta/components/CampaignsSummaryBar'
import { MetaAlertBanner } from '@/features/meta/components/MetaAlertBanner'
import { SyncButton } from '@/features/meta/components/SyncButton'

export default async function CampaignsPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  const yesterday = getYesterdayUTC()

  const metaConnected = orgId
    ? !!(await db.metaConnection.findUnique({ where: { organizationId: orgId }, select: { id: true } }))
    : false

  const rawCampaigns = orgId
    ? await db.campaign.findMany({
        where: { organizationId: orgId },
        include: {
          metrics: { where: { date: { lte: yesterday } }, orderBy: { date: 'desc' }, take: 30 },
          _count: { select: { adSets: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
    : []

  const campaigns = rawCampaigns.map((campaign) => {
    const totalSpend = campaign.metrics.reduce((sum, m) => sum + m.spend, 0)
    const totalPurchases = campaign.metrics.reduce((sum, m) => sum + m.purchases, 0)
    const metricsWithRoas = campaign.metrics.filter((m) => m.roas !== null)
    const avgRoas =
      metricsWithRoas.length > 0
        ? metricsWithRoas.reduce((sum, m) => sum + (m.roas ?? 0), 0) / metricsWithRoas.length
        : null

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      budget: campaign.budget,
      objective: campaign.objective,
      metaCampaignId: campaign.metaCampaignId,
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
