# Campaign Intelligence Module — Design Spec

**Date:** 2026-04-05  
**Status:** Approved — ready for implementation planning  
**Scope:** azora-rise platform — `/campaigns` section  
**Abordare:** Phased (C) — 3 faze independente, fiecare livrabilă separat

---

## Context & Motivație

Platforma azora-rise colectează campanii Meta Ads, dar are 3 probleme fundamentale:

1. **Date incorecte** — sync-ul manual include ziua curentă cu date parțiale, cauzând discrepanțe față de Meta Ads Manager (ex: +76 RON în Rise față de Meta pentru o campanie activă)
2. **Date incomplete** — lipsesc `reach`, `frequency`, `purchaseValue`, `addToCart`, `initiateCheckout`, `landingPageViews`, video metrics — imposibil de detectat ad fatigue, funnel drop-off, hook performance
3. **Zero intelligence** — sistemul de alerte există în cod dar are 0 alerte generate în producție; nu există sugestii AI, nu există video briefs, nu există scoring per campanie

**Soluție:** 3 faze care transformă azora-rise dintr-un viewer pasiv de campanii într-un sistem activ de optimizare.

---

## Research Inputs

Spec-ul se bazează pe 4 surse de cercetare colectate 2026-04-05:

- **Analiza campaniilor reale (DB):** 17 campanii, ~4.296 RON cheltuit, 35 comenzi, CPA ~122 RON
- **Audit colectare date:** bug sync confirmat, 10+ câmpuri Meta lipsă identificate
- **Research piata RO:** ROAS target 3-4x; UGC 161% mai bun; ABO testare → CBO scalare după 50 conversii/săpt
- **Research Claude Code + Meta:** MCP `meta-ads-mcp` configurat; repo `claude-ads` cu 190 audit checks; arhitectură cu tool use Claude API

---

## Faza 1 — Data Foundation

### 1.1 Fix Bug Sync Manual

**Fișier:** `app/api/meta/sync/route.ts` linia ~14

**Problema:** Sync-ul manual folosește `today` ca end date, incluzând spend parțial intraday.  
**Fix:** Înlocuiește `today` cu `yesterday` — aliniază cu sync-ul cron care deja folosește `getYesterday()`.

```typescript
// ÎNAINTE
const today = new Date().toISOString().split("T")[0]
const metricsResult = await syncDailyMetrics(organizationId, thirtyDaysAgo, today)

// DUPĂ
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
const metricsResult = await syncDailyMetrics(organizationId, thirtyDaysAgo, yesterday)
```

**Fix secundar:** `app/(dashboard)/campaigns/page.tsx` și `app/api/meta/campaigns/route.ts` — filtrul de metrici trebuie să excludă ziua curentă:

```typescript
metrics: {
  where: { date: { lte: new Date(Date.now() - 86400000) } }, // exclude azi
  orderBy: { date: 'desc' },
  take: 30
}
```

### 1.2 Schema Extinsă — CampaignMetrics

**Fișier:** `prisma/schema.prisma`

Câmpuri noi în modelul `CampaignMetrics`:

```prisma
model CampaignMetrics {
  // Existente
  id          String   @id @default(cuid())
  campaignId  String
  date        DateTime @db.Date
  spend       Float    @default(0)
  impressions Int      @default(0)
  clicks      Int      @default(0)
  purchases   Int      @default(0)
  roas        Float?
  cpm         Float?
  ctr         Float?
  
  // NOI — Audience
  reach         Int?    // Utilizatori unici care au văzut reclama
  frequency     Float?  // impressions / reach — indicator ad fatigue
  
  // NOI — Revenue
  purchaseValue Float?  // Valoarea RON a achizițiilor (pentru ROAS corect)
  
  // NOI — Funnel
  landingPageViews  Int?  // Vizite efective pe site (≠ link clicks)
  addToCart         Int?  // Adăugări în coș
  initiateCheckout  Int?  // Inițieri checkout
  
  // NOI — Video Performance
  videoPlays            Int?    // Total redări video
  videoP25              Int?    // Utilizatori care au văzut 25% (hook rate = p25/plays)
  videoP50              Int?    // Utilizatori care au văzut 50%
  videoP75              Int?    // Utilizatori care au văzut 75%
  videoP95              Int?    // Utilizatori care au văzut 95%
  videoAvgWatchTimeSec  Float?  // Timp mediu vizionare în secunde
  videoThruPlays        Int?    // ThruPlays (15s+ sau vizionare completă)
  
  createdAt DateTime @default(now())
  campaign  Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, date])
  @@index([campaignId])
}
```

Același set de câmpuri noi (reach, frequency, purchaseValue, landingPageViews, addToCart, initiateCheckout, video*) se adaugă și în `AdSetMetrics` și `AdMetrics`.

### 1.3 Meta API — Fields Extinse

**Fișier:** `features/meta/client.ts` — funcția `fetchCampaignInsights`

Fields noi adăugate în request:

```typescript
const fields = [
  'campaign_id', 'adset_id', 'ad_id',
  'date_start', 'date_stop',
  // Existente
  'spend', 'impressions', 'clicks', 'cpm', 'ctr',
  'actions', 'action_values',
  // NOI
  'reach', 'frequency',
  'unique_clicks', 'outbound_clicks', 'landing_page_views',
  'purchase_roas',
  'video_avg_time_watched_actions',
  'video_p25_watched_actions',
  'video_p50_watched_actions', 
  'video_p75_watched_actions',
  'video_p95_watched_actions',
  'video_play_actions',
  'video_thruplay_watched_actions',
].join(',')

// Attribution window aliniat cu setarea contului
const params = {
  fields,
  time_range: JSON.stringify({ since, until }),
  time_increment: '1',
  level: 'campaign',
  use_account_attribution_setting: 'true',  // NOU — aliniază cu Ads Manager
}
```

Interface-ul `MetaInsights` se extinde cu toate câmpurile noi.

**Parsare acțiuni** — funcție nouă `parseActionValue(actions, actionType)` care extrage din array-ul `actions`:
- `purchase` → `purchases`
- `add_to_cart` → `addToCart`  
- `initiate_checkout` → `initiateCheckout`
- `landing_page_view` → `landingPageViews`
- `video_view` → `videoPlays`

### 1.4 Ad-Set Level Sync

**Fișier:** `features/meta/campaigns-sync.ts`

Funcție nouă `syncAdSetMetrics(organizationId, since, until)` care:
1. Ia toți AdSet-ii din DB pentru org
2. Apelează `fetchCampaignInsights` cu `level: 'adset'`
3. Upsert în `AdSetMetrics` (aceleași câmpuri ca CampaignMetrics)

Sincronizat în același cron și manual sync ca CampaignMetrics.

### 1.5 Alertele Activate + Extindere

**Fișier:** `features/meta/alerts.ts`

Alertele existente (ROAS_LOW, SPEND_EXCEEDED, CTR_LOW, CPM_HIGH) sunt corecte ca logică — problema e că nu se apelează decât dacă cron-ul rulează. Se verifică că endpoint-ul `/api/cron/meta-alerts` există și e configurat în Railway.

Alerte noi adăugate:

| Tip | Trigger | Mesaj |
|-----|---------|-------|
| `FREQUENCY_HIGH` | frequency > 3.5 ultimele 3 zile | "Audiența obosită — aceeași persoană vede reclama de {X}x" |
| `LANDING_PAGE_DROP` | landingPageViews / clicks < 0.5 | "Doar {X}% din click-uri ajung pe site — verifică URL-ul reclamei" |
| `NO_ADD_TO_CART` | spend > 200 RON și addToCart = 0 | "Nicio adăugare în coș după {X} RON cheltuit — problema e la landing page" |
| `HOOK_RATE_LOW` | videoP25 / videoPlays < 0.25 | "Hook slab — doar {X}% din vizionatori trec de primele 25%" |

---

## Faza 2 — AI Intelligence

### 2.1 Arhitectura Generală

```
┌─────────────────────────────────────────────────────┐
│                  azora-rise                         │
│                                                     │
│  [Cron 8:00 AM] ──→ [Prisma: pull metrici 7 zile]  │
│                          │                          │
│                          ▼                          │
│                 [Claude API: claude-sonnet-4-6]     │
│                 Tool: analyze_campaigns             │
│                 Input: metrici + benchmarks RO      │
│                 Output: CampaignAIReport            │
│                          │                          │
│                          ▼                          │
│                 [Prisma: save report]               │
│                          │                          │
│           ┌──────────────┤                          │
│           ▼              ▼                          │
│  [UI: Daily Digest]  [Alerts extinse]               │
│  /campaigns top      /campaigns/[id]                │
│                                                     │
│  [Buton "Analizează"]                               │
│  → Claude API instant                               │
│  → răspuns în < 5s                                  │
└─────────────────────────────────────────────────────┘
```

### 2.2 Model DB — CampaignAIReport

**Fișier:** `prisma/schema.prisma`

```prisma
model CampaignAIReport {
  id             String   @id @default(cuid())
  organizationId String
  campaignId     String?  // null = raport global pentru toate campaniile
  reportType     CampaignReportType
  
  // Conținut structurat
  healthScore    Int?     // 0-100 scor general campanie
  status         String   // "excellent" | "good" | "warning" | "critical"
  summary        String   // 1-2 fraze executive summary
  problems       Json     // [{ title, severity, metric, value, benchmark, description }]
  suggestions    Json     // [{ action, priority, expectedImpact, howTo }]
  videoBrief     Json?    // null dacă nu e generat; structura video recomandat
  
  generatedAt    DateTime @default(now())
  modelUsed      String   @default("claude-sonnet-4-6")
  
  organization   Organization @relation(fields: [organizationId], references: [id])
  campaign       Campaign?    @relation(fields: [campaignId], references: [id])
  
  @@index([organizationId, reportType, generatedAt])
  @@index([campaignId])
}

enum CampaignReportType {
  DAILY_DIGEST     // Raport zilnic global (toate campaniile)
  CAMPAIGN_DEEP    // Analiză detaliată per campanie (la cerere)
  VIDEO_BRIEF      // Brief video generat de AI
}
```

### 2.3 Knowledge Base — Benchmarks RO

**Fișier:** `features/meta/knowledge-base.ts`

Constante hardcodate bazate pe research (actualizabile):

```typescript
export const RO_BENCHMARKS = {
  roas: { poor: 1.5, ok: 2.5, good: 3.5, excellent: 5.0 },
  ctr: { poor: 0.9, ok: 1.5, good: 2.5, excellent: 4.0 },
  cpm: { excellent: 15, good: 30, ok: 45, poor: 60 }, // RON
  frequency: { safe: 2.0, warning: 3.0, danger: 3.5 },
  hookRate: { poor: 0.20, ok: 0.30, good: 0.45, excellent: 0.60 }, // p25/plays
  minDaysBeforeKill: 7,      // Nu oprești o campanie înainte de 7 zile
  minSpendBeforeKill: 300,   // RON
  learningPhaseConversions: 50, // conversii necesare pentru learning phase
} as const
```

### 2.4 Claude API Integration — Daily Digest

**Fișier:** `features/meta/ai-analysis.ts` (fișier nou)

```typescript
export async function generateDailyDigest(organizationId: string): Promise<void>
```

Flow:
1. Pull metrici ultimele 7 zile per campanie din Prisma
2. Calculează benchmarks relative (față de media proprie ultimele 30 zile)
3. Apelează Claude API cu prompt structurat
4. Parsează răspunsul în `CampaignAIReport` cu `reportType: DAILY_DIGEST`
5. Salvează în DB

**Prompt structure:**

```typescript
const systemPrompt = `
Ești un expert în Meta Ads optimization pentru e-commerce românesc (beauty/wellness devices).
Analizezi campanii și oferi recomandări concrete, bazate pe date.

Benchmarks piata RO:
- ROAS: sub 1.5x = slab, 2.5-3.5x = bun, 5x+ = excelent
- CTR: sub 0.9% = hook slab, 1.5-2.5% = normal, 4%+ = excelent  
- CPM: sub 20 RON = ieftin, 40-60 RON = scump
- Frequency: peste 3.5 = audiența obosita
- Hook rate (p25/plays): sub 25% = hook slab, 45%+ = hook bun
- O campanie are nevoie de minim 7 zile și 300 RON spend pentru decizie
- CBO > ABO pentru scalare după faza de testare

Regulile tale:
1. Fii specific cu numere reale din date
2. Oferă maxim 3 acțiuni prioritare per campanie
3. Identifică dacă problema e la creative, audiență sau landing page
4. Sugerează video brief doar dacă campania are date de video metrics
5. Răspunde în română
`

const userPrompt = `
Analizează aceste campanii pentru Azora.ro (ultimele 7 zile):

${JSON.stringify(campaignsData, null, 2)}

Media contului (ultimele 30 zile):
- ROAS mediu: ${accountAvgRoas}x
- CTR mediu: ${accountAvgCtr}%
- CPM mediu: ${accountAvgCpm} RON
- CPA mediu: ${accountAvgCpa} RON

Returnează JSON cu structura:
{
  "summary": "1-2 fraze executive",
  "campaigns": [{
    "id": "campaign_id",
    "healthScore": 0-100,
    "status": "excellent|good|warning|critical",
    "problems": [{ "title", "severity": "high|medium|low", "metric", "value", "benchmark", "description" }],
    "suggestions": [{ "action", "priority": 1-3, "expectedImpact", "howTo" }]
  }]
}
`
```

### 2.5 API Route — Daily Digest

**Fișier:** `app/api/cron/campaign-digest/route.ts` (nou)

```typescript
POST /api/cron/campaign-digest
// Protejat cu INTERNAL_API_SECRET header
// Apelat de Railway Cron la 08:00 zilnic
```

Flow: requireAuth (internal) → generateDailyDigest(orgId) → 200 OK

### 2.6 Interactive AI Panel — Campaign Detail

**Fișier:** `features/meta/components/CampaignAIPanel.tsx` (nou)

Componentă client în `/campaigns/[id]/page.tsx`:

```
┌─────────────────────────────────────────┐
│  🤖 Analiză AI                [Refresh] │
│  Generată azi la 08:14                  │
├─────────────────────────────────────────┤
│  Health Score: ██████░░░░ 63/100        │
│  Status: ⚠️ Warning                     │
├─────────────────────────────────────────┤
│  PROBLEME IDENTIFICATE                  │
│  ● [HIGH] CTR 1.2% — sub benchmark 1.5%│
│    Hook-ul nu rezonează cu audiența...  │
│  ● [MED] Frequency 3.8x — audiență...  │
├─────────────────────────────────────────┤
│  ACȚIUNI RECOMANDATE                    │
│  1. Testează un hook nou (pain point)   │
│  2. Extinde audiența sau LAL 5%         │
│  3. Verifică landing page viteza        │
├─────────────────────────────────────────┤
│  [🎬 Generează Brief Video]             │
└─────────────────────────────────────────┘
```

- Afișează cel mai recent `CampaignAIReport` pentru campania respectivă
- Buton "Refresh" → POST `/api/meta/campaigns/[id]/analyze` → instant analysis
- Buton "Generează Brief Video" → POST `/api/meta/campaigns/[id]/video-brief`

### 2.7 API Routes AI

**Nou:** `app/api/meta/campaigns/[id]/analyze/route.ts`
- POST → apelează Claude API instant cu datele campaniei
- Salvează `CampaignAIReport` cu `reportType: CAMPAIGN_DEEP`
- Returnează raportul

**Nou:** `app/api/meta/campaigns/[id]/video-brief/route.ts`
- POST → generează brief video complet
- Salvează cu `reportType: VIDEO_BRIEF`

### 2.8 Campaign Health Score pe Lista Campaniilor

Pagina `/campaigns` afișează health score per rând în tabel:

| Campanie | Status | Budget | Spend | ROAS | Score |
|----------|--------|--------|-------|------|-------|
| Bagheta Bule | Pauzat | 140 RON | 1212 RON | 2.3x | 72 🟡 |
| 01 CBO VID Net | Pauzat | 100 RON | 290 RON | 13.8x | 95 🟢 |

Scoreul se calculează din ultimul `CampaignAIReport.healthScore`.

---

## Faza 3 — Video Brief & Advanced

### 3.1 Video Brief Generator

Declanșat din:
- Butonul "Generează Brief Video" în CampaignAIPanel
- Automat în Daily Digest dacă `healthScore < 50` și campania are reclame video

**Output structurat** (salvat în `CampaignAIReport.videoBrief`):

```json
{
  "diagnosis": "CTR 1.2% și hook rate 22% indică că hook-ul nu captează atenția",
  "hook": {
    "type": "pain_point",
    "script": "Te-ai săturat să ascunzi celulita în fiecare vară?",
    "visual": "Close-up pe zona problematică, lumină naturală, fără filtre",
    "duration_sec": 3
  },
  "body": {
    "structure": "demo_product",
    "key_points": [
      "Demonstrează dispozitivul în acțiune pe piele reală",
      "Arată textura și senzația (EMS se simte, LED se vede)",
      "Clipul cu clientă reală folosind produsul acasă"
    ],
    "duration_sec": 20
  },
  "social_proof": {
    "type": "overlay_text",
    "content": "⭐⭐⭐⭐⭐ Raluca din Cluj: «Vizibil în 3 săptămâni!»",
    "duration_sec": 3
  },
  "cta": {
    "script": "Comandă acum cu livrare gratuită",
    "visual": "Pulse animation pe buton, logo + URL vizibil",
    "duration_sec": 4
  },
  "format": "9:16",
  "total_duration_sec": 30,
  "notes": [
    "Subtitrări obligatorii (85% vizionează fără sunet)",
    "Deschide cu față umană, nu cu produs",
    "Evită before/after side-by-side — politici Meta"
  ]
}
```

UI: afișat în `CampaignAIPanel` cu posibilitate de copy + link direct către `/videos/new` cu parametrii pre-completați.

### 3.2 Campaign Comparison View

**Rută nouă:** `/campaigns/compare`

Permite selectarea a 2-4 campanii și afișarea lor side-by-side:
- Metrici zilnice suprapuse pe același grafic (spend, ROAS, CTR)
- Tabel comparativ cu toate KPI-urile
- AI summary: "Campania X performează mai bine la CTR datorită hook-ului de tip testimonial"

### 3.3 Scaling Rules Engine

**Fișier:** `features/meta/scaling-rules.ts` (nou)

Reguli configurabile per organizație:

```typescript
interface ScalingRule {
  trigger: 'roas_above' | 'roas_below' | 'cpa_above' | 'frequency_above'
  threshold: number
  consecutiveDays: number
  action: 'suggest_increase' | 'suggest_decrease' | 'suggest_pause' | 'suggest_new_creative'
  changePercent?: number  // % budget change
}

const DEFAULT_RULES: ScalingRule[] = [
  { trigger: 'roas_above', threshold: 3.5, consecutiveDays: 3, action: 'suggest_increase', changePercent: 20 },
  { trigger: 'roas_below', threshold: 1.5, consecutiveDays: 5, action: 'suggest_pause' },
  { trigger: 'frequency_above', threshold: 3.5, consecutiveDays: 3, action: 'suggest_new_creative' },
  { trigger: 'cpa_above', threshold: 150, consecutiveDays: 7, action: 'suggest_decrease', changePercent: 20 },
]
```

Sugestiile de scaling apar în CampaignAIPanel și Daily Digest. **Nu execută acțiuni automat** — toate sunt sugestii care necesită aprobare manuală (buton "Aplică" → confirmă).

### 3.4 Ad-Level Creative Performance

Sync `AdMetrics` populate (nivel ad individual) permite:
- Tabel în campaign detail: per ad, CTR, ROAS, hook rate
- Identificare automată "winning creative" (cel mai bun ad din campanie)
- "Losing creative" badge pe reclamele cu hook rate < 25%

---

## Deviații Intenționate față de Spec-uri Anterioare

| Deviație | Motivație |
|----------|-----------|
| Claude API model: `claude-sonnet-4-6` (nu Opus) | Cost-eficient pentru analize zilnice; Opus rezervat pentru task-uri complexe single-shot |
| Fără auto-execuție acțiuni Meta | Human-in-loop obligatoriu — nicio modificare de budget/status fără aprobare manuală |
| Video brief în azora-rise (nu azora-ads) | Brief-ul e context-dependent pe metrici campanie; generarea video rămâne în azora-ads |
| Attribution window: `use_account_attribution_setting` | Aliniează cu ce vede utilizatorul în Ads Manager, fără hardcoding |
| Daily digest la 08:00 (nu real-time) | Real-time ar necesita webhook Meta (complex); zilnic e suficient pentru decizii |

---

## Structura Fișierelor Noi

```
features/meta/
├── ai-analysis.ts              ← generateDailyDigest(), generateCampaignAnalysis()
├── knowledge-base.ts           ← RO_BENCHMARKS, scaling rules defaults
├── scaling-rules.ts            ← evaluateScalingRules()
├── video-brief-generator.ts    ← generateVideoBrief()
└── components/
    ├── CampaignAIPanel.tsx     ← Panel AI în campaign detail
    ├── CampaignHealthBadge.tsx ← Score badge pentru tabel campanii
    ├── VideoBriefCard.tsx      ← Afișare brief video generat
    └── DailyDigestBanner.tsx   ← Banner digest zilnic în /campaigns

app/(dashboard)/campaigns/
└── compare/
    └── page.tsx                ← Campaign comparison view

app/api/
├── cron/
│   └── campaign-digest/
│       └── route.ts            ← POST cron zilnic 08:00
└── meta/
    └── campaigns/
        └── [id]/
            ├── analyze/
            │   └── route.ts    ← POST instant analysis
            └── video-brief/
                └── route.ts    ← POST video brief

prisma/
└── schema.prisma               ← CampaignAIReport model + câmpuri noi în Metrics
```

---

## Migrații DB (în ordine)

1. **Migration 1 (Faza 1):** Adaugă câmpuri noi în `CampaignMetrics`, `AdSetMetrics`, `AdMetrics`
2. **Migration 2 (Faza 2):** Adaugă model `CampaignAIReport` + enum `CampaignReportType`
3. Nicio migrație pentru Faza 3 (refolosește structura existentă)

---

## Dependențe (deja instalate)

- `@anthropic-ai/sdk` — ✅ în package.json
- `prisma` + `@prisma/client` — ✅
- `react-query` — ✅
- Meta Marketing API v21.0 — ✅ (upgrade la v22+ opțional)

Nicio dependență nouă necesară.
