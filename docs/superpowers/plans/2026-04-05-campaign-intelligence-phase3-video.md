# Campaign Intelligence — Faza 3: Video Brief & Advanced

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaugă generare automată de brief video (hook + structură + CTA) bazată pe metrici campanie, scaling rules engine cu sugestii de budget, și view de comparație campanii.

**Architecture:** Video brief generator apelează Claude API cu context din metrici video + research piata RO, returnează JSON structurat cu secțiunile video. Scaling rules engine evaluează reguli configurabile pe metrici zilnice și generează sugestii. Campaign comparison este o pagină server cu query multi-campanie.

**Tech Stack:** `@anthropic-ai/sdk`, Next.js 16, Prisma, shadcn/ui

**Prerequisit:** Faza 1 + Faza 2 complete

---

## File Map

| Fișier | Acțiune | Ce face |
|--------|---------|---------|
| `features/meta/video-brief-generator.ts` | Create | Generează brief video complet via Claude API |
| `features/meta/scaling-rules.ts` | Create | Evaluează reguli de scaling și generează sugestii |
| `features/meta/components/VideoBriefCard.tsx` | Create | Afișare brief video în CampaignAIPanel |
| `app/api/meta/campaigns/[id]/video-brief/route.ts` | Create | Endpoint generare brief video |
| `app/(dashboard)/campaigns/compare/page.tsx` | Create | Pagina de comparare campanii |
| `features/meta/components/CampaignAIPanel.tsx` | Modify | Adaugă buton + afișare video brief |
| `features/meta/hooks/useCampaignAI.ts` | Modify | Adaugă useVideoBrief mutation |

---

### Task 1: Video Brief Generator

**Files:**
- Create: `features/meta/video-brief-generator.ts`

- [ ] **Step 1: Creează fișierul**

```typescript
// features/meta/video-brief-generator.ts
import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/lib/db"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface VideoBriefSection {
  type: string
  durationSec: number
  script?: string
  visual: string
  notes?: string
}

export interface VideoBrief {
  diagnosis: string
  targetAudience: string
  hook: {
    type: "pain_point" | "curiosity" | "testimonial" | "demo" | "social_proof"
    script: string
    visual: string
    durationSec: number
  }
  body: {
    structure: "demo_product" | "problem_solution" | "before_after_implied" | "testimonial_story"
    keyPoints: string[]
    visual: string
    durationSec: number
  }
  socialProof: {
    type: "overlay_text" | "testimonial_spoken" | "review_screenshot"
    content: string
    durationSec: number
  }
  cta: {
    script: string
    visual: string
    durationSec: number
  }
  format: "9:16" | "4:5" | "1:1"
  totalDurationSec: number
  productionNotes: string[]
  metaPolicyWarnings: string[]
}

export async function generateVideoBrief(
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
          spend: true, clicks: true, purchases: true,
          roas: true, ctr: true, cpm: true,
          frequency: true, landingPageViews: true,
          addToCart: true, videoPlays: true,
          videoP25: true, videoP50: true, videoAvgWatchTimeSec: true,
        },
      },
      aiReports: {
        orderBy: { generatedAt: "desc" },
        take: 1,
        select: { summary: true, problems: true, status: true },
      },
    },
  })

  if (!campaign) throw new Error("Campaign not found")

  const metrics = campaign.metrics
  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0)
  const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0)
  const avgCtr = metrics.filter((m) => m.ctr !== null).reduce((s, m) => s + (m.ctr ?? 0), 0) / (metrics.filter((m) => m.ctr !== null).length || 1)
  const avgRoas = metrics.filter((m) => m.roas !== null).reduce((s, m) => s + (m.roas ?? 0), 0) / (metrics.filter((m) => m.roas !== null).length || 1)
  const totalPlays = metrics.reduce((s, m) => s + (m.videoPlays ?? 0), 0)
  const totalP25 = metrics.reduce((s, m) => s + (m.videoP25 ?? 0), 0)
  const hookRate = totalPlays > 0 ? totalP25 / totalPlays : null
  const avgWatchTime = metrics.filter((m) => m.videoAvgWatchTimeSec !== null).reduce((s, m) => s + (m.videoAvgWatchTimeSec ?? 0), 0) / (metrics.filter((m) => m.videoAvgWatchTimeSec !== null).length || 1)

  const lastReport = campaign.aiReports[0]

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: `Ești un expert în crearea de reclame video pentru Meta Ads pentru piața românească, cu focus pe produse beauty/wellness (dispozitive EMS, LED, anticelulitic).

Cunoști:
- Structura optimă: hook 0-3s (pain point / curiozitate) → demo produs 5-20s → social proof 3-5s → CTA 3-5s
- UGC convertește cu 161% mai bine decât branded video
- Subtitrările obligatorii (85% vizionare fără sunet)
- Politicile Meta: INTERZIS before/after side-by-side pentru dispozitive slăbit/modelare corporală
- Format 9:16 pentru Reels/Stories, 4:5 pentru Feed
- Durata optimă: 15-30s pentru Reels, 30-60s pentru Feed

Returnează DOAR JSON valid, fără text în afara JSON-ului.`,

    messages: [
      {
        role: "user",
        content: `Generează un brief video complet pentru această campanie Meta Ads.

Campanie: "${campaign.name}"
Produs promovat: dispozitiv beauty/wellness (Azora.ro)

Date performanță (ultimele 7 zile):
- CTR: ${avgCtr.toFixed(2)}%
- ROAS: ${avgRoas > 0 ? avgRoas.toFixed(2) + "x" : "N/A"}
- Total spend: ${totalSpend.toFixed(0)} RON
- Total comenzi: ${totalPurchases}
${hookRate !== null ? `- Hook rate (p25/plays): ${(hookRate * 100).toFixed(0)}%` : ""}
${avgWatchTime > 0 ? `- Timp mediu vizionare: ${avgWatchTime.toFixed(1)}s` : ""}

${lastReport ? `Diagnostic AI: ${lastReport.summary}` : ""}
${lastReport?.problems ? `Probleme identificate: ${JSON.stringify(lastReport.problems)}` : ""}

Returnează JSON cu exact această structură:
{
  "diagnosis": "de ce performanța e slabă și ce trebuie schimbat la video",
  "targetAudience": "descriere concisă a publicului țintă pentru acest video",
  "hook": {
    "type": "pain_point|curiosity|testimonial|demo|social_proof",
    "script": "textul exact al hook-ului (pentru subtitrare/voiceover)",
    "visual": "ce trebuie să se vadă în cadru în primele 3 secunde",
    "durationSec": 3
  },
  "body": {
    "structure": "demo_product|problem_solution|before_after_implied|testimonial_story",
    "keyPoints": ["punct 1", "punct 2", "punct 3"],
    "visual": "descriere vizuală a secțiunii principale",
    "durationSec": 20
  },
  "socialProof": {
    "type": "overlay_text|testimonial_spoken|review_screenshot",
    "content": "textul exact al social proof-ului",
    "durationSec": 4
  },
  "cta": {
    "script": "textul CTA",
    "visual": "cum arată CTA vizual",
    "durationSec": 3
  },
  "format": "9:16",
  "totalDurationSec": 30,
  "productionNotes": ["notă 1", "notă 2", "notă 3"],
  "metaPolicyWarnings": ["warning dacă ceva ar putea fi respins de Meta"]
}`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== "text") throw new Error("Unexpected response type")

  let brief: VideoBrief
  try {
    brief = JSON.parse(content.text)
  } catch {
    throw new Error("Failed to parse video brief JSON")
  }

  await db.campaignAIReport.create({
    data: {
      organizationId,
      campaignId,
      reportType: "VIDEO_BRIEF",
      summary: brief.diagnosis,
      problems: [],
      suggestions: [],
      videoBrief: brief,
      modelUsed: "claude-sonnet-4-6",
    },
  })
}
```

- [ ] **Step 2: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add features/meta/video-brief-generator.ts
git commit -m "feat: add video brief generator with Claude API structured output"
```

---

### Task 2: API Route — Video Brief

**Files:**
- Create: `app/api/meta/campaigns/[id]/video-brief/route.ts`

- [ ] **Step 1: Creează route-ul**

```typescript
// app/api/meta/campaigns/[id]/video-brief/route.ts
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"
import { generateVideoBrief } from "@/features/meta/video-brief-generator"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const campaign = await db.campaign.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  await generateVideoBrief(organizationId, id)

  const report = await db.campaignAIReport.findFirst({
    where: { campaignId: id, organizationId, reportType: "VIDEO_BRIEF" },
    orderBy: { generatedAt: "desc" },
  })

  return NextResponse.json({ success: true, brief: report?.videoBrief })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const report = await db.campaignAIReport.findFirst({
    where: { campaignId: id, organizationId, reportType: "VIDEO_BRIEF" },
    orderBy: { generatedAt: "desc" },
    select: { videoBrief: true, generatedAt: true },
  })

  return NextResponse.json({ brief: report?.videoBrief ?? null, generatedAt: report?.generatedAt ?? null })
}
```

- [ ] **Step 2: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/meta/campaigns/\[id\]/video-brief/route.ts
git commit -m "feat: add video brief POST and GET endpoints"
```

---

### Task 3: UI — VideoBriefCard

**Files:**
- Create: `features/meta/components/VideoBriefCard.tsx`

- [ ] **Step 1: Creează componenta**

```typescript
// features/meta/components/VideoBriefCard.tsx
"use client"
import { useState } from "react"
import { Video, Copy, Check, ExternalLink } from "lucide-react"
import type { VideoBrief } from "@/features/meta/video-brief-generator"

const HOOK_TYPE_LABELS: Record<string, string> = {
  pain_point: "Pain Point",
  curiosity: "Curiozitate",
  testimonial: "Testimonial",
  demo: "Demo direct",
  social_proof: "Social Proof",
}

const STRUCTURE_LABELS: Record<string, string> = {
  demo_product: "Demo produs",
  problem_solution: "Problemă → Soluție",
  before_after_implied: "Înainte/După (implicit)",
  testimonial_story: "Poveste testimonial",
}

interface VideoBriefCardProps {
  brief: VideoBrief
  generatedAt?: string
  campaignName: string
}

export function VideoBriefCard({ brief, generatedAt, campaignName }: VideoBriefCardProps) {
  const [copied, setCopied] = useState(false)

  const copyBrief = async () => {
    const text = `BRIEF VIDEO — ${campaignName}

DIAGNOSTIC: ${brief.diagnosis}

PUBLIC ȚINTĂ: ${brief.targetAudience}

HOOK (0-${brief.hook.durationSec}s) — ${HOOK_TYPE_LABELS[brief.hook.type]}
Script: "${brief.hook.script}"
Vizual: ${brief.hook.visual}

BODY (${brief.hook.durationSec}-${brief.hook.durationSec + brief.body.durationSec}s) — ${STRUCTURE_LABELS[brief.body.structure]}
Puncte cheie:
${brief.body.keyPoints.map((p) => `• ${p}`).join("\n")}
Vizual: ${brief.body.visual}

SOCIAL PROOF (${brief.hook.durationSec + brief.body.durationSec}-${brief.hook.durationSec + brief.body.durationSec + brief.socialProof.durationSec}s)
Content: "${brief.socialProof.content}"

CTA (ultimele ${brief.cta.durationSec}s)
Script: "${brief.cta.script}"
Vizual: ${brief.cta.visual}

FORMAT: ${brief.format} | DURATĂ TOTALĂ: ${brief.totalDurationSec}s

NOTE PRODUCȚIE:
${brief.productionNotes.map((n) => `• ${n}`).join("\n")}
${brief.metaPolicyWarnings.length > 0 ? `\n⚠️ POLITICI META:\n${brief.metaPolicyWarnings.map((w) => `• ${w}`).join("\n")}` : ""}`

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-sm font-semibold text-[#1C1917]">Brief Video Generat</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#F5F5F4] text-[#78716C]">
            {brief.format} · {brief.totalDurationSec}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyBrief}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#78716C] bg-[#F5F5F4] hover:bg-[#E7E5E4] rounded-lg transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiat!" : "Copiază brief"}
          </button>
          <a
            href="/videos/new"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#D4AF37] hover:bg-[#B8971F] rounded-lg transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Creează video
          </a>
        </div>
      </div>

      {/* Diagnosis */}
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
        <p className="text-xs text-amber-800">{brief.diagnosis}</p>
      </div>

      {/* Sections timeline */}
      <div className="space-y-2">
        {/* Hook */}
        <div className="flex gap-3 p-3 rounded-lg border border-[#E7E5E4] bg-[#FAFAF9]">
          <div className="flex-shrink-0 text-xs font-bold text-white bg-violet-500 rounded px-2 py-0.5 h-fit">
            HOOK · 0-{brief.hook.durationSec}s
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#44403C]">{HOOK_TYPE_LABELS[brief.hook.type]}</span>
            </div>
            <p className="text-sm font-medium text-[#1C1917]">"{brief.hook.script}"</p>
            <p className="text-xs text-[#78716C]">{brief.hook.visual}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex gap-3 p-3 rounded-lg border border-[#E7E5E4] bg-[#FAFAF9]">
          <div className="flex-shrink-0 text-xs font-bold text-white bg-blue-500 rounded px-2 py-0.5 h-fit whitespace-nowrap">
            BODY · {brief.hook.durationSec}-{brief.hook.durationSec + brief.body.durationSec}s
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-medium text-[#44403C]">{STRUCTURE_LABELS[brief.body.structure]}</span>
            <ul className="space-y-0.5">
              {brief.body.keyPoints.map((p, i) => (
                <li key={i} className="text-xs text-[#44403C]">• {p}</li>
              ))}
            </ul>
            <p className="text-xs text-[#78716C]">{brief.body.visual}</p>
          </div>
        </div>

        {/* Social Proof */}
        <div className="flex gap-3 p-3 rounded-lg border border-[#E7E5E4] bg-[#FAFAF9]">
          <div className="flex-shrink-0 text-xs font-bold text-white bg-emerald-500 rounded px-2 py-0.5 h-fit whitespace-nowrap">
            PROOF · {brief.hook.durationSec + brief.body.durationSec}s
          </div>
          <p className="text-sm text-[#1C1917]">"{brief.socialProof.content}"</p>
        </div>

        {/* CTA */}
        <div className="flex gap-3 p-3 rounded-lg border border-[#E7E5E4] bg-[#FAFAF9]">
          <div className="flex-shrink-0 text-xs font-bold text-white bg-[#D4AF37] rounded px-2 py-0.5 h-fit">
            CTA · -{brief.cta.durationSec}s
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium text-[#1C1917]">"{brief.cta.script}"</p>
            <p className="text-xs text-[#78716C]">{brief.cta.visual}</p>
          </div>
        </div>
      </div>

      {/* Production notes */}
      {brief.productionNotes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Note producție</p>
          {brief.productionNotes.map((note, i) => (
            <p key={i} className="text-xs text-[#44403C]">• {note}</p>
          ))}
        </div>
      )}

      {/* Meta policy warnings */}
      {brief.metaPolicyWarnings.length > 0 && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-1">
          <p className="text-xs font-semibold text-red-700">⚠️ Atenție politici Meta</p>
          {brief.metaPolicyWarnings.map((w, i) => (
            <p key={i} className="text-xs text-red-600">• {w}</p>
          ))}
        </div>
      )}

      {generatedAt && (
        <p className="text-xs text-[#A8A29E]">
          Generat la {new Date(generatedAt).toLocaleString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
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
git add features/meta/components/VideoBriefCard.tsx
git commit -m "feat: add VideoBriefCard UI with timeline layout and copy-to-clipboard"
```

---

### Task 4: Integrare Video Brief în CampaignAIPanel

**Files:**
- Modify: `features/meta/components/CampaignAIPanel.tsx`
- Modify: `features/meta/hooks/useCampaignAI.ts`

- [ ] **Step 1: Adaugă useVideoBrief în hook**

În `features/meta/hooks/useCampaignAI.ts`, adaugă:

```typescript
export function useVideoBrief(campaignId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["campaign-video-brief", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/video-brief`)
      if (!res.ok) return null
      const data = await res.json()
      return data.brief ? { brief: data.brief, generatedAt: data.generatedAt } : null
    },
    staleTime: 10 * 60 * 1000,
  })

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/video-brief`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Video brief generation failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-video-brief", campaignId] })
    },
  })

  return { ...query, generate: generate.mutate, isGenerating: generate.isPending }
}
```

- [ ] **Step 2: Adaugă buton și afișare în CampaignAIPanel**

În `features/meta/components/CampaignAIPanel.tsx`, adaugă importurile:

```typescript
import { useVideoBrief } from "@/features/meta/hooks/useCampaignAI"
import { VideoBriefCard } from "./VideoBriefCard"
import type { VideoBrief } from "@/features/meta/video-brief-generator"
```

Adaugă în componentă:

```typescript
const { data: videoBriefData, generate: generateBrief, isGenerating } = useVideoBrief(campaignId)
```

Adaugă după secțiunea suggestions în JSX:

```typescript
              {/* Video Brief Section */}
              <div className="border-t border-[#E7E5E4] pt-4">
                {videoBriefData ? (
                  <VideoBriefCard
                    brief={videoBriefData.brief as unknown as VideoBrief}
                    generatedAt={videoBriefData.generatedAt}
                    campaignName={campaignId}
                  />
                ) : (
                  <button
                    onClick={() => generateBrief()}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-[#D4AF37] text-[#D4AF37] hover:bg-[#FFFBEB] transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <Video className="w-4 h-4" />
                    {isGenerating ? "Generez brief video..." : "🎬 Generează Brief Video"}
                  </button>
                )}
              </div>
```

Adaugă importul `Video` din lucide-react dacă nu există.

- [ ] **Step 3: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add features/meta/components/CampaignAIPanel.tsx features/meta/hooks/useCampaignAI.ts
git commit -m "feat: integrate video brief generation button and display in CampaignAIPanel"
```

---

### Task 5: Scaling Rules Engine

**Files:**
- Create: `features/meta/scaling-rules.ts`

- [ ] **Step 1: Creează fișierul**

```typescript
// features/meta/scaling-rules.ts
import { db } from "@/lib/db"
import { RO_BENCHMARKS } from "./knowledge-base"

export interface ScalingRule {
  id: string
  label: string
  trigger: "roas_above" | "roas_below" | "cpa_above" | "frequency_above" | "hook_rate_low"
  threshold: number
  consecutiveDays: number
  action: "suggest_increase" | "suggest_decrease" | "suggest_pause" | "suggest_new_creative"
  changePercent?: number
}

export interface ScalingSuggestion {
  campaignId: string
  campaignName: string
  ruleId: string
  action: ScalingRule["action"]
  changePercent?: number
  reason: string
  currentValue: number
  threshold: number
  daysTriggered: number
}

export const DEFAULT_SCALING_RULES: ScalingRule[] = [
  {
    id: "scale_up_high_roas",
    label: "Scale up ROAS excelent",
    trigger: "roas_above",
    threshold: RO_BENCHMARKS.roas.good,
    consecutiveDays: 3,
    action: "suggest_increase",
    changePercent: 20,
  },
  {
    id: "scale_down_low_roas",
    label: "Reduce budget ROAS slab",
    trigger: "roas_below",
    threshold: RO_BENCHMARKS.roas.poor,
    consecutiveDays: 5,
    action: "suggest_pause",
  },
  {
    id: "audience_fatigue",
    label: "Frecvență ridicată — schimbă creative",
    trigger: "frequency_above",
    threshold: RO_BENCHMARKS.frequency.danger,
    consecutiveDays: 3,
    action: "suggest_new_creative",
  },
  {
    id: "reduce_high_cpa",
    label: "CPA prea ridicat",
    trigger: "cpa_above",
    threshold: RO_BENCHMARKS.cpa.poor,
    consecutiveDays: 7,
    action: "suggest_decrease",
    changePercent: 20,
  },
]

export async function evaluateScalingRules(
  organizationId: string,
  rules: ScalingRule[] = DEFAULT_SCALING_RULES
): Promise<ScalingSuggestion[]> {
  const campaigns = await db.campaign.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: {
      metrics: {
        where: { date: { lte: new Date(Date.now() - 86400000) } },
        orderBy: { date: "desc" },
        take: 10,
        select: {
          spend: true, purchases: true, roas: true,
          frequency: true, videoPlays: true, videoP25: true,
        },
      },
    },
  })

  const suggestions: ScalingSuggestion[] = []

  for (const campaign of campaigns) {
    for (const rule of rules) {
      const metrics = campaign.metrics.slice(0, rule.consecutiveDays)
      if (metrics.length < rule.consecutiveDays) continue

      let triggered = false
      let currentValue = 0

      if (rule.trigger === "roas_above") {
        const roasValues = metrics.filter((m) => m.roas !== null)
        if (roasValues.length < rule.consecutiveDays) continue
        triggered = roasValues.every((m) => (m.roas ?? 0) > rule.threshold)
        currentValue = roasValues.reduce((s, m) => s + (m.roas ?? 0), 0) / roasValues.length
      }

      if (rule.trigger === "roas_below") {
        const roasValues = metrics.filter((m) => m.roas !== null)
        if (roasValues.length < rule.consecutiveDays) continue
        triggered = roasValues.every((m) => (m.roas ?? 0) < rule.threshold)
        currentValue = roasValues.reduce((s, m) => s + (m.roas ?? 0), 0) / roasValues.length
      }

      if (rule.trigger === "frequency_above") {
        const freqValues = metrics.filter((m) => m.frequency !== null)
        if (freqValues.length < rule.consecutiveDays) continue
        triggered = freqValues.every((m) => (m.frequency ?? 0) > rule.threshold)
        currentValue = freqValues.reduce((s, m) => s + (m.frequency ?? 0), 0) / freqValues.length
      }

      if (rule.trigger === "cpa_above") {
        const totalSpend = metrics.reduce((s, m) => s + m.spend, 0)
        const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0)
        if (totalPurchases === 0) continue
        currentValue = totalSpend / totalPurchases
        triggered = currentValue > rule.threshold
      }

      if (triggered) {
        const actionLabels = {
          suggest_increase: `Mărește bugetul cu ${rule.changePercent}%`,
          suggest_decrease: `Reduce bugetul cu ${rule.changePercent}%`,
          suggest_pause: "Consideră oprirea campaniei",
          suggest_new_creative: "Înlocuiește creative-ul curent",
        }

        suggestions.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          ruleId: rule.id,
          action: rule.action,
          changePercent: rule.changePercent,
          reason: `${rule.label} — ${currentValue.toFixed(2)} ${rule.trigger.includes("roas") ? "x ROAS" : rule.trigger.includes("freq") ? "frecvență" : "RON CPA"} (${rule.consecutiveDays} zile)`,
          currentValue,
          threshold: rule.threshold,
          daysTriggered: rule.consecutiveDays,
        })
      }
    }
  }

  return suggestions
}
```

- [ ] **Step 2: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add features/meta/scaling-rules.ts
git commit -m "feat: add scaling rules engine for campaign budget optimization suggestions"
```

---

### Task 6: Campaign Compare Page

**Files:**
- Create: `app/(dashboard)/campaigns/compare/page.tsx`

- [ ] **Step 1: Creează pagina**

```typescript
// app/(dashboard)/campaigns/compare/page.tsx
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { db } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CampaignStatusBadge } from "@/features/meta/components/CampaignStatusBadge"
import { RoasBadge } from "@/features/meta/components/RoasBadge"

export default async function CampaignComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const campaignIds = ids ? ids.split(",").slice(0, 4) : []

  const allCampaigns = await db.campaign.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  })

  const selectedCampaigns =
    campaignIds.length > 0
      ? await db.campaign.findMany({
          where: { id: { in: campaignIds }, organizationId: orgId },
          include: {
            metrics: {
              where: { date: { lte: new Date(Date.now() - 86400000) } },
              orderBy: { date: "desc" },
              take: 30,
            },
          },
        })
      : []

  const campaignData = selectedCampaigns.map((c) => {
    const m = c.metrics
    const totalSpend = m.reduce((s, x) => s + x.spend, 0)
    const totalPurchases = m.reduce((s, x) => s + x.purchases, 0)
    const withRoas = m.filter((x) => x.roas !== null)
    const avgRoas = withRoas.length > 0 ? withRoas.reduce((s, x) => s + (x.roas ?? 0), 0) / withRoas.length : null
    const withCtr = m.filter((x) => x.ctr !== null)
    const avgCtr = withCtr.length > 0 ? withCtr.reduce((s, x) => s + (x.ctr ?? 0), 0) / withCtr.length : null
    const withCpm = m.filter((x) => x.cpm !== null)
    const avgCpm = withCpm.length > 0 ? withCpm.reduce((s, x) => s + (x.cpm ?? 0), 0) / withCpm.length : null
    const withFreq = m.filter((x) => x.frequency !== null)
    const avgFreq = withFreq.length > 0 ? withFreq.reduce((s, x) => s + (x.frequency ?? 0), 0) / withFreq.length : null
    const totalPlays = m.reduce((s, x) => s + (x.videoPlays ?? 0), 0)
    const totalP25 = m.reduce((s, x) => s + (x.videoP25 ?? 0), 0)
    const hookRate = totalPlays > 100 ? totalP25 / totalPlays : null

    return {
      id: c.id, name: c.name, status: c.status, budget: c.budget,
      totalSpend, totalPurchases, avgRoas, avgCtr, avgCpm, avgFreq, hookRate,
      cpa: totalPurchases > 0 ? totalSpend / totalPurchases : null,
    }
  })

  const metrics = [
    { key: "avgRoas", label: "ROAS Mediu", format: (v: number | null) => v ? `${v.toFixed(2)}x` : "—", better: "higher" },
    { key: "totalSpend", label: "Spend Total", format: (v: number | null) => v ? `${v.toFixed(0)} RON` : "—", better: "lower" },
    { key: "totalPurchases", label: "Comenzi", format: (v: number | null) => v?.toString() ?? "—", better: "higher" },
    { key: "cpa", label: "CPA", format: (v: number | null) => v ? `${v.toFixed(0)} RON` : "—", better: "lower" },
    { key: "avgCtr", label: "CTR Mediu", format: (v: number | null) => v ? `${v.toFixed(2)}%` : "—", better: "higher" },
    { key: "avgCpm", label: "CPM Mediu", format: (v: number | null) => v ? `${v.toFixed(1)} RON` : "—", better: "lower" },
    { key: "avgFreq", label: "Frecvență", format: (v: number | null) => v ? v.toFixed(1) : "—", better: "lower" },
    { key: "hookRate", label: "Hook Rate", format: (v: number | null) => v ? `${(v * 100).toFixed(0)}%` : "—", better: "higher" },
  ] as const

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="rounded-lg p-2 text-[#78716C] hover:bg-[#F5F5F4] transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Comparare Campanii</h1>
          <p className="text-sm text-[#78716C]">Selectează până la 4 campanii pentru comparație</p>
        </div>
      </div>

      {/* Campaign selector */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <p className="text-sm font-medium text-[#44403C] mb-3">Selectează campanii:</p>
        <div className="flex flex-wrap gap-2">
          {allCampaigns.map((c) => {
            const isSelected = campaignIds.includes(c.id)
            const newIds = isSelected
              ? campaignIds.filter((id) => id !== c.id)
              : [...campaignIds, c.id].slice(0, 4)
            return (
              <Link
                key={c.id}
                href={`/campaigns/compare?ids=${newIds.join(",")}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  isSelected
                    ? "bg-[#1C1917] text-white border-[#1C1917]"
                    : "bg-white text-[#44403C] border-[#E7E5E4] hover:border-[#A8A29E]"
                }`}
              >
                {c.name}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Comparison table */}
      {campaignData.length > 0 && (
        <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7E5E4] bg-[#FAFAF9]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide w-32">Metric</th>
                  {campaignData.map((c) => (
                    <th key={c.id} className="text-left px-4 py-3">
                      <div className="space-y-1">
                        <Link href={`/campaigns/${c.id}`} className="text-xs font-semibold text-[#1C1917] hover:text-[#D4AF37] line-clamp-2">
                          {c.name}
                        </Link>
                        <CampaignStatusBadge status={c.status} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map(({ key, label, format, better }) => {
                  const values = campaignData.map((c) => c[key as keyof typeof c] as number | null)
                  const numericValues = values.filter((v): v is number => v !== null)
                  const best = numericValues.length > 0
                    ? better === "higher" ? Math.max(...numericValues) : Math.min(...numericValues)
                    : null

                  return (
                    <tr key={key} className="border-b border-[#E7E5E4] hover:bg-[#FAFAF9]">
                      <td className="px-4 py-3 text-xs font-medium text-[#78716C]">{label}</td>
                      {values.map((v, i) => (
                        <td key={campaignData[i].id} className="px-4 py-3">
                          <span className={`text-sm font-medium ${v !== null && v === best ? "text-emerald-600" : "text-[#1C1917]"}`}>
                            {format(v)}
                          </span>
                          {v !== null && v === best && numericValues.length > 1 && (
                            <span className="ml-1 text-xs text-emerald-500">↑ best</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adaugă link "Compară" în campaigns page**

În `app/(dashboard)/campaigns/page.tsx`, adaugă un link în header lângă butonul "Campanie nouă":

```typescript
import { GitCompareArrows } from "lucide-react"

// În JSX, lângă butonul New:
<Link
  href="/campaigns/compare"
  className="flex items-center gap-2 px-4 h-9 border border-[#E7E5E4] text-[#44403C] hover:bg-[#F5F5F4] text-sm rounded-lg transition-colors"
>
  <GitCompareArrows className="w-3.5 h-3.5" />
  Compară
</Link>
```

- [ ] **Step 3: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 4: Commit final Faza 3**

```bash
git add app/\(dashboard\)/campaigns/compare/ features/meta/scaling-rules.ts app/\(dashboard\)/campaigns/page.tsx
git commit -m "feat: phase 3 complete - video brief, scaling rules, campaign comparison"
```

---

### Task 7: Verificare End-to-End Faza 3

- [ ] **Step 1: Testare video brief**

```bash
npm run dev
```

Du-te la o campanie cu date de video (ex: 01 CBO Dispozitiv Celulita VID Net). Apasă "Generează Brief Video" în panelul AI. Verifică că brief-ul apare cu toate secțiunile.

- [ ] **Step 2: Testare campaign compare**

Du-te la `http://localhost:3000/campaigns/compare`. Selectează 3 campanii. Verifică că tabelul comparativ apare cu valorile corecte și că "best" e evidențiat corect.

- [ ] **Step 3: Build producție**

```bash
npm run build
```

Expected: Build success fără erori TypeScript.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: all 3 phases campaign intelligence complete and verified"
```
