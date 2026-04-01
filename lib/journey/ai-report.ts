import Anthropic from '@anthropic-ai/sdk'
import { RO_MARKET_KNOWLEDGE } from './knowledge-base'

interface SnapshotInput {
  id: string
  periodDays: number
  totalImpressions: number
  totalAdClicks: number
  totalProductViews: number
  totalScrollToForm: number
  totalFormStarts: number
  totalFormSubmits: number
  totalOrders: number
  ctrAd: number
  rateVisitToScroll: number
  rateScrollToStart: number
  rateStartToSubmit: number
  rateSubmitToOrder: number
  overallConversion: number
}

const client = new Anthropic()

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export interface AIReportProblem {
  title: string
  severity: 'critical' | 'medium' | 'low'
  description: string
  metric: string
  benchmark: string
}

export interface AIReportSuggestion {
  problemRef: string
  action: string
  example: string
  expectedImpact: string
}

export interface AIReportQuickWin {
  action: string
  effort: 'low' | 'medium'
  impact: 'low' | 'medium' | 'high'
}

export interface AIReport {
  problems: AIReportProblem[]
  suggestions: AIReportSuggestion[]
  quickWins: AIReportQuickWin[]
}

export async function generateJourneyAIReport(snapshot: SnapshotInput): Promise<AIReport> {
  const prompt = `
CONTEXT PIAȚĂ ROMÂNIA:
${RO_MARKET_KNOWLEDGE}

DATELE MAGAZINULUI (ultimele ${snapshot.periodDays} zile):
Funnel:
  - Impresii reclamă: ${snapshot.totalImpressions}
  - Clickuri reclamă: ${snapshot.totalAdClicks} (CTR: ${pct(snapshot.ctrAd)})
  - Vizite produs: ${snapshot.totalProductViews}
  - Scroll la formular: ${snapshot.totalScrollToForm} (${pct(snapshot.rateVisitToScroll)} din vizite)
  - Start completare formular: ${snapshot.totalFormStarts} (${pct(snapshot.rateScrollToStart)} din scroll)
  - Submit formular: ${snapshot.totalFormSubmits} (${pct(snapshot.rateStartToSubmit)} din start — abandon ${pct(1 - snapshot.rateStartToSubmit)})
  - Comenzi confirmate: ${snapshot.totalOrders} (${pct(snapshot.rateSubmitToOrder)} din submit)
  - Conversie globală ad→comandă: ${pct(snapshot.overallConversion)}

Generează un raport JSON cu structura exactă (fără text în afara JSON):
{
  "problems": [
    {
      "title": "string scurt",
      "severity": "critical" | "medium" | "low",
      "description": "descriere concisă în română",
      "metric": "ex: Abandon formular 82%",
      "benchmark": "ex: Benchmark RO: 75–85%"
    }
  ],
  "suggestions": [
    {
      "problemRef": "titlul problemei la care se referă",
      "action": "acțiune concretă în română",
      "example": "exemplu real din piața RO",
      "expectedImpact": "ex: -10% abandon"
    }
  ],
  "quickWins": [
    {
      "action": "acțiune rapidă în română",
      "effort": "low" | "medium",
      "impact": "low" | "medium" | "high"
    }
  ]
}

Maxim 3 probleme, 3 sugestii, 2 quick wins. Focus pe probleme reale deduse din date. Limbă: română.
Răspunde DOAR cu JSON valid.
`.trim()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extract JSON - handle markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text

  const parsed = JSON.parse(jsonStr) as AIReport
  return parsed
}
