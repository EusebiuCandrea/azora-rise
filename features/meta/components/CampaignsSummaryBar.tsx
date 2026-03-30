"use client"

interface Props {
  campaigns: Array<{
    summary?: {
      totalSpend: number
      totalPurchases: number
      avgRoas: number | null
    }
    budget: number
  }>
}

export function CampaignsSummaryBar({ campaigns }: Props) {
  const totalSpend = campaigns.reduce((s, c) => s + (c.summary?.totalSpend ?? 0), 0)
  const totalPurchases = campaigns.reduce((s, c) => s + (c.summary?.totalPurchases ?? 0), 0)
  const avgRoas =
    campaigns.filter((c) => (c.summary?.avgRoas ?? 0) > 0).length > 0
      ? campaigns.reduce((s, c) => s + (c.summary?.avgRoas ?? 0), 0) /
        campaigns.filter((c) => (c.summary?.avgRoas ?? 0) > 0).length
      : null
  const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : null

  return (
    <div className="flex flex-wrap gap-6 rounded-xl border border-[#E7E5E4] bg-white px-5 py-4 text-sm text-[#78716C] shadow-sm">
      <span>Total cheltuieli (30 zile): <strong className="text-[#1C1917]">{totalSpend.toFixed(0)} RON</strong></span>
      <span>Total achiziții: <strong className="text-[#1C1917]">{totalPurchases}</strong></span>
      {avgRoas !== null && (
        <span>ROAS mediu: <strong className="text-[#D4AF37]">{avgRoas.toFixed(1)}×</strong></span>
      )}
      {cpa !== null && (
        <span>CPA mediu: <strong className="text-[#1C1917]">{cpa.toFixed(0)} RON</strong></span>
      )}
    </div>
  )
}
