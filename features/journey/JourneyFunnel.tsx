import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JourneySnapshotDTO } from './types'

interface FunnelStep {
  label: string
  value: string
  rate?: string
  rateLabel?: string
  rateColor?: 'blue' | 'green' | 'orange' | 'red'
  tooltip?: string
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
    {
      label: 'Impresii',
      value: fmtNum(s.totalImpressions),
      tooltip: 'De câte ori a fost afișată reclama pe ecranul unui utilizator (inclusiv același utilizator de mai multe ori).',
    },
    {
      label: 'Clickuri',
      value: fmtNum(s.totalAdClicks),
      rate: pct(s.ctrAd),
      rateLabel: 'CTR',
      rateColor: rateCol(s.ctrAd),
      tooltip: 'CTR = Clickuri ÷ Impresii. Măsoară cât de atractivă e reclama. Benchmark RO: 1.5–3.5%.',
    },
    {
      label: 'Vizite',
      value: fmtNum(s.totalProductViews),
      rate: s.totalAdClicks > 0 ? pct(s.totalProductViews / s.totalAdClicks) : undefined,
      rateLabel: 'din clicks',
      tooltip: 'Câți utilizatori au ajuns efectiv pe pagina produsului după click pe reclamă.',
    },
    {
      label: 'Formular',
      value: fmtNum(s.totalScrollToForm),
      rate: pct(s.rateVisitToScroll),
      rateLabel: 'scroll rate',
      rateColor: rateCol(s.rateVisitToScroll),
      tooltip: 'Câți vizitatori au derulat pagina până la formularul de comandă. Benchmark RO: 30–50%.',
    },
    {
      label: 'Submit',
      value: fmtNum(s.totalFormSubmits),
      rate: pct(s.rateStartToSubmit),
      rateLabel: 'completat',
      rateColor: rateCol(s.rateStartToSubmit),
      tooltip: 'Câți dintre cei care au început completarea formularului l-au și trimis. Abandon ridicat = problemă cu formularul. Benchmark RO: abandon 75–85%.',
    },
    {
      label: 'Comenzi',
      value: fmtNum(s.totalOrders),
      rate: pct(s.rateSubmitToOrder),
      rateLabel: 'confirmate',
      rateColor: rateCol(s.rateSubmitToOrder),
      tooltip: 'Câte comenzi au fost confirmate din totalul submit-urilor.',
    },
  ]
}

interface Props { snapshot?: JourneySnapshotDTO | null; isLoading?: boolean }

const EMPTY_STEPS: FunnelStep[] = MOCK_STEPS.map((s) => ({ label: s.label, value: '—' }))

export function JourneyFunnel({ snapshot, isLoading }: Props) {
  const steps = snapshot ? snapshotToSteps(snapshot) : EMPTY_STEPS

  if (isLoading) {
    return (
      <div className="flex items-stretch gap-0">
        {MOCK_STEPS.map((step, i) => (
          <>
            {i > 0 && (
              <div key={`arrow-${i}`} className="flex items-center justify-center px-1 flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-[#D0C5AF]" strokeWidth={2} />
              </div>
            )}
            <div
              key={step.label}
              className="flex-1 bg-white border border-[#E7E5E4] p-5 rounded-xl flex flex-col items-center text-center shadow-sm min-w-0"
            >
              <div className="h-2.5 w-14 bg-[#E7E5E4] rounded animate-pulse mb-3" />
              <div className="h-7 w-12 bg-[#E7E5E4] rounded animate-pulse" />
            </div>
          </>
        ))}
      </div>
    )
  }

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
            className="group relative flex-1 bg-white border border-[#E7E5E4] p-5 rounded-xl flex flex-col items-center text-center hover:bg-[#FAFAF9] transition-colors shadow-sm min-w-0"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] mb-3">
              {step.label}
            </span>
            <span className="text-2xl font-bold text-[#1C1917]">{step.value}</span>
            {step.rate && (
              <span
                className={cn(
                  'mt-2 text-[10px] font-bold px-2 py-0.5 rounded cursor-default',
                  rateClasses[step.rateColor ?? 'blue']
                )}
              >
                {step.rateLabel ? `${step.rateLabel}: ${step.rate}` : step.rate}
              </span>
            )}
            {/* Tooltip */}
            {step.tooltip && (
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#1C1917] text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 shadow-lg">
                {step.tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1C1917]" />
              </div>
            )}
          </div>
        </>
      ))}
    </div>
  )
}
