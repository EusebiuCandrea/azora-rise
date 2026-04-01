import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JourneySnapshotDTO } from './types'

interface FunnelStep {
  label: string
  value: string
  rate?: string
  rateColor?: 'blue' | 'green' | 'orange' | 'red'
}

const MOCK_STEPS: FunnelStep[] = [
  { label: 'Impresii', value: '1.2M' },
  { label: 'Clickuri', value: '45K', rate: '3.75%', rateColor: 'blue' },
  { label: 'Vizite', value: '12K', rate: '26.6%', rateColor: 'green' },
  { label: 'Formular', value: '4.2K', rate: '35.0%', rateColor: 'orange' },
  { label: 'Submit', value: '2.1K', rate: '50.0%', rateColor: 'red' },
  { label: 'Comenzi', value: '1.8K', rate: '85.7%', rateColor: 'green' },
]

const rateClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function pct(n: number): string { return `${(n * 100).toFixed(1)}%` }

function rateCol(rate: number): 'green' | 'orange' | 'red' {
  if (rate >= 0.5) return 'green'
  if (rate >= 0.25) return 'orange'
  return 'red'
}

function snapshotToSteps(s: JourneySnapshotDTO): FunnelStep[] {
  return [
    { label: 'Impresii', value: fmtNum(s.totalImpressions) },
    { label: 'Clickuri', value: fmtNum(s.totalAdClicks), rate: pct(s.ctrAd), rateColor: rateCol(s.ctrAd) },
    { label: 'Vizite', value: fmtNum(s.totalProductViews), rate: s.totalAdClicks > 0 ? pct(s.totalProductViews / s.totalAdClicks) : undefined },
    { label: 'Formular', value: fmtNum(s.totalScrollToForm), rate: pct(s.rateVisitToScroll), rateColor: rateCol(s.rateVisitToScroll) },
    { label: 'Submit', value: fmtNum(s.totalFormSubmits), rate: pct(s.rateStartToSubmit), rateColor: rateCol(s.rateStartToSubmit) },
    { label: 'Comenzi', value: fmtNum(s.totalOrders), rate: pct(s.rateSubmitToOrder), rateColor: rateCol(s.rateSubmitToOrder) },
  ]
}

interface Props { snapshot?: JourneySnapshotDTO | null }

export function JourneyFunnel({ snapshot }: Props) {
  const steps = snapshot ? snapshotToSteps(snapshot) : MOCK_STEPS

  return (
    <div className="flex items-stretch gap-0">
      {steps.map((step, i) => (
        <>
          {i > 0 && (
            <div key={`arrow-${i}`} className="flex items-center justify-center px-1 flex-shrink-0">
              <ChevronRight className="w-4 h-4 text-[#D0C5AF]" strokeWidth={2} />
            </div>
          )}
          <div
            key={step.label}
            className="flex-1 bg-white border border-[#E7E5E4] p-5 rounded-xl flex flex-col items-center text-center hover:bg-[#FAFAF9] transition-colors shadow-sm min-w-0"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] mb-3">
              {step.label}
            </span>
            <span className="text-2xl font-bold text-[#1C1917]">{step.value}</span>
            {step.rate && (
              <span
                className={cn(
                  'mt-2 text-[10px] font-bold px-2 py-0.5 rounded',
                  rateClasses[step.rateColor ?? 'blue']
                )}
              >
                {step.rate}
              </span>
            )}
          </div>
        </>
      ))}
    </div>
  )
}
