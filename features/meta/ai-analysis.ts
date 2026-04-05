import { GoogleGenAI } from "@google/genai"
import { db } from "@/lib/db"
import { CampaignReportType } from "@prisma/client"
import {
  RO_BENCHMARKS,
  AZORA_CONTEXT,
  type AIReportContent,
  type CampaignStatus,
  type VideoBrief,
} from "./knowledge-base"

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')
  return new GoogleGenAI({ apiKey })
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
Ești un expert în Meta Ads optimization pentru e-commerce românesc (beauty/wellness devices, produse cadou).
Analizezi campanii și oferi recomandări concrete, bazate pe date reale.

${AZORA_CONTEXT}

Benchmarks piata RO — Blueprint Supreme Ecom KPI + AC Hampton (folosite în analiză):
- ROAS: sub ${RO_BENCHMARKS.roas.poor}x = pierdere (sub break-even), ${RO_BENCHMARKS.roas.ok}-${RO_BENCHMARKS.roas.good}x = ok, ${RO_BENCHMARKS.roas.good}x+ = bun/scalare, ${RO_BENCHMARKS.roas.excellent}x+ = excelent
  Formula BE ROAS = AOV ÷ (AOV − COGS − Fees%). Azora ~250 RON produs, COGS ~80 RON → BE ROAS ≈ 1.5x, target 20% profit → ROAS ≥ 2.1x
- CTR: sub ${RO_BENCHMARKS.ctr.poor}% = hook slab, ${RO_BENCHMARKS.ctr.good}%+ = bun (Blueprint: ≥2.5% = creative test pass)
- CPM: sub ${RO_BENCHMARKS.cpm.good} RON = ieftin, peste ${RO_BENCHMARKS.cpm.poor} RON = scump
- CPULC (cost per click unic): sub ${RO_BENCHMARKS.cpulc.good} RON = bun, peste ${RO_BENCHMARKS.cpulc.poor} RON = slab
- CPATC (cost per add-to-cart): sub ${RO_BENCHMARKS.cpatc.good} RON = bun, peste ${RO_BENCHMARKS.cpatc.poor} RON = slab
- CPA/CPP (cost per achiziție): sub ${RO_BENCHMARKS.cpp.good} RON = profitabil, peste ${RO_BENCHMARKS.cpp.poor} RON = pierdere
- Frequency: peste ${RO_BENCHMARKS.frequency.danger} = audiența obosita (roteaza creativul)
- Hook rate (p25/plays): sub ${RO_BENCHMARKS.hookRate.poor * 100}% = hook slab, ${RO_BENCHMARKS.hookRate.good * 100}%+ = bun
- Landing page rate (lpv/clicks): sub ${RO_BENCHMARKS.landingPageViewRate.poor * 100}% = problema URL/loading
- Add to cart rate: ${RO_BENCHMARKS.addToCartRate.ok * 100}% = baseline, sub ${RO_BENCHMARKS.addToCartRate.poor * 100}% = pagina produsului e problema
- O campanie are nevoie de minim ${RO_BENCHMARKS.minDaysBeforeDecision} zile și ${RO_BENCHMARKS.minSpendBeforeDecision} RON pentru decizie
- Break-even ladder (Blueprint): fără ATC după ${RO_BENCHMARKS.minSpendBeforeDecision} RON = oprești; cu ATC = lasă până la CPA break-even (${RO_BENCHMARKS.cpp.ok} RON)

Reguli pentru răspuns:
1. Fii specific cu numere reale din date — nu generaliza
2. Maxim 3 sugestii prioritare per campanie
3. Identifică dacă problema e la creative (CTR, hook), audiență (CPM, frequency) sau landing page (lpv rate, ATC rate)
4. Sugerează video brief doar dacă campania are date video și hook rate < 45%
5. Răspunde EXCLUSIV în limba română
6. Returnează EXCLUSIV JSON valid, fără text în afara JSON-ului
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcHealthScore(metrics: {
  roas: number | null
  ctr: number | null
  cpm: number | null
  frequency: number | null
  hookRate: number | null
  landingPageViewRate: number | null
  spend: number
  purchases: number
  addToCart: number | null
}): { score: number; status: CampaignStatus } {
  let score = 100

  // ROAS (0-30 puncte)
  if (metrics.roas !== null) {
    if (metrics.roas < RO_BENCHMARKS.roas.poor) score -= 30
    else if (metrics.roas < RO_BENCHMARKS.roas.ok) score -= 20
    else if (metrics.roas < RO_BENCHMARKS.roas.good) score -= 10
  } else if (metrics.spend > RO_BENCHMARKS.minSpendBeforeDecision) {
    score -= 25 // spend mare fără ROAS = probabil 0 comenzi
  }

  // CTR (0-20 puncte)
  if (metrics.ctr !== null) {
    if (metrics.ctr < RO_BENCHMARKS.ctr.poor) score -= 20
    else if (metrics.ctr < RO_BENCHMARKS.ctr.ok) score -= 12
    else if (metrics.ctr < RO_BENCHMARKS.ctr.good) score -= 5
  }

  // CPM (0-15 puncte)
  if (metrics.cpm !== null) {
    if (metrics.cpm > RO_BENCHMARKS.cpm.poor) score -= 15
    else if (metrics.cpm > RO_BENCHMARKS.cpm.ok) score -= 8
    else if (metrics.cpm > RO_BENCHMARKS.cpm.good) score -= 3
  }

  // Frequency (0-15 puncte)
  if (metrics.frequency !== null) {
    if (metrics.frequency > RO_BENCHMARKS.frequency.danger) score -= 15
    else if (metrics.frequency > RO_BENCHMARKS.frequency.warning) score -= 8
  }

  // Hook rate video (0-10 puncte)
  if (metrics.hookRate !== null) {
    if (metrics.hookRate < RO_BENCHMARKS.hookRate.poor) score -= 10
    else if (metrics.hookRate < RO_BENCHMARKS.hookRate.ok) score -= 5
  }

  // Landing page drop (0-10 puncte)
  if (metrics.landingPageViewRate !== null) {
    if (metrics.landingPageViewRate < RO_BENCHMARKS.landingPageViewRate.poor) score -= 10
    else if (metrics.landingPageViewRate < RO_BENCHMARKS.landingPageViewRate.ok) score -= 5
  }

  const finalScore = Math.max(0, Math.min(100, score))

  let status: CampaignStatus
  if (finalScore >= 80) status = "excellent"
  else if (finalScore >= 60) status = "good"
  else if (finalScore >= 40) status = "warning"
  else status = "critical"

  return { score: finalScore, status }
}

// ─── Pull metrici campanie (7 zile) ──────────────────────────────────────────

async function getCampaignMetricsForAnalysis(campaignId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const metrics = await db.campaignMetrics.findMany({
    where: {
      campaignId,
      date: { gte: sevenDaysAgo },
    },
    orderBy: { date: "desc" },
  })

  if (metrics.length === 0) return null

  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      purchases: acc.purchases + m.purchases,
      purchaseValue: acc.purchaseValue + (m.purchaseValue ?? 0),
      landingPageViews: acc.landingPageViews + (m.landingPageViews ?? 0),
      addToCart: acc.addToCart + (m.addToCart ?? 0),
      initiateCheckout: acc.initiateCheckout + (m.initiateCheckout ?? 0),
      videoPlays: acc.videoPlays + (m.videoPlays ?? 0),
      videoP25: acc.videoP25 + (m.videoP25 ?? 0),
      reach: acc.reach + (m.reach ?? 0),
    }),
    {
      spend: 0, impressions: 0, clicks: 0, purchases: 0,
      purchaseValue: 0, landingPageViews: 0, addToCart: 0,
      initiateCheckout: 0, videoPlays: 0, videoP25: 0, reach: 0,
    }
  )

  const avgFrequency = metrics.reduce((s, m) => s + (m.frequency ?? 0), 0) / metrics.filter((m) => m.frequency !== null).length || null
  const avgCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null
  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null
  const roas = totals.spend > 0 && totals.purchaseValue > 0 ? totals.purchaseValue / totals.spend : null
  const hookRate = totals.videoPlays > 0 ? totals.videoP25 / totals.videoPlays : null
  const landingPageViewRate = totals.clicks > 0 && totals.landingPageViews > 0 ? totals.landingPageViews / totals.clicks : null

  return {
    ...totals,
    avgFrequency,
    avgCpm,
    avgCtr,
    roas,
    hookRate,
    landingPageViewRate,
    cpa: totals.purchases > 0 ? totals.spend / totals.purchases : null,
    days: metrics.length,
  }
}

// ─── Daily Digest — toate campaniile organizației ─────────────────────────────

export async function generateDailyDigest(organizationId: string): Promise<void> {
  const campaigns = await db.campaign.findMany({
    where: { organizationId },
    include: {
      metrics: {
        where: { date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { date: "desc" },
      },
    },
  })

  const campaignsWithData = campaigns.filter((c) => c.metrics.length > 0)
  if (campaignsWithData.length === 0) return

  // Calculează media contului (30 zile) pentru context
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const accountMetrics = await db.campaignMetrics.findMany({
    where: {
      campaign: { organizationId },
      date: { gte: thirtyDaysAgo },
    },
  })

  const accountAvgRoas =
    accountMetrics.filter((m) => m.roas !== null).reduce((s, m) => s + (m.roas ?? 0), 0) /
      (accountMetrics.filter((m) => m.roas !== null).length || 1)
  const accountAvgCtr =
    accountMetrics.filter((m) => m.ctr !== null).reduce((s, m) => s + (m.ctr ?? 0), 0) /
      (accountMetrics.filter((m) => m.ctr !== null).length || 1)
  const accountTotalSpend = accountMetrics.reduce((s, m) => s + m.spend, 0)
  const accountTotalPurchases = accountMetrics.reduce((s, m) => s + m.purchases, 0)
  const accountAvgCpa = accountTotalPurchases > 0 ? accountTotalSpend / accountTotalPurchases : null

  // Construiește datele per campanie pentru prompt
  const campaignsData = await Promise.all(
    campaignsWithData.map(async (campaign) => {
      const m = await getCampaignMetricsForAnalysis(campaign.id)
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        budget: campaign.budget,
        metrics: m,
      }
    })
  )

  const userPrompt = `
Analizează aceste campanii Meta Ads pentru Azora.ro (ultimele 7 zile):

${JSON.stringify(campaignsData, null, 2)}

Media contului (ultimele 30 zile):
- ROAS mediu: ${accountAvgRoas.toFixed(2)}x
- CTR mediu: ${accountAvgCtr.toFixed(2)}%
- CPA mediu: ${accountAvgCpa !== null ? accountAvgCpa.toFixed(0) + " RON" : "N/A (fara comenzi)"}
- Total cheltuit: ${accountTotalSpend.toFixed(0)} RON
- Total comenzi: ${accountTotalPurchases}

Returnează JSON strict cu această structură:
{
  "summary": "1-2 fraze executive summary pentru toate campaniile",
  "campaigns": [
    {
      "id": "campaign_id_din_date",
      "healthScore": 0-100,
      "status": "excellent|good|warning|critical",
      "problems": [
        {
          "title": "Titlu scurt",
          "severity": "high|medium|low",
          "metric": "numele metricii",
          "value": "valoarea reala",
          "benchmark": "valoarea benchmark",
          "description": "Explicatie concreta"
        }
      ],
      "suggestions": [
        {
          "action": "Actiunea recomandata",
          "priority": 1,
          "expectedImpact": "Ce impact astepti",
          "howTo": "Cum exact se face"
        }
      ]
    }
  ]
}
`

  const ai = getAI()
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
  })

  const text = response.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in response")

  const report: AIReportContent = JSON.parse(jsonMatch[0])

  // Salvează raportul global
  await db.campaignAIReport.create({
    data: {
      organizationId,
      reportType: CampaignReportType.DAILY_DIGEST,
      summary: report.summary,
      status: "good",
      problems: [],
      suggestions: [],
      modelUsed: "gemini-2.5-flash",
    },
  })

  // Salvează raport per campanie
  for (const campaignReport of report.campaigns) {
    const campaign = campaignsWithData.find((c) => c.id === campaignReport.id)
    if (!campaign) continue

    const metricsForScore = await getCampaignMetricsForAnalysis(campaign.id)
    const { score, status } = calcHealthScore({
      roas: metricsForScore?.roas ?? null,
      ctr: metricsForScore?.avgCtr ?? null,
      cpm: metricsForScore?.avgCpm ?? null,
      frequency: metricsForScore?.avgFrequency ?? null,
      hookRate: metricsForScore?.hookRate ?? null,
      landingPageViewRate: metricsForScore?.landingPageViewRate ?? null,
      spend: metricsForScore?.spend ?? 0,
      purchases: metricsForScore?.purchases ?? 0,
      addToCart: metricsForScore?.addToCart ?? null,
    })

    await db.campaignAIReport.create({
      data: {
        organizationId,
        campaignId: campaign.id,
        reportType: CampaignReportType.CAMPAIGN_DEEP,
        healthScore: score,
        status,
        summary: report.summary,
        problems: campaignReport.problems as object[],
        suggestions: campaignReport.suggestions as object[],
        modelUsed: "gemini-2.5-flash",
      },
    })
  }
}

// ─── Analiză instant per campanie ─────────────────────────────────────────────

export async function generateCampaignAnalysis(
  organizationId: string,
  campaignId: string
): Promise<{
  healthScore: number
  status: CampaignStatus
  summary: string
  problems: object[]
  suggestions: object[]
}> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
  })
  if (!campaign) throw new Error("Campaign not found")

  const metrics = await getCampaignMetricsForAnalysis(campaignId)
  if (!metrics) throw new Error("No metrics available for this campaign")

  const { score, status } = calcHealthScore({
    roas: metrics.roas,
    ctr: metrics.avgCtr,
    cpm: metrics.avgCpm,
    frequency: metrics.avgFrequency,
    hookRate: metrics.hookRate,
    landingPageViewRate: metrics.landingPageViewRate,
    spend: metrics.spend,
    purchases: metrics.purchases,
    addToCart: metrics.addToCart,
  })

  const userPrompt = `
Analizează campania Meta Ads pentru Azora.ro (ultimele 7 zile):

Campanie: "${campaign.name}"
Status Meta: ${campaign.status}
Budget zilnic: ${campaign.budget} RON

Metrici agregate (${metrics.days} zile):
- Spend: ${metrics.spend.toFixed(2)} RON
- Impressions: ${metrics.impressions.toLocaleString("ro-RO")}
- Clicks: ${metrics.clicks.toLocaleString("ro-RO")}
- CTR: ${metrics.avgCtr?.toFixed(2) ?? "N/A"}%
- CPM: ${metrics.avgCpm?.toFixed(1) ?? "N/A"} RON
- Reach: ${metrics.reach.toLocaleString("ro-RO")}
- Frequency: ${metrics.avgFrequency?.toFixed(2) ?? "N/A"}
- Landing Page Views: ${metrics.landingPageViews}
- Landing Page Rate: ${metrics.landingPageViewRate !== null ? (metrics.landingPageViewRate * 100).toFixed(1) + "%" : "N/A"}
- Add to Cart: ${metrics.addToCart}
- Initiate Checkout: ${metrics.initiateCheckout}
- Purchases: ${metrics.purchases}
- Purchase Value: ${metrics.purchaseValue.toFixed(2)} RON
- ROAS: ${metrics.roas?.toFixed(2) ?? "0"}x
- CPA: ${metrics.cpa?.toFixed(0) ?? "N/A"} RON
- Video Plays: ${metrics.videoPlays}
- Hook Rate (p25): ${metrics.hookRate !== null ? (metrics.hookRate * 100).toFixed(1) + "%" : "N/A"}

Health Score calculat: ${score}/100 (${status})

Returnează JSON strict:
{
  "summary": "1-2 fraze despre starea campaniei",
  "problems": [
    {
      "title": "Titlu scurt",
      "severity": "high|medium|low",
      "metric": "numele metricii",
      "value": "valoarea reala",
      "benchmark": "valoarea benchmark",
      "description": "Explicatie concreta"
    }
  ],
  "suggestions": [
    {
      "action": "Actiunea recomandata",
      "priority": 1,
      "expectedImpact": "Ce impact astepti",
      "howTo": "Cum exact se face"
    }
  ]
}
`

  const ai = getAI()
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
  })

  const text = response.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in response")

  const parsed = JSON.parse(jsonMatch[0])

  // Salvează în DB
  await db.campaignAIReport.create({
    data: {
      organizationId,
      campaignId,
      reportType: CampaignReportType.CAMPAIGN_DEEP,
      healthScore: score,
      status,
      summary: parsed.summary,
      problems: parsed.problems,
      suggestions: parsed.suggestions,
      modelUsed: "gemini-2.5-flash",
    },
  })

  return { healthScore: score, status, summary: parsed.summary, problems: parsed.problems, suggestions: parsed.suggestions }
}

// ─── Video Brief Generator ────────────────────────────────────────────────────

export async function generateVideoBrief(
  organizationId: string,
  campaignId: string
): Promise<VideoBrief> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
  })
  if (!campaign) throw new Error("Campaign not found")

  const metrics = await getCampaignMetricsForAnalysis(campaignId)
  if (!metrics) throw new Error("No metrics available")

  const userPrompt = `
Generează un brief video pentru o reclamă Meta nouă, bazat pe datele campaniei actuale:

Campanie: "${campaign.name}"
Metrici (ultimele 7 zile):
- CTR: ${metrics.avgCtr?.toFixed(2) ?? "N/A"}%
- Hook Rate (p25/plays): ${metrics.hookRate !== null ? (metrics.hookRate * 100).toFixed(1) + "%" : "N/A"}
- ROAS: ${metrics.roas?.toFixed(2) ?? "0"}x
- Add to Cart: ${metrics.addToCart}
- Purchases: ${metrics.purchases}

Diagnosticul problemei (pe baza datelor):
${metrics.avgCtr !== null && metrics.avgCtr < RO_BENCHMARKS.ctr.ok ? "- CTR slab → hook-ul visual/copy nu funcționează" : ""}
${metrics.hookRate !== null && metrics.hookRate < RO_BENCHMARKS.hookRate.ok ? "- Hook rate video slab → primele 3 secunde nu captează atenția" : ""}
${metrics.roas !== null && metrics.roas < RO_BENCHMARKS.roas.ok ? "- ROAS slab → oferta sau landing page-ul nu convinge" : ""}

Produsul este un dispozitiv beauty/wellness pentru femei românce (25-55 ani).
Piața RO: 85% vizionează fără sunet, UGC-style performat cu 161% mai bine decât branded.

Returnează JSON strict cu această structură:
{
  "diagnosis": "De ce crezi că creativul actual nu performează",
  "hook": {
    "type": "pain_point|curiosity|social_proof|demonstration",
    "script": "Textul exact al hook-ului (prima linie — AC Hampton: 90% din succes)",
    "visual": "Descriere vizuala detaliata pentru primele 3 secunde",
    "duration_sec": 3
  },
  "body": {
    "structure": "demo_product|testimonial|before_after|educational",
    "key_points": ["Punct 1", "Punct 2", "Punct 3"],
    "duration_sec": 20
  },
  "social_proof": {
    "type": "overlay_text|voiceover|ugc_clip",
    "content": "Textul exact al dovezii sociale",
    "duration_sec": 4
  },
  "cta": {
    "script": "Textul CTA",
    "visual": "Descriere vizuala CTA",
    "duration_sec": 3
  },
  "format": "9:16",
  "total_duration_sec": 30,
  "notes": [
    "Nota 1 — reguli importante de productie",
    "Nota 2"
  ]
}
`

  const ai = getAI()
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
  })

  const text = response.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in response")

  const brief: VideoBrief = JSON.parse(jsonMatch[0])

  // Salvează în DB
  await db.campaignAIReport.create({
    data: {
      organizationId,
      campaignId,
      reportType: CampaignReportType.VIDEO_BRIEF,
      summary: brief.diagnosis,
      status: "good",
      problems: [],
      suggestions: [],
      videoBrief: brief as object,
      modelUsed: "gemini-2.5-flash",
    },
  })

  return brief
}
