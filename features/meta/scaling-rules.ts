import { db } from "@/lib/db"
import { RO_BENCHMARKS } from "./knowledge-base"

// ─── Tipuri ───────────────────────────────────────────────────────────────────

type ScalingTrigger = "roas_above" | "roas_below" | "cpa_above" | "frequency_above"
type ScalingAction =
  | "suggest_increase"
  | "suggest_decrease"
  | "suggest_pause"
  | "suggest_new_creative"

interface ScalingRule {
  trigger: ScalingTrigger
  threshold: number
  consecutiveDays: number
  action: ScalingAction
  changePercent?: number
}

export interface ScalingSuggestion {
  campaignId: string
  campaignName: string
  action: ScalingAction
  reason: string
  detail: string
  changePercent?: number
}

// ─── Reguli default ───────────────────────────────────────────────────────────

const DEFAULT_RULES: ScalingRule[] = [
  {
    trigger: "roas_above",
    threshold: RO_BENCHMARKS.roas.good,       // 3.5x
    consecutiveDays: 3,
    action: "suggest_increase",
    changePercent: RO_BENCHMARKS.maxBudgetIncreasePercent, // 20%
  },
  {
    trigger: "roas_below",
    threshold: RO_BENCHMARKS.roas.poor,        // 1.5x
    consecutiveDays: 5,
    action: "suggest_pause",
  },
  {
    trigger: "frequency_above",
    threshold: RO_BENCHMARKS.frequency.danger, // 3.5
    consecutiveDays: 3,
    action: "suggest_new_creative",
  },
  {
    trigger: "cpa_above",
    threshold: 150,                            // RON
    consecutiveDays: 7,
    action: "suggest_decrease",
    changePercent: RO_BENCHMARKS.maxBudgetIncreasePercent, // 20%
  },
]

// ─── Evaluare reguli ──────────────────────────────────────────────────────────

export async function evaluateScalingRules(
  organizationId: string,
  rules: ScalingRule[] = DEFAULT_RULES
): Promise<ScalingSuggestion[]> {
  const maxDays = Math.max(...rules.map((r) => r.consecutiveDays))

  const campaigns = await db.campaign.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: {
      metrics: {
        orderBy: { date: "desc" },
        take: maxDays,
        select: {
          spend: true,
          purchases: true,
          purchaseValue: true,
          roas: true,
          frequency: true,
        },
      },
    },
  })

  const suggestions: ScalingSuggestion[] = []

  for (const campaign of campaigns) {
    if (campaign.metrics.length === 0) continue

    for (const rule of rules) {
      const recentMetrics = campaign.metrics.slice(0, rule.consecutiveDays)
      if (recentMetrics.length < rule.consecutiveDays) continue

      const triggered = recentMetrics.every((m) => {
        switch (rule.trigger) {
          case "roas_above":
            return m.roas !== null && m.roas > rule.threshold
          case "roas_below":
            return m.roas !== null && m.roas < rule.threshold
          case "frequency_above":
            return m.frequency !== null && m.frequency > rule.threshold
          case "cpa_above": {
            const cpa = m.purchases > 0 ? m.spend / m.purchases : null
            return cpa !== null && cpa > rule.threshold
          }
        }
      })

      if (!triggered) continue

      const latestMetric = recentMetrics[0]
      const avgRoas =
        recentMetrics.filter((m) => m.roas !== null).reduce((s, m) => s + (m.roas ?? 0), 0) /
        (recentMetrics.filter((m) => m.roas !== null).length || 1)

      const suggestion = buildSuggestion(campaign, rule, latestMetric, avgRoas)
      if (suggestion) suggestions.push(suggestion)
    }
  }

  return suggestions
}

function buildSuggestion(
  campaign: { id: string; name: string; budget: number },
  rule: ScalingRule,
  latestMetric: { roas: number | null; frequency: number | null; spend: number; purchases: number },
  avgRoas: number
): ScalingSuggestion | null {
  const newBudget = rule.changePercent
    ? (campaign.budget * (1 + rule.changePercent / 100)).toFixed(0)
    : null

  switch (rule.action) {
    case "suggest_increase":
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "suggest_increase",
        reason: `ROAS ${avgRoas.toFixed(2)}x timp de ${rule.consecutiveDays} zile consecutive`,
        detail: `Mărește bugetul de la ${campaign.budget} RON → ${newBudget} RON/zi (+${rule.changePercent}%)`,
        changePercent: rule.changePercent,
      }

    case "suggest_pause":
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "suggest_pause",
        reason: `ROAS sub ${rule.threshold}x timp de ${rule.consecutiveDays} zile consecutive`,
        detail: `ROAS mediu: ${avgRoas.toFixed(2)}x — campania pierde bani. Oprește sau schimbă creativul.`,
      }

    case "suggest_new_creative":
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "suggest_new_creative",
        reason: `Frequency ${latestMetric.frequency?.toFixed(1)}x — audiența s-a saturat`,
        detail: `Aceeași persoană vede reclama de ${latestMetric.frequency?.toFixed(1)}x. Rulează un creativ nou sau extinde audiența.`,
      }

    case "suggest_decrease":
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "suggest_decrease",
        reason: `CPA ridicat timp de ${rule.consecutiveDays} zile`,
        detail: `Scade bugetul de la ${campaign.budget} RON → ${newBudget} RON/zi (-${rule.changePercent}%) pentru a reduce pierderile.`,
        changePercent: rule.changePercent,
      }
  }
}

// ─── API route helper ─────────────────────────────────────────────────────────

export async function getScalingSuggestionsForCampaign(
  organizationId: string,
  campaignId: string
): Promise<ScalingSuggestion[]> {
  const all = await evaluateScalingRules(organizationId)
  return all.filter((s) => s.campaignId === campaignId)
}
