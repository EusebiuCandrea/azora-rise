"use client"

interface MetricPoint {
  date: string
  spend: number
  roas: number | null
}

interface Props {
  metrics: MetricPoint[]
}

export function CampaignMetricsChart({ metrics }: Props) {
  if (metrics.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#E7E5E4] bg-[#FAFAF9] text-sm text-[#78716C]">
        Nu există date pentru perioada selectată
      </div>
    )
  }

  const sorted = [...metrics].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const maxSpend = Math.max(...sorted.map((m) => m.spend), 1)
  const maxRoas = Math.max(...sorted.filter((m) => m.roas !== null).map((m) => m.roas!), 1)
  const W = 600
  const H = 180
  const pad = { l: 40, r: 40, t: 10, b: 28 }
  const chartW = W - pad.l - pad.r
  const chartH = H - pad.t - pad.b

  const xStep = chartW / Math.max(sorted.length - 1, 1)

  const spendPath = sorted
    .map((m, i) => {
      const x = pad.l + i * xStep
      const y = pad.t + chartH - (m.spend / maxSpend) * chartH
      return `${i === 0 ? "M" : "L"}${x},${y}`
    })
    .join(" ")

  const roasPath = sorted
    .filter((m) => m.roas !== null)
    .map((m, i) => {
      const origIdx = sorted.findIndex((s) => s.date === m.date)
      const x = pad.l + origIdx * xStep
      const y = pad.t + chartH - (m.roas! / maxRoas) * chartH
      return `${i === 0 ? "M" : "L"}${x},${y}`
    })
    .join(" ")

  const labelEvery = Math.ceil(sorted.length / 7)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
        {/* Grid */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.l}
            y1={pad.t + chartH * (1 - t)}
            x2={W - pad.r}
            y2={pad.t + chartH * (1 - t)}
            stroke="#E7E5E4"
            strokeWidth={1}
          />
        ))}
        <path d={spendPath} fill="none" stroke="#292524" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {roasPath && (
          <path d={roasPath} fill="none" stroke="#D4AF37" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* X labels */}
        {sorted.map((m, i) => {
          if (i % labelEvery !== 0) return null
          const x = pad.l + i * xStep
          const label = new Date(m.date).toLocaleDateString("ro-RO", {
            day: "2-digit",
            month: "short",
          })
          return (
            <text key={m.date} x={x} y={H - 4} textAnchor="middle" fontSize={10} fill="#78716C">
              {label}
            </text>
          )
        })}
        {/* Legend */}
        <circle cx={pad.l} cy={8} r={4} fill="#292524" />
        <text x={pad.l + 8} y={12} fontSize={10} fill="#78716C">Spend</text>
        <circle cx={pad.l + 70} cy={8} r={4} fill="#D4AF37" />
        <text x={pad.l + 78} y={12} fontSize={10} fill="#78716C">ROAS</text>
      </svg>
    </div>
  )
}
