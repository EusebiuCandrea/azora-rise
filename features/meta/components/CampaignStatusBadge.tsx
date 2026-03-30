"use client"

interface Props {
  status: string
}

const CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  ACTIVE:    { label: "Activ",    dot: "#16A34A", text: "#16A34A" },
  PAUSED:    { label: "Pauzat",   dot: "#D97706", text: "#D97706" },
  DRAFT:     { label: "Draft",    dot: "#6B7280", text: "#6B7280" },
  COMPLETED: { label: "Finalizat",dot: "#4B5563", text: "#4B5563" },
}

export function CampaignStatusBadge({ status }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.DRAFT
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span
        style={{ background: cfg.dot }}
        className="w-2 h-2 rounded-full inline-block"
      />
      <span style={{ color: cfg.text }}>{cfg.label}</span>
    </span>
  )
}
