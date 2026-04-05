"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles, RefreshCw, Video, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { CampaignHealthBadge } from "./CampaignHealthBadge"
import { ScalingRulesPanel } from "./ScalingRulesPanel"
import type { CampaignStatus, CampaignProblem, CampaignSuggestion, VideoBrief } from "@/features/meta/knowledge-base"
import type { ScalingSuggestion } from "@/features/meta/scaling-rules"

interface AIReport {
  healthScore: number | null
  status: CampaignStatus | null
  summary: string
  problems: CampaignProblem[]
  suggestions: CampaignSuggestion[]
  videoBrief?: VideoBrief | null
  generatedAt: string
}

interface Props {
  campaignId: string
  initialReport: AIReport | null
  scalingSuggestions?: ScalingSuggestion[]
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   "bg-[#FEE2E2] text-[#991B1B]",
  medium: "bg-[#FEF3C7] text-[#92400E]",
  low:    "bg-[#F5F5F4] text-[#57534E]",
}

export function CampaignAIPanel({ campaignId, initialReport, scalingSuggestions = [] }: Props) {
  const [report, setReport] = useState<AIReport | null>(initialReport)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [briefExpanded, setBriefExpanded] = useState(false)

  async function refreshAnalysis() {
    setLoadingAnalysis(true)
    setError(null)
    try {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/analyze`, { method: "POST" })
      if (!res.ok) throw new Error("Eroare server")
      const data = await res.json()
      setReport({
        ...data,
        generatedAt: new Date().toISOString(),
        videoBrief: report?.videoBrief ?? null,
      })
    } catch {
      setError("Nu s-a putut genera analiza. Încearcă din nou.")
    } finally {
      setLoadingAnalysis(false)
    }
  }

  async function generateBrief() {
    setLoadingBrief(true)
    setError(null)
    try {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/video-brief`, { method: "POST" })
      if (!res.ok) throw new Error("Eroare server")
      const brief = await res.json()
      setReport((prev) => prev ? { ...prev, videoBrief: brief } : prev)
      setBriefExpanded(true)
    } catch {
      setError("Nu s-a putut genera brief-ul video. Încearcă din nou.")
    } finally {
      setLoadingBrief(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#E7E5E4] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E7E5E4] px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-sm font-semibold text-[#1C1917]">Analiză AI</span>
          {report?.generatedAt && (
            <span className="text-xs text-[#A8A29E]">
              · {new Date(report.generatedAt).toLocaleString("ro-RO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
            </span>
          )}
        </div>
        <button
          onClick={refreshAnalysis}
          disabled={loadingAnalysis}
          className="flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] px-3 py-1.5 text-xs font-medium text-[#57534E] transition-colors hover:bg-[#F5F5F4] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loadingAnalysis ? "animate-spin" : ""}`} />
          {loadingAnalysis ? "Se analizează..." : "Analizează"}
        </button>
      </div>

      {error && (
        <div className="px-5 py-3 text-sm text-[#DC2626] bg-[#FEF2F2] border-b border-[#FECACA]">
          {error}
        </div>
      )}

      {!report ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-[#78716C]">Nicio analiză generată încă.</p>
          <p className="mt-1 text-xs text-[#A8A29E]">Apasă „Analizează" pentru a genera prima analiză AI.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E7E5E4]">
          {/* Health Score */}
          <div className="flex items-center gap-4 px-5 py-4">
            <CampaignHealthBadge score={report.healthScore} />
            <p className="text-sm text-[#44403C] flex-1">{report.summary}</p>
          </div>

          {/* Probleme */}
          {report.problems.length > 0 && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C]">Probleme identificate</p>
              {report.problems.map((p, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_STYLES[p.severity]}`}>
                    {p.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1C1917]">{p.title}</p>
                    <p className="mt-0.5 text-xs text-[#78716C]">
                      {p.metric}: <span className="font-medium text-[#1C1917]">{p.value}</span>
                      {" "}(benchmark: {p.benchmark})
                    </p>
                    <p className="mt-0.5 text-xs text-[#57534E]">{p.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sugestii */}
          {report.suggestions.length > 0 && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C]">Acțiuni recomandate</p>
              {report.suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[10px] font-bold text-[#1C1917]">
                    {s.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1C1917]">{s.action}</p>
                    <p className="mt-0.5 text-xs text-[#78716C]">{s.expectedImpact}</p>
                    <p className="mt-0.5 text-xs text-[#57534E] italic">{s.howTo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scaling Rules */}
          {scalingSuggestions.length > 0 && (
            <div className="px-5 py-4">
              <ScalingRulesPanel suggestions={scalingSuggestions} />
            </div>
          )}

          {/* Video Brief */}
          <div className="px-5 py-4">
            {!report.videoBrief ? (
              <button
                onClick={generateBrief}
                disabled={loadingBrief}
                className="flex items-center gap-2 rounded-lg border border-[#E7E5E4] px-4 py-2 text-sm font-medium text-[#57534E] transition-colors hover:bg-[#F5F5F4] disabled:opacity-50"
              >
                <Video className={`h-4 w-4 ${loadingBrief ? "animate-pulse" : ""}`} />
                {loadingBrief ? "Se generează brief-ul..." : "Generează Brief Video"}
              </button>
            ) : (
              <div>
                <button
                  onClick={() => setBriefExpanded((v) => !v)}
                  className="flex w-full items-center justify-between text-sm font-semibold text-[#1C1917]"
                >
                  <span className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-[#D4AF37]" />
                    Brief Video generat
                  </span>
                  {briefExpanded ? <ChevronUp className="h-4 w-4 text-[#78716C]" /> : <ChevronDown className="h-4 w-4 text-[#78716C]" />}
                </button>

                {briefExpanded && (
                  <div className="mt-4 space-y-4 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4] p-4 text-sm">
                    <p className="text-xs italic text-[#78716C]">{report.videoBrief.diagnosis}</p>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C] mb-1">
                        Hook ({report.videoBrief.hook.duration_sec}s) — {report.videoBrief.hook.type}
                      </p>
                      <p className="font-medium text-[#1C1917]">„{report.videoBrief.hook.script}"</p>
                      <p className="mt-1 text-xs text-[#57534E]">{report.videoBrief.hook.visual}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C] mb-1">
                        Corp ({report.videoBrief.body.duration_sec}s) — {report.videoBrief.body.structure}
                      </p>
                      <ul className="space-y-1">
                        {report.videoBrief.body.key_points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#44403C]">
                            <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D4AF37]" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C] mb-1">
                        Dovadă Socială ({report.videoBrief.social_proof.duration_sec}s)
                      </p>
                      <p className="text-xs text-[#44403C]">„{report.videoBrief.social_proof.content}"</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C] mb-1">
                        CTA ({report.videoBrief.cta.duration_sec}s)
                      </p>
                      <p className="text-xs font-medium text-[#1C1917]">{report.videoBrief.cta.script}</p>
                      <p className="mt-0.5 text-xs text-[#57534E]">{report.videoBrief.cta.visual}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#78716C]">
                      <span>Format: {report.videoBrief.format}</span>
                      <span>·</span>
                      <span>Durată: {report.videoBrief.total_duration_sec}s</span>
                    </div>

                    {report.videoBrief.notes.length > 0 && (
                      <div className="border-t border-[#E7E5E4] pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C] mb-1">Note producție</p>
                        <ul className="space-y-1">
                          {report.videoBrief.notes.map((note, i) => (
                            <li key={i} className="text-xs text-[#57534E]">· {note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="border-t border-[#E7E5E4] pt-3">
                      <Link
                        href={`/videos/new?campaignId=${campaignId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#B8971F]"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Creare video pe baza brief-ului
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
