import { Trophy, Zap } from "lucide-react"
import { RO_BENCHMARKS } from "@/features/meta/knowledge-base"

interface AdMetricsSummary {
  adId: string
  adName: string
  spend: number
  impressions: number
  clicks: number
  purchases: number
  roas: number | null
  ctr: number | null
  hookRate: number | null
}

interface Props {
  ads: AdMetricsSummary[]
}

export function AdCreativeTable({ ads }: Props) {
  if (ads.length === 0) return null

  const winnerAdId = ads
    .filter((a) => a.roas !== null)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0]?.adId

  return (
    <div className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white shadow-sm">
      <div className="border-b border-[#E7E5E4] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#1C1917]">
          Performanță creative ({ads.length} reclame)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E5E4] bg-[#F5F5F4] text-xs uppercase tracking-wide text-[#78716C]">
              <th className="px-4 py-3 text-left">Reclamă</th>
              <th className="px-4 py-3 text-right">Spend</th>
              <th className="px-4 py-3 text-right">CTR</th>
              <th className="px-4 py-3 text-right">Hook Rate</th>
              <th className="px-4 py-3 text-right">Achiziții</th>
              <th className="px-4 py-3 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => {
              const isWinner = ad.adId === winnerAdId && ad.roas !== null
              const isWeakHook =
                ad.hookRate !== null && ad.hookRate < RO_BENCHMARKS.hookRate.poor

              return (
                <tr
                  key={ad.adId}
                  className="border-b border-[#E7E5E4] transition-colors hover:bg-[#FAFAF9]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isWinner && (
                        <Trophy className="h-3.5 w-3.5 flex-shrink-0 text-[#D4AF37]" />
                      )}
                      {isWeakHook && !isWinner && (
                        <Zap className="h-3.5 w-3.5 flex-shrink-0 text-[#DC2626]" />
                      )}
                      <span className={`font-medium ${isWinner ? "text-[#1C1917]" : "text-[#44403C]"}`}>
                        {ad.adName}
                      </span>
                      {isWinner && (
                        <span className="rounded-full bg-[#FEF9C3] px-2 py-0.5 text-[10px] font-bold text-[#92400E]">
                          Winner
                        </span>
                      )}
                      {isWeakHook && !isWinner && (
                        <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#991B1B]">
                          Hook slab
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[#44403C]">
                    {ad.spend.toFixed(0)} RON
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ad.ctr !== null ? (
                      <span
                        className={
                          ad.ctr >= RO_BENCHMARKS.ctr.good
                            ? "font-medium text-[#166534]"
                            : ad.ctr >= RO_BENCHMARKS.ctr.ok
                              ? "text-[#44403C]"
                              : "text-[#DC2626]"
                        }
                      >
                        {ad.ctr.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[#A8A29E]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ad.hookRate !== null ? (
                      <span
                        className={
                          ad.hookRate >= RO_BENCHMARKS.hookRate.good
                            ? "font-medium text-[#166534]"
                            : ad.hookRate >= RO_BENCHMARKS.hookRate.ok
                              ? "text-[#44403C]"
                              : "text-[#DC2626]"
                        }
                      >
                        {(ad.hookRate * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-[#A8A29E]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#1C1917]">
                    {ad.purchases}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ad.roas !== null ? (
                      <span
                        className={
                          ad.roas >= RO_BENCHMARKS.roas.good
                            ? "font-bold text-[#166534]"
                            : ad.roas >= RO_BENCHMARKS.roas.ok
                              ? "text-[#44403C]"
                              : "text-[#DC2626]"
                        }
                      >
                        {ad.roas.toFixed(2)}x
                      </span>
                    ) : (
                      <span className="text-[#A8A29E]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
