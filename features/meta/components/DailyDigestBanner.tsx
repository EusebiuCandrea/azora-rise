import { Sparkles } from "lucide-react"

interface Props {
  summary: string
  generatedAt: Date
  campaignCount: number
}

export function DailyDigestBanner({ summary, generatedAt, campaignCount }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E7D97F] bg-[#FFFDF0] px-5 py-4 shadow-sm">
      <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D4AF37]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#92700A]">
            Digest AI zilnic
          </p>
          <span className="text-xs text-[#A8A29E]">
            {generatedAt.toLocaleString("ro-RO", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "short",
            })}
            {" · "}{campaignCount} campanii analizate
          </span>
        </div>
        <p className="mt-1 text-sm text-[#44403C]">{summary}</p>
      </div>
    </div>
  )
}
