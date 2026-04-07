"use client"

import { useState } from 'react'
import type { JourneyHistoryPoint } from './types'

interface Props {
  history?: JourneyHistoryPoint[]
  period?: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

export function JourneyMetricsChart({ history = [], period = '30' }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (history.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] p-8 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h4 className="text-xl font-semibold text-[#1C1917]">Evoluție Rată Conversie</h4>
          <span className="text-sm text-[#78716C]">Ultimele {period} zile</span>
        </div>
        <div className="h-48 flex items-center justify-center text-[#78716C] text-sm">
          Fără date istorice încă — graficul se populează zilnic
        </div>
      </div>
    )
  }

  const max = Math.max(...history.map((p) => p.overallConversion), 0.001)
  // Show date labels every N bars to avoid crowding
  const labelEvery = history.length > 20 ? 7 : history.length > 10 ? 3 : 1

  return (
    <div className="bg-white border border-[#E7E5E4] p-8 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h4 className="text-xl font-semibold text-[#1C1917]">Evoluție Rată Conversie</h4>
        <span className="text-sm text-[#78716C]">Ultimele {period} zile</span>
      </div>

      <div className="relative">
        {/* Bars */}
        <div className="relative h-48 flex items-end justify-between gap-0.5 px-1">
          {history.map((point, i) => (
            <div
              key={i}
              className="relative flex-1"
              style={{ height: `${Math.max((point.overallConversion / max) * 100, 2)}%` }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Bar */}
              <div className="w-full h-full bg-[#D4AF37]/40 hover:bg-[#D4AF37]/70 transition-colors rounded-t-sm cursor-pointer" />
              {/* Tooltip */}
              {hovered === i && (
                <div
                  className="absolute bottom-full mb-2 z-10 bg-[#1C1917] text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg pointer-events-none"
                  style={{ left: '50%', transform: 'translateX(-50%)' }}
                >
                  <div className="font-semibold">{formatDate(point.date)}</div>
                  <div>{(point.overallConversion * 100).toFixed(2)}% conversie</div>
                  <div className="text-[#D4AF37]">{point.totalOrders} {point.totalOrders === 1 ? 'comandă' : 'comenzi'} · {point.totalProductViews ?? '—'} vizite</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1C1917]" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* X-axis date labels */}
        <div className="flex justify-between gap-0.5 px-1 mt-1">
          {history.map((point, i) => (
            <div key={i} className="flex-1 flex justify-center">
              {i % labelEvery === 0 && (
                <span className="text-[10px] text-[#78716C] whitespace-nowrap">
                  {formatDate(point.date)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
