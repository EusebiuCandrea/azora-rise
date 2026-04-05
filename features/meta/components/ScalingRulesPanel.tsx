"use client"

import Link from "next/link"
import { TrendingUp, TrendingDown, Pause, Sparkles } from "lucide-react"
import type { ScalingSuggestion } from "@/features/meta/scaling-rules"

interface Props {
  suggestions: ScalingSuggestion[]
}

const ACTION_CONFIG = {
  suggest_increase: {
    icon: TrendingUp,
    color: "text-[#166534]",
    bg: "bg-[#DCFCE7]",
    border: "border-[#BBF7D0]",
    label: "Mărește bugetul",
  },
  suggest_decrease: {
    icon: TrendingDown,
    color: "text-[#92400E]",
    bg: "bg-[#FEF3C7]",
    border: "border-[#FDE68A]",
    label: "Scade bugetul",
  },
  suggest_pause: {
    icon: Pause,
    color: "text-[#991B1B]",
    bg: "bg-[#FEE2E2]",
    border: "border-[#FECACA]",
    label: "Oprește campania",
  },
  suggest_new_creative: {
    icon: Sparkles,
    color: "text-[#1D4ED8]",
    bg: "bg-[#DBEAFE]",
    border: "border-[#BFDBFE]",
    label: "Creativ nou",
  },
} as const

export function ScalingRulesPanel({ suggestions }: Props) {
  if (suggestions.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C]">
        Sugestii scalare
      </p>
      {suggestions.map((s, i) => {
        const cfg = ACTION_CONFIG[s.action]
        const Icon = cfg.icon
        return (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-3`}
          >
            <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${cfg.color}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-[#78716C]">· {s.reason}</span>
              </div>
              <p className="mt-0.5 text-xs text-[#44403C]">{s.detail}</p>
            </div>
            <Link
              href={`/campaigns/${s.campaignId}`}
              className="flex-shrink-0 rounded-lg border border-current px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "inherit" }}
            >
              Aplică
            </Link>
          </div>
        )
      })}
    </div>
  )
}
