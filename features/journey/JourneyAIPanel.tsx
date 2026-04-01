'use client'

import { Sparkles, RefreshCw, Rocket, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JourneyAIReportDTO } from './types'

const SEVERITY_LABELS: Record<string, string> = { critical: 'CRITICĂ', medium: 'MEDIE', low: 'MICĂ' }
const SEVERITY_STYLES: Record<string, { border: string; badge: string }> = {
  critical: { border: 'border-red-500', badge: 'bg-red-100 text-red-800' },
  medium: { border: 'border-orange-400', badge: 'bg-orange-100 text-orange-800' },
  low: { border: 'border-blue-400', badge: 'bg-blue-100 text-blue-800' },
}

interface Props {
  report: JourneyAIReportDTO | null
  onRegenerate?: () => void
  isRegenerating?: boolean
}

export function JourneyAIPanel({ report, onRegenerate, isRegenerating }: Props) {
  const generatedAt = report
    ? new Date(report.generatedAt).toLocaleString('ro-RO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
    : null

  return (
    <aside className="bg-[#faf5ff] rounded-3xl p-8 flex flex-col gap-6 shadow-sm border border-purple-100">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-purple-600" strokeWidth={1.5} />
            <h4 className="text-sm font-bold uppercase tracking-wider text-purple-600">Analiză AI</h4>
          </div>
          <p className="text-[10px] text-[#78716C] font-medium">
            {generatedAt ? `Generată ${generatedAt}` : 'Fără date încă'}
          </p>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-purple-500 hover:bg-purple-100 p-2 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isRegenerating && 'animate-spin')} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {isRegenerating && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border-l-4 border-gray-200 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* No data state */}
      {!isRegenerating && !report && (
        <div className="text-center py-8 text-[#78716C]">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nicio analiză disponibilă</p>
          <p className="text-xs mt-1">Apasă &quot;Analizează acum&quot; pentru a genera</p>
        </div>
      )}

      {/* Problem cards */}
      {!isRegenerating && report && (
        <>
          <div className="space-y-3">
            {report.problems.map((p) => {
              const s = SEVERITY_STYLES[p.severity] ?? SEVERITY_STYLES.low
              return (
                <div key={p.title} className={cn('bg-white p-4 rounded-2xl border-l-4 shadow-sm', s.border)}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', s.badge)}>
                      {SEVERITY_LABELS[p.severity] ?? p.severity.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-[#78716C]">{p.metric}</span>
                  </div>
                  <h5 className="font-bold text-[#1C1917] text-sm mb-1">{p.title}</h5>
                  <p className="text-xs text-[#78716C] leading-relaxed">{p.description}</p>
                </div>
              )
            })}
          </div>

          {/* Quick wins */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#78716C]">
              Ce testezi săptămâna aceasta
            </h5>
            <div className="space-y-2">
              {report.quickWins.map((qw, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/60 rounded-xl hover:bg-white transition-all cursor-pointer">
                  <Rocket className="w-4 h-4 text-purple-500 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-[#1C1917]">{qw.action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestion highlight */}
          {report.suggestions[0] && (
            <div className="mt-auto bg-gradient-to-br from-[#D4AF37] to-[#B8971F] p-6 rounded-2xl text-[#1C1917] shadow-lg overflow-hidden relative group">
              <Trophy
                className="absolute -right-3 -bottom-3 w-20 h-20 opacity-10 rotate-12 group-hover:scale-110 transition-transform"
                strokeWidth={1}
              />
              <h6 className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-70">
                Prioritate
              </h6>
              <p className="text-sm font-semibold italic leading-relaxed">
                &quot;{report.suggestions[0].action}&quot;
              </p>
              {report.suggestions[0].expectedImpact && (
                <p className="text-[10px] mt-2 opacity-70">{report.suggestions[0].expectedImpact}</p>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
