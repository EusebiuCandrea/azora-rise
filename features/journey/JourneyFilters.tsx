'use client'

import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Period = '7' | '30' | '90'

interface Props {
  period: Period
  onPeriodChange: (p: Period) => void
  onAnalyze: () => void
  isAnalyzing?: boolean
}

export function JourneyFilters({ period, onPeriodChange, onAnalyze, isAnalyzing }: Props) {
  return (
    <div className="flex items-center gap-3 bg-[#F5F5F4] p-2 rounded-xl flex-wrap">
      <div className="flex bg-white rounded-lg p-1 shadow-sm">
        {(['7', '30', '90'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-md transition-all',
              period === p
                ? 'bg-[#D4AF37] text-[#1C1917] font-semibold shadow-sm'
                : 'text-[#78716C] hover:text-[#1C1917] font-medium'
            )}
          >
            {p} zile
          </button>
        ))}
      </div>
      <button
        onClick={onAnalyze}
        disabled={isAnalyzing}
        className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#292524] text-white px-5 py-2 rounded-lg text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100"
      >
        <Zap className={cn('w-4 h-4', isAnalyzing && 'animate-pulse')} strokeWidth={2} />
        {isAnalyzing ? 'Se analizează...' : 'Analizează acum'}
      </button>
    </div>
  )
}
