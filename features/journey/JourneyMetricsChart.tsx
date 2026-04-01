const bars = [40, 45, 42, 55, 38, 65, 30, 75, 50, 42, 58, 48, 35, 62, 45, 52, 40, 68, 55, 72, 48, 60, 38, 70, 55, 45, 62, 50, 68, 58]

export function JourneyMetricsChart() {
  const max = Math.max(...bars)

  return (
    <div className="bg-white border border-[#E7E5E4] p-8 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h4 className="text-xl font-semibold text-[#1C1917]">Evoluție Rată Conversie</h4>
        <span className="text-sm text-[#78716C]">Ultimele 30 zile</span>
      </div>
      <div className="h-48 flex items-end justify-between gap-0.5 px-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/50 transition-colors rounded-t-sm cursor-pointer"
            style={{ height: `${(h / max) * 100}%` }}
            title={`Ziua ${i + 1}: ${h}%`}
          />
        ))}
      </div>
    </div>
  )
}
