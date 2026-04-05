"use client"

import { useState } from "react"
import Link from "next/link"
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { RoasBadge } from "./RoasBadge"
import { CampaignHealthBadge } from "./CampaignHealthBadge"
import { usePauseCampaign } from "@/features/meta/hooks/useCampaigns"
import { Pause, ExternalLink } from "lucide-react"

interface Campaign {
  id: string
  name: string
  status: string
  budget: number
  objective: string
  metaCampaignId: string | null
  healthScore?: number | null
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

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
type RoasFilter = 'ALL' | 'EXCELLENT' | 'MEDIUM' | 'LOW' | 'NO_DATA'

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'Toate statusurile',
  ACTIVE: 'Activ',
  PAUSED: 'Pauzat',
  COMPLETED: 'Finalizat',
}

const ROAS_LABELS: Record<RoasFilter, string> = {
  ALL: 'Toate ROAS',
  EXCELLENT: 'Excelent (>2×)',
  MEDIUM: 'Mediu (1–2×)',
  LOW: 'Slab (<1×)',
  NO_DATA: 'Fără date',
}

function matchesRoas(roas: number | null | undefined, filter: RoasFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'NO_DATA') return roas == null
  if (roas == null) return false
  if (filter === 'EXCELLENT') return roas > 2
  if (filter === 'MEDIUM') return roas >= 1 && roas <= 2
  if (filter === 'LOW') return roas < 1
  return true
}

export function CampaignsTable({ campaigns }: Props) {
  const { mutate: pause, isPending, isError } = usePauseCampaign()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [roasFilter, setRoasFilter] = useState<RoasFilter>('ALL')

  const filtered = campaigns.filter((c) => {
    const statusMatch = statusFilter === 'ALL' || c.status === statusFilter
    const roasMatch = matchesRoas(c.summary?.avgRoas, roasFilter)
    return statusMatch && roasMatch
  })

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
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E7E5E4] bg-[#FAFAF9]">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-8 px-2 text-xs border border-[#E7E5E4] bg-white rounded-lg text-[#1C1917] focus:outline-none focus:border-[#D4AF37]"
        >
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
            <option key={key} value={key}>{STATUS_LABELS[key]}</option>
          ))}
        </select>
        <select
          value={roasFilter}
          onChange={(e) => setRoasFilter(e.target.value as RoasFilter)}
          className="h-8 px-2 text-xs border border-[#E7E5E4] bg-white rounded-lg text-[#1C1917] focus:outline-none focus:border-[#D4AF37]"
        >
          {(Object.keys(ROAS_LABELS) as RoasFilter[]).map((key) => (
            <option key={key} value={key}>{ROAS_LABELS[key]}</option>
          ))}
        </select>
        {(statusFilter !== 'ALL' || roasFilter !== 'ALL') && (
          <button
            onClick={() => { setStatusFilter('ALL'); setRoasFilter('ALL') }}
            className="h-8 px-2 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors"
          >
            Resetează
          </button>
        )}
        <span className="ml-auto text-xs text-[#78716C]">
          {filtered.length} / {campaigns.length} campanii
        </span>
      </div>

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
              <th className="text-right py-3 px-4">Score AI</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-[#78716C]">
                  Nicio campanie corespunde filtrelor selectate.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
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
                  <td className="py-3 px-4 text-right">
                    <CampaignHealthBadge score={c.healthScore ?? null} />
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
              ))
            )}
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
