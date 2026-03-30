'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const PERIODS = [
  { label: '7 zile', value: 7 },
  { label: '30 zile', value: 30 },
  { label: '90 zile', value: 90 },
]

interface BannerData {
  totalSpend: number
  totalRevenue: number
  actualRoas: number | null
  netProfit: number | null
  hasData: boolean
}

interface Props {
  period: number
  onPeriodChange: (p: number) => void
  data: BannerData
}

function fmt(n: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(n)
}

function RoasBadge({ roas }: { roas: number }) {
  if (roas >= 3) return <span className="text-[11px] font-medium text-[#15803D]">bun</span>
  if (roas >= 1.5) return <span className="text-[11px] font-medium text-[#D97706]">mediu</span>
  return <span className="text-[11px] font-medium text-[#DC2626]">slab</span>
}

export function ProfitabilityBanner({ period, onPeriodChange, data }: Props) {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Performanță reclame</p>
        <div className="flex items-center gap-1 bg-[#F5F5F4] rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={
                period === p.value
                  ? 'px-3 py-1 rounded-md text-xs font-semibold bg-white text-[#1C1917] shadow-sm'
                  : 'px-3 py-1 rounded-md text-xs text-[#78716C] hover:text-[#1C1917] transition-colors'
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data.hasData ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 rounded-full bg-[#FDE68A] flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-[#92690A]">!</span>
          </div>
          <p className="text-xs text-[#78716C]">
            Conectează Meta Ads în Setări pentru a vedea datele de publicitate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {/* Cheltuieli */}
          <div>
            <p className="text-[11px] text-[#78716C] mb-1">Cheltuieli reclame</p>
            <p className="text-xl font-bold text-[#1C1917]">{fmt(data.totalSpend)} RON</p>
            <p className="text-[11px] text-[#78716C] mt-0.5">Meta Ads</p>
          </div>

          {/* Venituri atribuite */}
          <div>
            <p className="text-[11px] text-[#78716C] mb-1">Venituri atribuite</p>
            <p className="text-xl font-bold text-[#1C1917]">{fmt(data.totalRevenue)} RON</p>
            <p className="text-[11px] text-[#78716C] mt-0.5">din campanii Meta</p>
          </div>

          {/* ROAS actual */}
          <div>
            <p className="text-[11px] text-[#78716C] mb-1">ROAS actual</p>
            {data.actualRoas != null ? (
              <>
                <p className="text-xl font-bold text-[#D4AF37]">{data.actualRoas.toFixed(1)}×</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <RoasBadge roas={data.actualRoas} />
                </div>
              </>
            ) : (
              <p className="text-xl font-bold text-[#78716C]">—</p>
            )}
          </div>

          {/* Profit net */}
          <div>
            <p className="text-[11px] text-[#78716C] mb-1">Profit net cu ads</p>
            {data.netProfit != null ? (
              <>
                <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {data.netProfit >= 0 ? '+' : ''}{fmt(data.netProfit)} RON
                </p>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {data.netProfit >= 0
                    ? <TrendingUp className="w-3 h-3 text-[#16A34A]" strokeWidth={2} />
                    : <TrendingDown className="w-3 h-3 text-[#DC2626]" strokeWidth={2} />}
                  <span className="text-[11px] text-[#78716C]">după costuri produse</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-[#78716C]">—</p>
                <p className="text-[11px] text-[#78716C] mt-0.5">configurează costuri</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
