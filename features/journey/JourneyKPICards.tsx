import { BarChart2, HeartCrack, Timer } from 'lucide-react'
import type { JourneySnapshotDTO, PaymentSplit } from './types'

interface Props { snapshot?: JourneySnapshotDTO | null; paymentSplit?: PaymentSplit | null; isLoading?: boolean }

function pct(n: number, dec = 1): string { return `${(n * 100).toFixed(dec)}%` }

function fmtDuration(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function JourneyKPICards({ snapshot, paymentSplit, isLoading }: Props) {
  const conversion = snapshot ? pct(snapshot.overallConversion) : '—'
  const abandon = snapshot ? pct(1 - snapshot.rateStartToSubmit) : '—'
  const abandonHigh = snapshot ? snapshot.rateStartToSubmit < 0.4 : false
  const avgTime = snapshot ? fmtDuration(snapshot.avgFormCompletionSec) : '—'

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
            <div className="h-2.5 w-24 bg-[#E7E5E4] rounded animate-pulse" />
            <div className="h-9 w-20 bg-[#E7E5E4] rounded animate-pulse" />
            <div className="h-2 w-32 bg-[#E7E5E4] rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Conversie Globală */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <div className="flex justify-between items-start">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
            Conversie Globală
          </h3>
          <BarChart2 className="w-4 h-4 text-[#D4AF37]" strokeWidth={1.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#1C1917]">{conversion}</span>
        </div>
        <p className="text-[10px] text-[#78716C]/70 italic">Benchmark RO: 1.2–2.5%</p>
      </div>

      {/* Abandon Formular */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <div className="flex justify-between items-start">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
            Abandon Formular
          </h3>
          <HeartCrack className={`w-4 h-4 ${abandonHigh ? 'text-red-500' : 'text-green-600'}`} strokeWidth={1.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#1C1917]">{abandon}</span>
        </div>
        <p className="text-[10px] text-[#78716C]/70 italic">Benchmark RO: 75–85%</p>
      </div>

      {/* Timp Mediu Submit */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <div className="flex justify-between items-start">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
            Timp Mediu Submit
          </h3>
          <Timer className="w-4 h-4 text-[#78716C]" strokeWidth={1.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#1C1917]">{avgTime}</span>
        </div>
        <p className="text-[10px] text-[#78716C]/70 italic">Timp mediu completare formular</p>
      </div>

      {/* COD vs Card Split */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
          COD vs Card Split
        </h3>
        {paymentSplit ? (
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex justify-between text-[10px] font-bold text-[#1C1917]">
              <span>RAMBURS {pct(paymentSplit.codPct, 0)}</span>
              <span>CARD {pct(paymentSplit.cardPct, 0)}</span>
            </div>
            <div className="h-3 w-full bg-[#E7E5E4] rounded-full flex overflow-hidden">
              <div className="h-full bg-[#D4AF37]" style={{ width: `${paymentSplit.codPct * 100}%` }} />
              <div className="h-full bg-[#A78A00]" style={{ width: `${paymentSplit.cardPct * 100}%` }} />
            </div>
            <p className="text-[10px] text-[#78716C]/70">{paymentSplit.total} comenzi totale</p>
          </div>
        ) : (
          <p className="text-[10px] text-[#78716C]/70 mt-auto italic">Fără comenzi finalizate încă</p>
        )}
      </div>
    </div>
  )
}
