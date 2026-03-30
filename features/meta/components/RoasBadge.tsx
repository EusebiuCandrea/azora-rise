"use client"

interface Props {
  roas: number | null
}

export function RoasBadge({ roas }: Props) {
  if (roas === null || roas === 0) {
    return <span className="text-sm text-[#78716C]">—</span>
  }
  if (roas >= 3) return <span className="text-sm font-semibold text-[#D4AF37]">{roas.toFixed(1)}×</span>
  if (roas >= 1.5) return <span className="text-sm font-semibold text-[#16A34A]">{roas.toFixed(1)}×</span>
  return <span className="text-sm font-semibold text-[#DC2626]">{roas.toFixed(1)}×</span>
}
