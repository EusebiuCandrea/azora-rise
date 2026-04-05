# Campaign Intelligence — Faza 2: AI Intelligence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaugă intelligence AI la campanii — digest zilnic automat la 8:00 AM, analiză interactivă per campanie cu health score (0-100), și panel AI în UI.

**Architecture:** Claude API (claude-sonnet-4-6) primește metrici din Prisma + benchmarks RO hardcodate, returnează JSON structurat salvat în modelul `CampaignAIReport`. Două moduri: cron zilnic (background) + analiză la cerere (interactive, < 5s). UI: `CampaignAIPanel` în campaign detail + `CampaignHealthBadge` în lista campaniilor.

**Tech Stack:** `@anthropic-ai/sdk` (deja instalat), Next.js 16 API routes, Prisma, React Query, shadcn/ui

**Prerequisit:** Faza 1 completată (câmpurile noi în schema există)

---

## File Map

| Fișier | Acțiune | Ce face |
|--------|---------|---------|
| `prisma/schema.prisma` | Modify | Adaugă model CampaignAIReport + enum CampaignReportType |
| `features/meta/knowledge-base.ts` | Create | Constante benchmarks piata RO |
| `features/meta/ai-analysis.ts` | Create | generateDailyDigest(), generateCampaignAnalysis() |
| `app/api/cron/campaign-digest/route.ts` | Create | Endpoint cron zilnic 08:00 |
| `app/api/meta/campaigns/[id]/analyze/route.ts` | Create | Endpoint analiză instant per campanie |
| `features/meta/components/CampaignAIPanel.tsx` | Create | Panel AI în campaign detail |
| `features/meta/components/CampaignHealthBadge.tsx` | Create | Badge scor în lista campaniilor |
| `features/meta/hooks/useCampaignAI.ts` | Create | React Query hooks pentru AI data |
| `app/(dashboard)/campaigns/[id]/page.tsx` | Modify | Adaugă CampaignAIPanel |
| `app/(dashboard)/campaigns/page.tsx` | Modify | Adaugă CampaignHealthBadge în tabel |

---

### Task 1: Schema — Model CampaignAIReport

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adaugă enum CampaignReportType**

Adaugă după enum AlertType existent:

```prisma
enum CampaignReportType {
  DAILY_DIGEST
  CAMPAIGN_DEEP
  VIDEO_BRIEF
}
```

- [ ] **Step 2: Adaugă model CampaignAIReport**

Adaugă înainte de secțiunea `// Sub-proiect 5: Profitability Engine`:

```prisma
model CampaignAIReport {
  id             String             @id @default(cuid())
  organizationId String
  campaignId     String?
  reportType     CampaignReportType
  healthScore    Int?
  status         String?
  summary        String
  problems       Json
  suggestions    Json
  videoBrief     Json?
  generatedAt    DateTime           @default(now())
  modelUsed      String             @default("claude-sonnet-4-6")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  campaign     Campaign?    @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([organizationId, reportType, generatedAt])
  @@index([campaignId, generatedAt])
}
```

- [ ] **Step 3: Adaugă relația în modelul Campaign**

Găsește modelul `Campaign` și adaugă în lista de relații:

```prisma
  aiReports      CampaignAIReport[]
```

- [ ] **Step 4: Adaugă relația în modelul Organization**

Găsește modelul `Organization` și adaugă:

```prisma
  campaignAIReports CampaignAIReport[]
```

- [ ] **Step 5: Rulează migrația**

```bash
npm run db:migrate
```

Nume migrație: `add_campaign_ai_report`

- [ ] **Step 6: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CampaignAIReport model for AI analysis storage"
```

---

### Task 2: Knowledge Base — Benchmarks Piata RO

**Files:**
- Create: `features/meta/knowledge-base.ts`

- [ ] **Step 1: Creează fișierul**

```typescript
// features/meta/knowledge-base.ts

export const RO_BENCHMARKS = {
  roas: {
    poor: 1.5,
    ok: 2.5,
    good: 3.5,
    excellent: 5.0,
  },
  ctr: {
    poor: 0.9,    // %
    ok: 1.5,
    good: 2.5,
    excellent: 4.0,
  },
  cpm: {
    excellent: 15, // RON
    good: 30,
    ok: 45,
    poor: 60,
  },
  frequency: {
    safe: 2.0,
    warning: 3.0,
    danger: 3.5,
  },
  hookRate: {
    poor: 0.20,    // p25 / plays
    ok: 0.30,
    good: 0.45,
    excellent: 0.60,
  },
  cpa: {
    excellent: 60,   // RON — pentru produs ~250 RON
    good: 100,
    ok: 150,
    poor: 200,
  },
  minDaysBeforeKill: 7,
  minSpendBeforeKill: 300,    // RON
  learningPhaseConversions: 50,
} as const

export function getHealthScore(metrics: {
  roas: number | null
  ctr: number | null
  cpm: number | null
  frequency: number | null
  hookRate: number | null
}): number {
  let score = 100
  const weights = { roas: 35, ctr: 25, cpm: 20, frequency: 10, hookRate: 10 }

  if (metrics.roas !== null) {
    if (metrics.roas < RO_BENCHMARKS.roas.poor) score -= weights.roas
    else if (metrics.roas < RO_BENCHMARKS.roas.ok) score -= weights.roas * 0.6
    else if (metrics.roas < RO_BENCHMARKS.roas.good) score -= weights.roas * 0.2
    else if (metrics.roas >= RO_BENCHMARKS.roas.excellent) score += 5
  } else {
    score -= weights.roas * 0.3 // penalizare mică pentru lipsă ROAS
  }

  if (metrics.ctr !== null) {
    if (metrics.ctr < RO_BENCHMARKS.ctr.poor) score -= weights.ctr
    else if (metrics.ctr < RO_BENCHMARKS.ctr.ok) score -= weights.ctr * 0.5
    else if (metrics.ctr >= RO_BENCHMARKS.ctr.good) score += 3
  }

  if (metrics.cpm !== null) {
    if (metrics.cpm > RO_BENCHMARKS.cpm.poor) score -= weights.cpm
    else if (metrics.cpm > RO_BENCHMARKS.cpm.ok) score -= weights.cpm * 0.5
  }

  if (metrics.frequency !== null) {
    if (metrics.frequency > RO_BENCHMARKS.frequency.danger) score -= weights.frequency
    else if (metrics.frequency > RO_BENCHMARKS.frequency.warning) score -= weights.frequency * 0.5
  }

  if (metrics.hookRate !== null) {
    if (metrics.hookRate < RO_BENCHMARKS.hookRate.poor) score -= weights.hookRate
    else if (metrics.hookRate < RO_BENCHMARKS.hookRate.ok) score -= weights.hookRate * 0.5
    else if (metrics.hookRate >= RO_BENCHMARKS.hookRate.good) score += 3
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function getHealthStatus(score: number): "excellent" | "good" | "warning" | "critical" {
  if (score >= 80) return "excellent"
  if (score >= 60) return "good"
  if (score >= 40) return "warning"
  return "critical"
}
```

- [ ] **Step 2: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add features/meta/knowledge-base.ts
git commit -m "feat: add RO market benchmarks and health score calculator"
```

---

### Task 3: AI Analysis Engine

**Files:**
- Create: `features/meta/ai-analysis.ts`

- [ ] **Step 1: Creează fișierul ai-analysis.ts**

```typescript
// features/meta/ai-analysis.ts
import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/lib/db"
import { RO_BENCHMARKS, getHealthScore, getHealthStatus } from "./knowledge-base"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ─────────────────────────────────────────────────────────────────

interface CampaignAnalysisInput {
  id: string
  name: string
  status: string
  budget: number
  objective: string
  metrics7Days: Array<{
    date: string
    spend: number
    impressions: number
    clicks: number
    purchases: number
    roas: number | null
    cpm: number | null
    ctr: number | null
    frequency: number | null
    landingPageViews: number | null
    addToCart: number | null
    initiateCheckout: number | null
    videoPlays: number | null
    videoP25: number | null
  }>
  totals: {
    totalSpend: number
    totalPurchases: number
    avgRoas: number | null
    avgCtr: number | null
    avgCpm: number | null
    avgFrequency: number | null
    hookRate: number | null
  }
}

interface AIReportProblem {
  title: string
  severity: "high" | "medium" | "low"
  metric: string
  value: string
  benchmark: string
  description: string
}

interface AIReportSuggestion {
  action: string
  priority: 1 | 2 | 3
  expectedImpact: string
  howTo: string
}

interface CampaignAIResult {
  campaignId: string
  healthScore: number
  status: "excellent" | "good" | "warning" | "critical"
  problems: AIReportProblem[]
  suggestions: AIReportSuggestion[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildCampaignInput(
  campaign: Awaited<ReturnType<typeof db.campaign.findFirst>> & {
    metrics: Array<{
      date: Date
      spend: number
      impressions: number
      clicks: number
      purchases: number
      roas: number | null
      cpm: number | null
      ctr: number | null
      frequency: number | null
      landingPageViews: number | null
      addToCart: number | null
      initiateCheckout: number | null
      videoPlays: number | null
      videoP25: number | null
    }>
  }
): CampaignAnalysisInput {
  if (!campaign) throw new Error("Campaign not found")

  const metrics7 = campaign.metrics.slice(0, 7)
  const totalSpend = metrics7.reduce((s, m) => s + m.spend, 0)
  const totalPurchases = metrics7.reduce((s, m) => s + m.purchases, 0)
  const withRoas = metrics7.filter((m) => m.roas !== null)
  const avgRoas = withRoas.length > 0 ? withRoas.reduce((s, m) => s + (m.roas ?? 0), 0) / withRoas.length : null
  const withCtr = metrics7.filter((m) => m.ctr !== null)
  const avgCtr = withCtr.length > 0 ? withCtr.reduce((s, m) => s + (m.ctr ?? 0), 0) / withCtr.length : null
  const withCpm = metrics7.filter((m) => m.cpm !== null)
  const avgCpm = withCpm.length > 0 ? withCpm.reduce((s, m) => s + (m.cpm ?? 0), 0) / withCpm.length : null
  const withFreq = metrics7.filter((m) => m.frequency !== null)
  const avgFrequency = withFreq.length > 0 ? withFreq.reduce((s, m) => s + (m.frequency ?? 0), 0) / withFreq.length : null

  const totalPlays = metrics7.reduce((s, m) => s + (m.videoPlays ?? 0), 0)
  const totalP25 = metrics7.reduce((s, m) => s + (m.videoP25 ?? 0), 0)
  const hookRate = totalPlays > 100 ? totalP25 / totalPlays : null

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    budget: campaign.budget,
    objective: campaign.objective,
    metrics7Days: metrics7.map((m) => ({
      date: m.date.toISOString().split("T")[0],
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      purchases: m.purchases,
      roas: m.roas,
      cpm: m.cpm,
      ctr: m.ctr,
      frequency: m.frequency,
      landingPageViews: m.landingPageViews,
      addToCart: m.addToCart,
      initiateCheckout: m.initiateCheckout,
      videoPlays: m.videoPlays,
      videoP25: m.videoP25,
    })),
    totals: { totalSpend, totalPurchases, avgRoas, avgCtr, avgCpm, avgFrequency, hookRate },
  }
}

// ─── Main Analysis ───────────────────────────────────────────────────────────

export async function generateCampaignAnalysis(
  organizationId: string,
  campaignId: string
): Promise<void> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: {
      metrics: {
        where: { date: { lte: new Date(Date.now() - 86400000) } },
        orderBy: { date: "desc" },
        take: 7,
        select: {
          date: true, spend: true, impressions: true, clicks: true,
          purchases: true, roas: true, cpm: true, ctr: true,
          frequency: true, landingPageViews: true, addToCart: true,
          initiateCheckout: true, videoPlays: true, videoP25: true,
        },
      },
    },
  })

  if (!campaign) throw new Error("Campaign not found")

  const input = buildCampaignInput(campaign as Parameters<typeof buildCampaignInput>[0])
  const healthScore = getHealthScore({
    roas: input.totals.avgRoas,
    ctr: input.totals.avgCtr,
    cpm: input.totals.avgCpm,
    frequency: input.totals.avgFrequency,
    hookRate: input.totals.hookRate,
  })
  const healthStatus = getHealthStatus(healthScore)

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: `Ești un expert în Meta Ads optimization pentru e-commerce românesc (beauty/wellness devices).
Analizezi date de campanie și oferi recomandări concrete și acționabile.

Benchmarks piata RO:
- ROAS: sub ${RO_BENCHMARKS.roas.poor}x = slab, ${RO_BENCHMARKS.roas.good}-${RO_BENCHMARKS.roas.excellent}x = bun, ${RO_BENCHMARKS.roas.excellent}x+ = excelent
- CTR: sub ${RO_BENCHMARKS.ctr.poor}% = hook slab, ${RO_BENCHMARKS.ctr.ok}-${RO_BENCHMARKS.ctr.good}% = normal, ${RO_BENCHMARKS.ctr.excellent}%+ = excelent
- CPM: sub ${RO_BENCHMARKS.cpm.good} RON = ieftin, peste ${RO_BENCHMARKS.cpm.poor} RON = scump
- Frequency: peste ${RO_BENCHMARKS.frequency.danger} = audiența obosită — schimbă creative-ul
- Hook rate (p25/plays): sub ${RO_BENCHMARKS.hookRate.poor * 100}% = hook slab, ${RO_BENCHMARKS.hookRate.good * 100}%+ = bun
- Minim ${RO_BENCHMARKS.minDaysBeforeKill} zile și ${RO_BENCHMARKS.minSpendBeforeKill} RON spend înainte de decizie

Reguli:
1. Fii specific cu numere reale din date
2. Maxim 3 probleme, maxim 3 sugestii
3. Identifică dacă problema e la creative, audiență sau landing page
4. Răspunde DOAR cu JSON valid, fără text în afara JSON-ului`,

    messages: [
      {
        role: "user",
        content: `Analizează campania:
${JSON.stringify(input, null, 2)}

Returnează JSON cu exact această structură:
{
  "summary": "1-2 fraze executive summary în română",
  "problems": [
    {
      "title": "titlu scurt",
      "severity": "high|medium|low",
      "metric": "ROAS|CTR|CPM|Frequency|Hook Rate|etc",
      "value": "valoarea actuală cu unitate",
      "benchmark": "valoarea target",
      "description": "explicație concisă în română"
    }
  ],
  "suggestions": [
    {
      "action": "acțiunea recomandată",
      "priority": 1,
      "expectedImpact": "impactul așteptat",
      "howTo": "cum să faci asta concret"
    }
  ]
}`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== "text") throw new Error("Unexpected response type")

  let parsed: { summary: string; problems: AIReportProblem[]; suggestions: AIReportSuggestion[] }
  try {
    parsed = JSON.parse(content.text)
  } catch {
    throw new Error("Failed to parse AI response as JSON")
  }

  await db.campaignAIReport.create({
    data: {
      organizationId,
      campaignId,
      reportType: "CAMPAIGN_DEEP",
      healthScore,
      status: healthStatus,
      summary: parsed.summary,
      problems: parsed.problems,
      suggestions: parsed.suggestions,
      modelUsed: "claude-sonnet-4-6",
    },
  })
}

// ─── Daily Digest ────────────────────────────────────────────────────────────

export async function generateDailyDigest(organizationId: string): Promise<void> {
  const campaigns = await db.campaign.findMany({
    where: { organizationId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      metrics: {
        where: { date: { lte: new Date(Date.now() - 86400000) } },
        orderBy: { date: "desc" },
        take: 7,
        select: {
          date: true, spend: true, impressions: true, clicks: true,
          purchases: true, roas: true, cpm: true, ctr: true,
          frequency: true, landingPageViews: true, addToCart: true,
          initiateCheckout: true, videoPlays: true, videoP25: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  })

  // Generează analiză per campanie (în paralel, max 5 simultan)
  const chunks = []
  for (let i = 0; i < campaigns.length; i += 5) {
    chunks.push(campaigns.slice(i, i + 5))
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (campaign) => {
        try {
          await generateCampaignAnalysis(organizationId, campaign.id)
        } catch (err) {
          console.error(`Failed to analyze campaign ${campaign.id}:`, err)
        }
      })
    )
  }
}
```

- [ ] **Step 2: Adaugă ANTHROPIC_API_KEY în .env.local**

Deschide `.env.local` și adaugă (dacă nu există):

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Obții cheia din https://console.anthropic.com/settings/keys

- [ ] **Step 3: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add features/meta/ai-analysis.ts
git commit -m "feat: add AI campaign analysis engine with health score and daily digest"
```

---

### Task 4: API Routes — Cron Digest + Analiză Instant

**Files:**
- Create: `app/api/cron/campaign-digest/route.ts`
- Create: `app/api/meta/campaigns/[id]/analyze/route.ts`

- [ ] **Step 1: Creează cron route**

```typescript
// app/api/cron/campaign-digest/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateDailyDigest } from "@/features/meta/ai-analysis"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret")
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizations = await db.organization.findMany({
    where: {
      metaConnection: { isNot: null },
    },
    select: { id: true },
  })

  const results = []
  for (const org of organizations) {
    try {
      await generateDailyDigest(org.id)
      results.push({ orgId: org.id, status: "ok" })
    } catch (err) {
      results.push({ orgId: org.id, status: "error", message: String(err) })
    }
  }

  return NextResponse.json({ success: true, results, generatedAt: new Date().toISOString() })
}
```

- [ ] **Step 2: Creează analyze route**

```typescript
// app/api/meta/campaigns/[id]/analyze/route.ts
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"
import { generateCampaignAnalysis } from "@/features/meta/ai-analysis"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  // Verifică că campania aparține org-ului
  const campaign = await db.campaign.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  await generateCampaignAnalysis(organizationId, id)

  // Returnează ultimul raport generat
  const report = await db.campaignAIReport.findFirst({
    where: { campaignId: id, organizationId },
    orderBy: { generatedAt: "desc" },
  })

  return NextResponse.json({ success: true, report })
}
```

- [ ] **Step 3: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 4: Test manual cron route**

```bash
curl -X POST http://localhost:3000/api/cron/campaign-digest \
  -H "x-internal-secret: $(grep INTERNAL_API_SECRET .env.local | cut -d= -f2 | tr -d '"')"
```

Expected: `{"success":true,"results":[...]}`

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/campaign-digest/route.ts app/api/meta/campaigns/\[id\]/analyze/route.ts
git commit -m "feat: add campaign digest cron endpoint and instant analyze endpoint"
```

---

### Task 5: React Hook — useCampaignAI

**Files:**
- Create: `features/meta/hooks/useCampaignAI.ts`

- [ ] **Step 1: Creează hook-ul**

```typescript
// features/meta/hooks/useCampaignAI.ts
"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface AIReportProblem {
  title: string
  severity: "high" | "medium" | "low"
  metric: string
  value: string
  benchmark: string
  description: string
}

interface AIReportSuggestion {
  action: string
  priority: 1 | 2 | 3
  expectedImpact: string
  howTo: string
}

export interface CampaignAIReport {
  id: string
  campaignId: string | null
  reportType: string
  healthScore: number | null
  status: string | null
  summary: string
  problems: AIReportProblem[]
  suggestions: AIReportSuggestion[]
  videoBrief: unknown | null
  generatedAt: string
  modelUsed: string
}

export function useCampaignAIReport(campaignId: string) {
  return useQuery<CampaignAIReport | null>({
    queryKey: ["campaign-ai-report", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/ai-report`)
      if (!res.ok) return null
      const data = await res.json()
      return data.report ?? null
    },
    staleTime: 5 * 60 * 1000, // 5 minute
  })
}

export function useAnalyzeCampaign(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/analyze`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Analysis failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-ai-report", campaignId] })
    },
  })
}
```

- [ ] **Step 2: Creează GET route pentru ai-report**

```typescript
// app/api/meta/campaigns/[id]/ai-report/route.ts
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const report = await db.campaignAIReport.findFirst({
    where: { campaignId: id, organizationId },
    orderBy: { generatedAt: "desc" },
  })

  return NextResponse.json({ report })
}
```

- [ ] **Step 3: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add features/meta/hooks/useCampaignAI.ts app/api/meta/campaigns/\[id\]/ai-report/route.ts
git commit -m "feat: add useCampaignAI hook and ai-report GET endpoint"
```

---

### Task 6: UI — CampaignHealthBadge

**Files:**
- Create: `features/meta/components/CampaignHealthBadge.tsx`

- [ ] **Step 1: Creează componenta**

```typescript
// features/meta/components/CampaignHealthBadge.tsx
import { cn } from "@/lib/utils"

interface CampaignHealthBadgeProps {
  score: number | null
  status: string | null
}

export function CampaignHealthBadge({ score, status }: CampaignHealthBadgeProps) {
  if (score === null) return <span className="text-xs text-[#A8A29E]">—</span>

  const config = {
    excellent: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
    good: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
    warning: { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
    critical: { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500" },
  }[status ?? "warning"] ?? { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" }

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md", config.bg)}>
      <div className="w-14 h-1.5 bg-[#E7E5E4] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", config.bar)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("text-xs font-semibold tabular-nums", config.text)}>
        {score}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add features/meta/components/CampaignHealthBadge.tsx
git commit -m "feat: add CampaignHealthBadge UI component with color-coded score bar"
```

---

### Task 7: UI — CampaignAIPanel

**Files:**
- Create: `features/meta/components/CampaignAIPanel.tsx`

- [ ] **Step 1: Creează componenta**

```typescript
// features/meta/components/CampaignAIPanel.tsx
"use client"
import { useState } from "react"
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCampaignAIReport, useAnalyzeCampaign } from "@/features/meta/hooks/useCampaignAI"
import { CampaignHealthBadge } from "./CampaignHealthBadge"

const SEVERITY_CONFIG = {
  high: { label: "Critic", className: "bg-red-50 text-red-700 border-red-200" },
  medium: { label: "Mediu", className: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "Info", className: "bg-blue-50 text-blue-700 border-blue-200" },
}

interface CampaignAIPanelProps {
  campaignId: string
}

export function CampaignAIPanel({ campaignId }: CampaignAIPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const { data: report, isLoading } = useCampaignAIReport(campaignId)
  const { mutate: analyze, isPending: isAnalyzing } = useAnalyzeCampaign(campaignId)

  const generatedAt = report?.generatedAt
    ? new Date(report.generatedAt).toLocaleString("ro-RO", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#FAFAF9] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-sm font-semibold text-[#1C1917]">Analiză AI</span>
          {report && (
            <CampaignHealthBadge score={report.healthScore} status={report.status} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-xs text-[#A8A29E]">{generatedAt}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); analyze() }}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#78716C] bg-[#F5F5F4] hover:bg-[#E7E5E4] rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", isAnalyzing && "animate-spin")} />
            {isAnalyzing ? "Analizez..." : "Actualizează"}
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#A8A29E]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#A8A29E]" />
          )}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-[#E7E5E4] px-5 py-4 space-y-4">
          {isLoading && (
            <div className="text-sm text-[#78716C] text-center py-4">
              Se încarcă analiza...
            </div>
          )}

          {!isLoading && !report && (
            <div className="text-sm text-[#78716C] text-center py-4">
              Nicio analiză disponibilă.{" "}
              <button
                onClick={() => analyze()}
                className="text-[#D4AF37] hover:underline font-medium"
              >
                Generează acum
              </button>
            </div>
          )}

          {report && (
            <>
              {/* Summary */}
              <p className="text-sm text-[#44403C] leading-relaxed">{report.summary}</p>

              {/* Problems */}
              {report.problems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">
                    Probleme identificate
                  </p>
                  {report.problems.map((p, i) => {
                    const sev = SEVERITY_CONFIG[p.severity]
                    return (
                      <div
                        key={i}
                        className={cn("rounded-lg border px-4 py-3 space-y-1", sev.className)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{p.title}</span>
                          <span className="text-xs font-semibold">{p.value}</span>
                        </div>
                        <p className="text-xs opacity-80">{p.description}</p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Suggestions */}
              {report.suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">
                    Acțiuni recomandate
                  </p>
                  {report.suggestions.map((s, i) => (
                    <div key={i} className="flex gap-3 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4] px-4 py-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#D4AF37] text-[#1C1917] text-xs font-bold flex items-center justify-center">
                        {s.priority}
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-[#1C1917]">{s.action}</p>
                        <p className="text-xs text-[#78716C]">{s.howTo}</p>
                        <p className="text-xs text-emerald-600 font-medium">{s.expectedImpact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add features/meta/components/CampaignAIPanel.tsx
git commit -m "feat: add CampaignAIPanel component with health score, problems and suggestions"
```

---

### Task 8: Integrare UI în Campaign Detail + Lista

**Files:**
- Modify: `app/(dashboard)/campaigns/[id]/page.tsx`
- Modify: `features/meta/components/CampaignsTable.tsx`

- [ ] **Step 1: Adaugă CampaignAIPanel în campaign detail**

În `app/(dashboard)/campaigns/[id]/page.tsx`, adaugă importul și componenta.

La topul fișierului:
```typescript
import { CampaignAIPanel } from "@/features/meta/components/CampaignAIPanel"
```

În JSX, adaugă panelul înainte de graficul de metrici (sau după alertele existente):

```typescript
{/* AI Analysis Panel */}
<CampaignAIPanel campaignId={id} />
```

- [ ] **Step 2: Adaugă CampaignHealthBadge în CampaignsTable**

Deschide `features/meta/components/CampaignsTable.tsx`. Găsește coloana care afișează ROAS sau status și adaugă o coloană nouă pentru health score.

Adaugă importul:
```typescript
import { CampaignHealthBadge } from "./CampaignHealthBadge"
```

Adaugă în props tipul pentru healthScore:
```typescript
// Extinde tipul campaniei cu healthScore și aiStatus dacă nu există
```

**Notă:** CampaignsTable primește campanii din server component. Trebuie să pasăm healthScore din DB. Adaugă în query-ul din `campaigns/page.tsx`:

```typescript
const rawCampaigns = orgId
  ? await db.campaign.findMany({
      where: { organizationId: orgId },
      include: {
        metrics: { where: { date: { lte: new Date(Date.now() - 86400000) } }, orderBy: { date: 'desc' }, take: 30 },
        _count: { select: { adSets: true } },
        aiReports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: { healthScore: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  : []
```

Adaugă `healthScore` și `aiStatus` în obiectul mapat:

```typescript
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      budget: campaign.budget,
      objective: campaign.objective,
      metaCampaignId: campaign.metaCampaignId,
      healthScore: campaign.aiReports[0]?.healthScore ?? null,
      aiStatus: campaign.aiReports[0]?.status ?? null,
      summary: {
        totalSpend,
        totalPurchases,
        latestRoas: campaign.metrics[0]?.roas ?? null,
        avgRoas,
        adSetsCount: campaign._count.adSets,
      },
    }
```

În CampaignsTable, adaugă coloana și renderul `<CampaignHealthBadge score={campaign.healthScore} status={campaign.aiStatus} />`.

- [ ] **Step 3: Verificare build complet**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors

- [ ] **Step 4: Verificare manuală**

```bash
npm run dev
```

Du-te la `http://localhost:3000/campaigns/[id]`. Verifică că panelul AI apare și butonul "Actualizează" funcționează.

- [ ] **Step 5: Commit final Faza 2**

```bash
git add app/\(dashboard\)/campaigns/ features/meta/components/CampaignsTable.tsx features/meta/components/CampaignAIPanel.tsx features/meta/components/CampaignHealthBadge.tsx
git commit -m "feat: integrate AI panel and health badge in campaigns UI"
```

---

### Task 9: Configurare Cron în Railway

- [ ] **Step 1: Adaugă cron job în Railway**

În Railway dashboard → proiect azora-rise → Settings → Cron Jobs → Add:

```
Schedule: 0 8 * * *
Command: curl -X POST https://rise.azora.ro/api/cron/campaign-digest -H "x-internal-secret: YOUR_INTERNAL_API_SECRET"
```

Sau alternativ adaugă în `next.config.ts` un endpoint cu `verifySignature` pentru Railway cron.

- [ ] **Step 2: Verificare în production**

```bash
curl -X POST https://rise.azora.ro/api/cron/campaign-digest \
  -H "x-internal-secret: VALOAREA_DIN_ENV"
```

Expected: `{"success":true,"results":[{"orgId":"...","status":"ok"}]}`

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: phase 2 AI intelligence complete - daily digest, health score, interactive panel"
```
