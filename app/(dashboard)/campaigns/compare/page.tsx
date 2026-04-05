import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CampaignStatusBadge } from "@/features/meta/components/CampaignStatusBadge"
import { RoasBadge } from "@/features/meta/components/RoasBadge"
import { CampaignHealthBadge } from "@/features/meta/components/CampaignHealthBadge"
import { CampaignReportType } from "@prisma/client"
import { getYesterdayUTC } from "@/lib/utils"

export default async function CampaignComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const yesterday = getYesterdayUTC()
  const campaignIds = ids ? ids.split(",").filter(Boolean).slice(0, 4) : []

  const allCampaigns = await db.campaign.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, status: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 30,
  })

  const selectedCampaigns =
    campaignIds.length > 0
      ? await db.campaign.findMany({
          where: { id: { in: campaignIds }, organizationId: orgId },
          include: {
            metrics: {
              where: { date: { lte: yesterday } },
              orderBy: { date: "desc" },
              take: 30,
            },
            aiReports: {
              where: { reportType: CampaignReportType.CAMPAIGN_DEEP },
              orderBy: { generatedAt: "desc" },
              take: 1,
              select: { healthScore: true, status: true },
            },
          },
        })
      : []

  const campaignData = selectedCampaigns.map((c) => {
    const m = c.metrics
    const totalSpend = m.reduce((s, x) => s + x.spend, 0)
    const totalPurchases = m.reduce((s, x) => s + x.purchases, 0)
    const totalPurchaseValue = m.reduce((s, x) => s + (x.purchaseValue ?? 0), 0)
    const avgRoas = totalSpend > 0 && totalPurchaseValue > 0 ? totalPurchaseValue / totalSpend : null

    const withCtr = m.filter((x) => x.ctr !== null)
    const avgCtr = withCtr.length > 0 ? withCtr.reduce((s, x) => s + (x.ctr ?? 0), 0) / withCtr.length : null
    const withCpm = m.filter((x) => x.cpm !== null)
    const avgCpm = withCpm.length > 0 ? withCpm.reduce((s, x) => s + (x.cpm ?? 0), 0) / withCpm.length : null
    const withFreq = m.filter((x) => x.frequency !== null)
    const avgFreq = withFreq.length > 0 ? withFreq.reduce((s, x) => s + (x.frequency ?? 0), 0) / withFreq.length : null

    const totalPlays = m.reduce((s, x) => s + (x.videoPlays ?? 0), 0)
    const totalP25 = m.reduce((s, x) => s + (x.videoP25 ?? 0), 0)
    const hookRate = totalPlays > 100 ? totalP25 / totalPlays : null

    const totalImpressions = m.reduce((s, x) => s + x.impressions, 0)
    const totalClicks = m.reduce((s, x) => s + x.clicks, 0)
    const totalAddToCart = m.reduce((s, x) => s + (x.addToCart ?? 0), 0)
    const totalLpv = m.reduce((s, x) => s + (x.landingPageViews ?? 0), 0)

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      budget: c.budget,
      healthScore: c.aiReports[0]?.healthScore ?? null,
      totalSpend,
      totalPurchases,
      avgRoas,
      avgCtr,
      avgCpm,
      avgFreq,
      hookRate,
      cpa: totalPurchases > 0 ? totalSpend / totalPurchases : null,
      atcRate: totalClicks > 0 ? totalAddToCart / totalClicks : null,
      lpvRate: totalClicks > 0 ? totalLpv / totalClicks : null,
      totalImpressions,
      totalClicks,
    }
  })

  // Preserve order from campaignIds
  const orderedData = campaignIds
    .map((id) => campaignData.find((c) => c.id === id))
    .filter(Boolean) as typeof campaignData

  type MetricRow = {
    key: keyof (typeof orderedData)[0]
    label: string
    format: (v: number | null) => string
    better: "higher" | "lower"
  }

  const metricRows: MetricRow[] = [
    { key: "avgRoas", label: "ROAS Mediu (30z)", format: (v) => (v ? `${v.toFixed(2)}×` : "—"), better: "higher" },
    { key: "totalSpend", label: "Spend Total (30z)", format: (v) => (v ? `${v.toFixed(0)} RON` : "—"), better: "lower" },
    { key: "totalPurchases", label: "Comenzi (30z)", format: (v) => (v !== null ? String(v) : "—"), better: "higher" },
    { key: "cpa", label: "CPA", format: (v) => (v ? `${v.toFixed(0)} RON` : "—"), better: "lower" },
    { key: "avgCtr", label: "CTR Mediu", format: (v) => (v ? `${v.toFixed(2)}%` : "—"), better: "higher" },
    { key: "avgCpm", label: "CPM Mediu", format: (v) => (v ? `${v.toFixed(1)} RON` : "—"), better: "lower" },
    { key: "avgFreq", label: "Frecvență", format: (v) => (v ? v.toFixed(1) : "—"), better: "lower" },
    { key: "hookRate", label: "Hook Rate", format: (v) => (v ? `${(v * 100).toFixed(0)}%` : "—"), better: "higher" },
    { key: "atcRate", label: "Add-to-Cart Rate", format: (v) => (v ? `${(v * 100).toFixed(1)}%` : "—"), better: "higher" },
    { key: "lpvRate", label: "Landing Page View Rate", format: (v) => (v ? `${(v * 100).toFixed(0)}%` : "—"), better: "higher" },
    { key: "budget", label: "Buget/zi", format: (v) => (v ? `${v} RON` : "—"), better: "higher" },
  ]

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="rounded-lg p-2 text-[#78716C] hover:bg-[#F5F5F4] transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Comparare Campanii</h1>
          <p className="text-sm text-[#78716C]">Selectează până la 4 campanii · date din ultimele 30 de zile</p>
        </div>
      </div>

      {/* Campaign selector */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-3">Selectează campanii</p>
        <div className="flex flex-wrap gap-2">
          {allCampaigns.map((c) => {
            const isSelected = campaignIds.includes(c.id)
            const newIds = isSelected
              ? campaignIds.filter((id) => id !== c.id)
              : [...campaignIds, c.id].slice(0, 4)
            return (
              <Link
                key={c.id}
                href={`/campaigns/compare${newIds.length > 0 ? `?ids=${newIds.join(",")}` : ""}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  isSelected
                    ? "bg-[#1C1917] text-white border-[#1C1917]"
                    : "bg-white text-[#44403C] border-[#E7E5E4] hover:border-[#A8A29E]"
                } ${!isSelected && campaignIds.length >= 4 ? "opacity-40 pointer-events-none" : ""}`}
              >
                {c.name}
              </Link>
            )
          })}
        </div>
        {campaignIds.length === 0 && (
          <p className="mt-3 text-xs text-[#A8A29E]">Selectează cel puțin o campanie pentru a vedea comparația.</p>
        )}
      </div>

      {/* Comparison table */}
      {orderedData.length > 0 && (
        <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7E5E4] bg-[#F5F5F4]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide min-w-[160px]">
                    Metric
                  </th>
                  {orderedData.map((c) => (
                    <th key={c.id} className="text-left px-4 py-3 min-w-[180px]">
                      <Link href={`/campaigns/${c.id}`} className="text-xs font-semibold text-[#1C1917] hover:text-[#D4AF37] line-clamp-2 block">
                        {c.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <CampaignStatusBadge status={c.status} />
                        {c.healthScore !== null && <CampaignHealthBadge score={c.healthScore} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricRows.map(({ key, label, format, better }) => {
                  const values = orderedData.map((c) => {
                    const v = c[key]
                    return typeof v === "number" ? v : null
                  })
                  const numericValues = values.filter((v): v is number => v !== null)
                  const best =
                    numericValues.length > 1
                      ? better === "higher"
                        ? Math.max(...numericValues)
                        : Math.min(...numericValues)
                      : null

                  return (
                    <tr key={key} className="border-b border-[#E7E5E4] hover:bg-[#FAFAF9]">
                      <td className="px-4 py-3 text-xs font-medium text-[#78716C]">{label}</td>
                      {values.map((v, i) => {
                        const isBest = best !== null && v !== null && v === best
                        if (key === "avgRoas") {
                          return (
                            <td key={orderedData[i].id} className="px-4 py-3">
                              <RoasBadge roas={v} />
                            </td>
                          )
                        }
                        return (
                          <td key={orderedData[i].id} className="px-4 py-3">
                            <span className={`font-medium ${isBest ? "text-emerald-600" : "text-[#1C1917]"}`}>
                              {format(v)}
                            </span>
                            {isBest && (
                              <span className="ml-1 text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">
                                best
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
