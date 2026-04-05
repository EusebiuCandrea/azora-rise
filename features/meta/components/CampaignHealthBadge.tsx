interface Props {
  score: number | null
}

export function CampaignHealthBadge({ score }: Props) {
  if (score === null) return <span className="text-xs text-[#A8A29E]">—</span>

  const { color, bg, label } =
    score >= 80
      ? { color: "text-[#166534]", bg: "bg-[#DCFCE7]", label: "Excelent" }
      : score >= 60
        ? { color: "text-[#1D4ED8]", bg: "bg-[#DBEAFE]", label: "Bun" }
        : score >= 40
          ? { color: "text-[#92400E]", bg: "bg-[#FEF3C7]", label: "Atenție" }
          : { color: "text-[#991B1B]", bg: "bg-[#FEE2E2]", label: "Critic" }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${bg} ${color}`}>
      {score}
      <span className="font-normal opacity-70">{label}</span>
    </span>
  )
}
