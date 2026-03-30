"use client"

import Link from "next/link"
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { RoasBadge } from "./RoasBadge"
import { usePauseCampaign } from "@/features/meta/hooks/useCampaigns"
import { Pause, ExternalLink } from "lucide-react"

interface Campaign {
  id: string
  name: string
  status: string
  budget: number
  objective: string
  metaCampaignId: string | null
  summary?: {
    totalSpend: number
    totalPurchases: number
    latestRoas: number | null
    avgRoas: number | null
    adSetsCount: number
  }
}

interface Props {
  campaigns: Campaign[]
}

export function CampaignsTable({ campaigns }: Props) {
  const { mutate: pause, isPending, isError } = usePauseCampaign()

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E7E5E4] bg-[#FAFAF9] px-6 py-12 text-center text-[#78716C]">
        <p className="text-sm font-medium text-[#1C1917]">Nicio campanie sincronizată.</p>
        <p className="mt-1 text-xs">Apasă Sincronizează pentru a aduce campaniile din Meta.</p>
      </div>
    )
  }

  return (
    <>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E7E5E4] text-[#78716C] text-xs uppercase tracking-wide bg-[#F5F5F4]">
            <th className="text-left py-3 px-4">Campanie</th>
            <th className="text-left py-3 px-4">Status</th>
            <th className="text-right py-3 px-4">Buget/zi</th>
            <th className="text-right py-3 px-4">Cheltuieli</th>
            <th className="text-right py-3 px-4">ROAS</th>
            <th className="text-right py-3 px-4">Achiziții</th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-b border-[#E7E5E4] hover:bg-[#F5F5F4] transition-colors">
              <td className="py-3 px-4">
                <Link href={`/campaigns/${c.id}`} className="font-medium text-[#1C1917] transition-colors hover:text-[#B8971F]">
                  {c.name}
                </Link>
                <p className="text-xs text-[#78716C] mt-0.5">{c.objective}</p>
              </td>
              <td className="py-3 px-4">
                <CampaignStatusBadge status={c.status} />
              </td>
              <td className="py-3 px-4 text-right text-[#78716C]">
                {c.budget > 0 ? `${c.budget} RON` : "—"}
              </td>
              <td className="py-3 px-4 text-right text-[#1C1917]">
                {c.summary?.totalSpend ? `${c.summary.totalSpend.toFixed(0)} RON` : "—"}
              </td>
              <td className="py-3 px-4 text-right">
                <RoasBadge roas={c.summary?.avgRoas ?? null} />
              </td>
              <td className="py-3 px-4 text-right text-[#1C1917]">
                {c.summary?.totalPurchases ?? "—"}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1 justify-end">
                  {c.status === "ACTIVE" && (
                    <button
                      onClick={() => pause(c.id)}
                      disabled={isPending}
                      title="Pauze"
                      className="rounded-lg p-1.5 text-[#78716C] transition-colors hover:bg-[#FFF7ED] hover:text-[#D97706] disabled:opacity-60"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {c.metaCampaignId && (
                    <a
                      href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${c.metaCampaignId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Deschide în Meta Ads Manager"
                      className="rounded-lg p-1.5 text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {isError && (
      <p className="text-xs text-[#DC2626] px-4 py-2">
        Eroare la oprirea campaniei. Încearcă din nou.
      </p>
    )}
  </>
  )
}
