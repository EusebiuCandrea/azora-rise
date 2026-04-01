import type { JourneyHistoryPoint } from './types'

interface Props {
  history?: JourneyHistoryPoint[]
  period?: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

export function JourneyMetricsChart({ history = [], period = '30' }: Props) {
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

  return (
    <div className="bg-white border border-[#E7E5E4] p-8 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h4 className="text-xl font-semibold text-[#1C1917]">Evoluție Rată Conversie</h4>
        <span className="text-sm text-[#78716C]">Ultimele {period} zile</span>
      </div>
      <div className="h-48 flex items-end justify-between gap-0.5 px-1">
        {history.map((point, i) => (
          <div
            key={i}
            className="flex-1 bg-[#D4AF37]/40 hover:bg-[#D4AF37]/70 transition-colors rounded-t-sm cursor-pointer"
            style={{ height: `${Math.max((point.overallConversion / max) * 100, 2)}%` }}
            title={`${formatDate(point.date)}: ${(point.overallConversion * 100).toFixed(2)}% (${point.totalOrders} comenzi)`}
          />
        ))}
      </div>
    </div>
  )
}
