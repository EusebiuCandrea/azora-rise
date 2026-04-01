# Parcurs Client (Customer Journey) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the existing mock UI for `/journey` with real tracking data collected from azora-shop, processed into funnel snapshots, and analyzed by Claude AI.

**Architecture:** azora-shop fires fire-and-forget events → Rise stores TrackingEvent + upserts JourneySession → daily cron aggregates JourneySnapshot → Claude generates JourneyAIReport → UI reads real data via `/api/journey/data`.

**Tech Stack:** Next.js 16 App Router, Prisma + PostgreSQL, Claude claude-sonnet-4-6 (Anthropic SDK already integrated), React Query, shadcn/ui, Zod

---

## File Map

**New files:**
- `prisma/schema.prisma` — add 5 new models (modify existing)
- `src/app/api/tracking/event/route.ts` — public POST, no auth, rate limited
- `src/app/api/journey/snapshot/route.ts` — POST to compute JourneySnapshot
- `src/app/api/journey/report/route.ts` — POST to generate JourneyAIReport via Claude
- `src/app/api/journey/data/route.ts` — GET snapshot + AI report for UI
- `src/app/api/journey/alerts/route.ts` — GET active alerts
- `src/lib/journey/knowledge-base.ts` — RO market benchmarks (static)
- `src/lib/journey/snapshot.ts` — snapshot computation logic
- `src/lib/journey/ai-report.ts` — Claude prompt + parsing
- `src/lib/journey/alerts.ts` — alert threshold checks
- `src/features/journey/hooks/useJourneyData.ts` — React Query hook

**Modified files:**
- `src/features/journey/JourneyFunnel.tsx` — replace hardcoded data with props
- `src/features/journey/JourneyKPICards.tsx` — replace hardcoded with props
- `src/features/journey/JourneyMetricsChart.tsx` — replace hardcoded with props
- `src/features/journey/JourneyProductTable.tsx` — replace hardcoded with props
- `src/features/journey/JourneyAIPanel.tsx` — replace hardcoded with props
- `src/features/journey/JourneyAlertBanner.tsx` — driven by real alerts
- `src/features/journey/JourneyFilters.tsx` — wire "Analizează acum" button to API
- `src/app/(dashboard)/journey/page.tsx` — fetch real data, pass as props
- **azora-shop** `assets/azora.js` — add tracking events (separate repo)

---

## Phase 1 — Data Collection

### Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add 5 models to schema.prisma**

```prisma
model TrackingEvent {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sessionId      String
  adSource       String?
  event          String
  productId      String?
  data           Json
  createdAt      DateTime     @default(now())

  @@index([organizationId, event, createdAt])
  @@index([sessionId])
  @@index([organizationId, createdAt])
}

model JourneySession {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sessionId      String       @unique
  adSource       String?
  campaignId     String?
  productId      String?

  reachedProductView    DateTime?
  reachedScrollToForm   DateTime?
  reachedFormStart      DateTime?
  reachedFormSubmit     DateTime?
  reachedOrderConfirmed DateTime?

  orderId        String?
  paymentMethod  String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([organizationId, createdAt])
  @@index([campaignId])
  @@index([productId])
}

model JourneySnapshot {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  date           DateTime
  periodDays     Int

  totalImpressions      Int   @default(0)
  totalAdClicks         Int   @default(0)
  totalProductViews     Int   @default(0)
  totalScrollToForm     Int   @default(0)
  totalFormStarts       Int   @default(0)
  totalFormSubmits      Int   @default(0)
  totalOrders           Int   @default(0)

  ctrAd                 Float @default(0)
  rateVisitToScroll     Float @default(0)
  rateScrollToStart     Float @default(0)
  rateStartToSubmit     Float @default(0)
  rateSubmitToOrder     Float @default(0)
  overallConversion     Float @default(0)

  totalReturns          Int   @default(0)
  totalUndelivered      Int   @default(0)
  returnRate            Float @default(0)
  undeliveredRate       Float @default(0)

  productBreakdown      Json
  campaignBreakdown     Json

  createdAt      DateTime     @default(now())

  @@unique([organizationId, date, periodDays])
  @@index([organizationId, date])
}

model JourneyAIReport {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  snapshotId     String

  problems       Json
  suggestions    Json
  quickWins      Json

  generatedAt    DateTime     @default(now())
  modelUsed      String       @default("claude-sonnet-4-6")

  @@index([organizationId, generatedAt])
}

model JourneyAlert {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  type           JourneyAlertType
  severity       String
  metric         String
  currentValue   Float
  baselineValue  Float
  deltaPercent   Float

  resolvedAt     DateTime?
  createdAt      DateTime     @default(now())

  @@index([organizationId, resolvedAt, createdAt])
}

enum JourneyAlertType {
  FORM_ABANDON_SPIKE
  LOW_SCROLL_RATE
  AD_CLICK_DROP
  CONVERSION_DROP
}
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
# Enter migration name: add_journey_models
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add journey tracking models to schema"
```

---

### Task 2: `/api/tracking/event` POST (Public)

**Files:**
- Create: `src/app/api/tracking/event/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/tracking/event/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const schema = z.object({
  event: z.string().min(1).max(64),
  session_id: z.string().min(1).max(128),
  ad_source: z.string().max(128).optional(),
  organization_id: z.string().min(1),
  timestamp: z.number(),
  data: z.record(z.unknown()),
})

const FORM_SUBMIT_EVENTS = new Set(['form_submit_cod', 'card_payment_click'])
const FUNNEL_FIELD_MAP: Record<string, string> = {
  product_view: 'reachedProductView',
  scroll_to_form: 'reachedScrollToForm',
  form_interaction_start: 'reachedFormStart',
  form_submit_cod: 'reachedFormSubmit',
  card_payment_click: 'reachedFormSubmit',
  order_confirmed: 'reachedOrderConfirmed',
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const { event, session_id, ad_source, organization_id, data } = parsed.data

  // Verify org exists (prevents spam)
  const org = await db.organization.findUnique({ where: { id: organization_id }, select: { id: true } })
  if (!org) return NextResponse.json({ ok: true }) // silent reject

  await db.$transaction([
    db.trackingEvent.create({
      data: {
        organizationId: organization_id,
        sessionId: session_id,
        adSource: ad_source,
        event,
        productId: typeof data.product_id === 'string' ? data.product_id : null,
        data,
      },
    }),
    db.journeySession.upsert({
      where: { sessionId: session_id },
      create: {
        organizationId: organization_id,
        sessionId: session_id,
        adSource: ad_source,
        productId: typeof data.product_id === 'string' ? data.product_id : null,
        ...(FUNNEL_FIELD_MAP[event] ? { [FUNNEL_FIELD_MAP[event]]: new Date() } : {}),
        ...(event === 'order_confirmed' ? {
          orderId: typeof data.order_id === 'string' ? data.order_id : null,
          paymentMethod: typeof data.payment_method === 'string' ? data.payment_method : null,
        } : {}),
      },
      update: {
        ...(FUNNEL_FIELD_MAP[event] ? { [FUNNEL_FIELD_MAP[event]]: new Date() } : {}),
        ...(event === 'order_confirmed' ? {
          orderId: typeof data.order_id === 'string' ? data.order_id : null,
          paymentMethod: typeof data.payment_method === 'string' ? data.payment_method : null,
          reachedOrderConfirmed: new Date(),
        } : {}),
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Test manually**

```bash
curl -X POST http://localhost:3000/api/tracking/event \
  -H "Content-Type: application/json" \
  -d '{"event":"product_view","session_id":"test-123","organization_id":"<your-org-id>","timestamp":1234567890,"data":{"product_id":"prod-1"}}'
# Expected: {"ok":true}
# Check Prisma Studio: TrackingEvent row + JourneySession row created
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tracking/
git commit -m "feat: add /api/tracking/event public POST route"
```

---

### Task 3: azora.js Tracking Events

**Files:**
- Modify: `assets/azora.js` in azora-shop repo (Shopify theme)

> Note: This task is in the **azora-shop** repository, not azora-rise.

- [ ] **Step 1: Add tracking helper at top of azora.js**

```javascript
// === Rise Tracking ===
const RISE_ENDPOINT = 'https://rise.azora.ro/api/tracking/event'
const RISE_ORG_ID = 'YOUR_ORG_ID' // hardcode per store

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : undefined
}

function riseTrack(event, data = {}) {
  const payload = {
    event,
    session_id: getCookie('_fbp') || ('anon-' + Math.random().toString(36).slice(2)),
    ad_source: getCookie('_fbc'),
    organization_id: RISE_ORG_ID,
    timestamp: Date.now(),
    data,
  }
  fetch(RISE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}
```

- [ ] **Step 2: Add event fires**

```javascript
// page_view — on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  riseTrack('page_view', {
    url: window.location.href,
    referrer: document.referrer,
    product_id: window.ShopifyAnalytics?.meta?.product?.id,
  })
})

// product_view — on product pages
if (window.ShopifyAnalytics?.meta?.product) {
  const p = window.ShopifyAnalytics.meta.product
  riseTrack('product_view', {
    product_id: String(p.id),
    product_title: p.title,
    price: p.price,
    variant_id: p.selectedVariantId,
  })
}

// scroll_to_form — IntersectionObserver on EasySell form
const easysellForm = document.querySelector('#easysell-form, .easysell-form, form[data-easysell]')
if (easysellForm) {
  let scrollFired = false
  const scrollObs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !scrollFired) {
      scrollFired = true
      riseTrack('scroll_to_form', {
        product_id: window.ShopifyAnalytics?.meta?.product?.id,
        time_on_page_s: Math.round(performance.now() / 1000),
      })
    }
  }, { threshold: 0.3 })
  scrollObs.observe(easysellForm)

  // form_interaction_start — first focus on form field
  let formStartFired = false
  easysellForm.addEventListener('focusin', (e) => {
    if (!formStartFired && e.target.tagName === 'INPUT') {
      formStartFired = true
      riseTrack('form_interaction_start', {
        product_id: window.ShopifyAnalytics?.meta?.product?.id,
        field_name: e.target.name,
      })
    }
  })

  // form_progress — on each field blur
  let fieldsFilled = 0
  const totalFields = easysellForm.querySelectorAll('input[required], select[required]').length
  easysellForm.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.value.trim()) {
      fieldsFilled++
      riseTrack('form_progress', {
        product_id: window.ShopifyAnalytics?.meta?.product?.id,
        field_name: e.target.name,
        fields_filled_count: fieldsFilled,
        fields_total: totalFields,
      })
    }
  })

  // form_submit_cod — on submit
  easysellForm.addEventListener('submit', () => {
    riseTrack('form_submit_cod', {
      product_id: window.ShopifyAnalytics?.meta?.product?.id,
    })
  })

  // form_abandon — visibilitychange after start without submit
  let submitted = false
  easysellForm.addEventListener('submit', () => { submitted = true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && formStartFired && !submitted) {
      riseTrack('form_abandon', {
        product_id: window.ShopifyAnalytics?.meta?.product?.id,
        fields_filled_count: fieldsFilled,
      })
    }
  })
}

// order_confirmed — on /thank_you
if (window.location.pathname.includes('/thank_you') || window.location.pathname.includes('/orders/')) {
  const orderId = window.Shopify?.checkout?.order_id
  riseTrack('order_confirmed', {
    order_id: orderId,
    payment_method: window.Shopify?.checkout?.payment_type === 'reimbursement' ? 'cod' : 'card',
    price: window.Shopify?.checkout?.total_price,
  })
}
```

- [ ] **Step 3: Test in browser DevTools**

Open product page → Network tab → filter `tracking/event`
Expected: POST requests firing for `page_view`, `product_view`, form events

- [ ] **Step 4: Commit in azora-shop repo**

```bash
git add assets/azora.js
git commit -m "feat: add Rise tracking events to azora.js"
```

---

## Phase 2 — Processing + AI

### Task 4: Knowledge Base + Snapshot Logic

**Files:**
- Create: `src/lib/journey/knowledge-base.ts`
- Create: `src/lib/journey/snapshot.ts`

- [ ] **Step 1: Create knowledge-base.ts**

```typescript
// src/lib/journey/knowledge-base.ts
export const RO_MARKET_KNOWLEDGE = `
BENCHMARKS CONVERSIE PIAȚA ROMÂNIEI (Surse: Gomag eCommerce Pulse 2026, GPeC, eCommerceNews.ro):

- Conversie globală ad→comandă: 1.2–2.5% (medie 1.8%)
- Abandon formular: 75–85% (medie 80%)
- COD dominanță: ~65% din comenzi sunt ramburs (plată la livrare)
- Conversie mobile vs desktop: mobile cu ~40% mai mică
- Impact câmpuri formular: >5 câmpuri cresc abandonul cu ~30%
- Timp mediu decizie pe produs: 45–90 secunde
- Rate neridicate COD: 15–25% pentru produse sub 100 RON, 8–15% pentru produse 100–300 RON
- CTR reclamă Meta tipic: 1.5–3.5% (fashion/lifestyle)
- Scroll-to-form rate benchmark: 30–50%

CONTEXT PIAȚĂ:
- Clienții români preferă ramburs (COD) din cauza neîncrederii în plăți online
- Reclamele TikTok aduc trafic mai tânăr dar conversie mai mică față de Meta
- Abandonul la câmpul județ/localitate este frecvent din cauza validărilor greșite
- Ofertele cu urgență (stoc limitat, reduceri timp limitat) cresc conversia cu 15–30%
- Recenziile și dovada socială reduc abandonul formularului cu 10–20%
`.trim()
```

- [ ] **Step 2: Create snapshot.ts**

```typescript
// src/lib/journey/snapshot.ts
import { db } from '@/lib/db'

export async function computeJourneySnapshot(organizationId: string, periodDays: 7 | 30 | 90) {
  const since = new Date()
  since.setDate(since.getDate() - periodDays)

  // Count funnel steps from JourneySession
  const [productViews, scrolls, formStarts, formSubmits, orders] = await Promise.all([
    db.journeySession.count({ where: { organizationId, reachedProductView: { gte: since } } }),
    db.journeySession.count({ where: { organizationId, reachedScrollToForm: { gte: since } } }),
    db.journeySession.count({ where: { organizationId, reachedFormStart: { gte: since } } }),
    db.journeySession.count({ where: { organizationId, reachedFormSubmit: { gte: since } } }),
    db.journeySession.count({ where: { organizationId, reachedOrderConfirmed: { gte: since } } }),
  ])

  // Get Meta ad data from existing CampaignMetrics
  const campaignMetrics = await db.campaignMetrics.findMany({
    where: { organizationId, date: { gte: since } },
    select: { impressions: true, clicks: true, purchases: true, campaignId: true },
  })

  const totalImpressions = campaignMetrics.reduce((s, m) => s + (m.impressions ?? 0), 0)
  const totalAdClicks = campaignMetrics.reduce((s, m) => s + (m.clicks ?? 0), 0)

  // Per-product breakdown
  const productSessions = await db.journeySession.groupBy({
    by: ['productId'],
    where: { organizationId, reachedProductView: { gte: since }, productId: { not: null } },
    _count: { _all: true },
  })

  const productBreakdown = await Promise.all(
    productSessions.map(async (ps) => {
      const pid = ps.productId!
      const [scrollCount, startCount, submitCount, orderCount] = await Promise.all([
        db.journeySession.count({ where: { organizationId, productId: pid, reachedScrollToForm: { not: null } } }),
        db.journeySession.count({ where: { organizationId, productId: pid, reachedFormStart: { not: null } } }),
        db.journeySession.count({ where: { organizationId, productId: pid, reachedFormSubmit: { not: null } } }),
        db.journeySession.count({ where: { organizationId, productId: pid, reachedOrderConfirmed: { not: null } } }),
      ])
      const visits = ps._count._all
      return {
        productId: pid,
        visits,
        scrollRate: visits > 0 ? scrollCount / visits : 0,
        formStartRate: scrollCount > 0 ? startCount / scrollCount : 0,
        formSubmitRate: startCount > 0 ? submitCount / startCount : 0,
        orderRate: submitCount > 0 ? orderCount / submitCount : 0,
        abandonRate: startCount > 0 ? 1 - submitCount / startCount : 0,
      }
    })
  )

  const safe = (n: number, d: number) => (d > 0 ? n / d : 0)

  return db.journeySnapshot.upsert({
    where: { organizationId_date_periodDays: { organizationId, date: new Date(), periodDays } },
    create: {
      organizationId,
      date: new Date(),
      periodDays,
      totalImpressions,
      totalAdClicks,
      totalProductViews: productViews,
      totalScrollToForm: scrolls,
      totalFormStarts: formStarts,
      totalFormSubmits: formSubmits,
      totalOrders: orders,
      ctrAd: safe(totalAdClicks, totalImpressions),
      rateVisitToScroll: safe(scrolls, productViews),
      rateScrollToStart: safe(formStarts, scrolls),
      rateStartToSubmit: safe(formSubmits, formStarts),
      rateSubmitToOrder: safe(orders, formSubmits),
      overallConversion: safe(orders, totalAdClicks),
      productBreakdown,
      campaignBreakdown: [],
    },
    update: {
      totalImpressions, totalAdClicks, totalProductViews: productViews,
      totalScrollToForm: scrolls, totalFormStarts: formStarts,
      totalFormSubmits: formSubmits, totalOrders: orders,
      ctrAd: safe(totalAdClicks, totalImpressions),
      rateVisitToScroll: safe(scrolls, productViews),
      rateScrollToStart: safe(formStarts, scrolls),
      rateStartToSubmit: safe(formSubmits, formStarts),
      rateSubmitToOrder: safe(orders, formSubmits),
      overallConversion: safe(orders, totalAdClicks),
      productBreakdown,
      campaignBreakdown: [],
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/journey/
git commit -m "feat: add journey knowledge base and snapshot computation"
```

---

### Task 5: `/api/journey/snapshot` POST

**Files:**
- Create: `src/app/api/journey/snapshot/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/journey/snapshot/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { computeJourneySnapshot } from '@/lib/journey/snapshot'

export async function POST() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  await Promise.all([
    computeJourneySnapshot(orgId, 7),
    computeJourneySnapshot(orgId, 30),
    computeJourneySnapshot(orgId, 90),
  ])

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Test**

```bash
curl -X POST http://localhost:3000/api/journey/snapshot \
  -H "Cookie: <session-cookie>"
# Expected: {"ok":true}
# Check Prisma Studio: 3 JourneySnapshot rows created (periodDays 7, 30, 90)
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/journey/snapshot/
git commit -m "feat: add /api/journey/snapshot POST route"
```

---

### Task 6: AI Report — knowledge base + Claude

**Files:**
- Create: `src/lib/journey/ai-report.ts`
- Create: `src/app/api/journey/report/route.ts`

- [ ] **Step 1: Create ai-report.ts**

```typescript
// src/lib/journey/ai-report.ts
import Anthropic from '@anthropic-ai/sdk'
import { RO_MARKET_KNOWLEDGE } from './knowledge-base'
import type { JourneySnapshot } from '@prisma/client'

const client = new Anthropic()

const pct = (n: number) => (n * 100).toFixed(1) + '%'

export async function generateJourneyAIReport(snapshot: JourneySnapshot) {
  const prompt = `
CONTEXT PIAȚĂ ROMÂNIA:
${RO_MARKET_KNOWLEDGE}

DATELE MAGAZINULUI (ultimele ${snapshot.periodDays} zile):
Funnel:
  - Impresii reclamă: ${snapshot.totalImpressions}
  - Clickuri reclamă: ${snapshot.totalAdClicks} (CTR: ${pct(snapshot.ctrAd)})
  - Vizite produs: ${snapshot.totalProductViews}
  - Scroll la formular: ${snapshot.totalScrollToForm} (${pct(snapshot.rateVisitToScroll)})
  - Start completare formular: ${snapshot.totalFormStarts} (${pct(snapshot.rateScrollToStart)})
  - Submit formular: ${snapshot.totalFormSubmits} (${pct(snapshot.rateStartToSubmit)})
  - Comenzi confirmate: ${snapshot.totalOrders} (${pct(snapshot.rateSubmitToOrder)})
  - Conversie globală ad→comandă: ${pct(snapshot.overallConversion)}

Generează un raport JSON cu structura exactă:
{
  "problems": [{ "title": string, "severity": "critical"|"medium"|"low", "description": string, "metric": string, "benchmark": string }],
  "suggestions": [{ "problemRef": string, "action": string, "example": string, "expectedImpact": string }],
  "quickWins": [{ "action": string, "effort": "low"|"medium", "impact": "low"|"medium"|"high" }]
}

Maxim 3 probleme, 3 sugestii, 2 quick wins. Focusat pe piața RO. Limbă: română.
Răspunde DOAR cu JSON valid, fără text înainte sau după.
`.trim()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude did not return valid JSON')
  
  return JSON.parse(jsonMatch[0]) as {
    problems: { title: string; severity: string; description: string; metric: string; benchmark: string }[]
    suggestions: { problemRef: string; action: string; example: string; expectedImpact: string }[]
    quickWins: { action: string; effort: string; impact: string }[]
  }
}
```

- [ ] **Step 2: Create report route**

```typescript
// src/app/api/journey/report/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { generateJourneyAIReport } from '@/lib/journey/ai-report'

export async function POST() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  const snapshot = await db.journeySnapshot.findFirst({
    where: { organizationId: orgId, periodDays: 30 },
    orderBy: { createdAt: 'desc' },
  })

  if (!snapshot) {
    return NextResponse.json({ error: 'No snapshot found. Run /api/journey/snapshot first.' }, { status: 404 })
  }

  const report = await generateJourneyAIReport(snapshot)

  const saved = await db.journeyAIReport.create({
    data: {
      organizationId: orgId,
      snapshotId: snapshot.id,
      problems: report.problems,
      suggestions: report.suggestions,
      quickWins: report.quickWins,
    },
  })

  return NextResponse.json(saved)
}
```

- [ ] **Step 3: Test**

```bash
curl -X POST http://localhost:3000/api/journey/report \
  -H "Cookie: <session-cookie>"
# Expected: JourneyAIReport JSON with problems/suggestions/quickWins in Romanian
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/journey/ai-report.ts src/app/api/journey/report/
git commit -m "feat: add Claude AI report generation for journey analytics"
```

---

### Task 7: `/api/journey/data` GET

**Files:**
- Create: `src/app/api/journey/data/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/journey/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  const { searchParams } = new URL(req.url)
  const periodDays = Number(searchParams.get('days') ?? '30') as 7 | 30 | 90

  const [snapshot, aiReport, alerts] = await Promise.all([
    db.journeySnapshot.findFirst({
      where: { organizationId: orgId, periodDays },
      orderBy: { createdAt: 'desc' },
    }),
    db.journeyAIReport.findFirst({
      where: { organizationId: orgId },
      orderBy: { generatedAt: 'desc' },
    }),
    db.journeyAlert.findMany({
      where: { organizationId: orgId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return NextResponse.json({ snapshot, aiReport, alerts })
}
```

- [ ] **Step 2: Test**

```bash
curl "http://localhost:3000/api/journey/data?days=30" \
  -H "Cookie: <session-cookie>"
# Expected: { snapshot: {...}, aiReport: {...}, alerts: [] }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/journey/data/
git commit -m "feat: add /api/journey/data GET route"
```

---

### Task 8: Wire UI Components to Real Data

**Files:**
- Create: `src/features/journey/hooks/useJourneyData.ts`
- Modify: `src/app/(dashboard)/journey/page.tsx`
- Modify: `src/features/journey/JourneyFunnel.tsx`
- Modify: `src/features/journey/JourneyKPICards.tsx`
- Modify: `src/features/journey/JourneyAIPanel.tsx`
- Modify: `src/features/journey/JourneyFilters.tsx`

- [ ] **Step 1: Create React Query hook**

```typescript
// src/features/journey/hooks/useJourneyData.ts
'use client'
import { useApiQuery } from '@/lib/hooks/useApiQuery'

export function useJourneyData(days: 7 | 30 | 90 = 30) {
  return useApiQuery<{
    snapshot: import('@prisma/client').JourneySnapshot | null
    aiReport: import('@prisma/client').JourneyAIReport | null
    alerts: import('@prisma/client').JourneyAlert[]
  }>(`/api/journey/data?days=${days}`, ['journey', 'data', days])
}
```

- [ ] **Step 2: Update JourneyFunnel to accept props**

```typescript
// src/features/journey/JourneyFunnel.tsx
import type { JourneySnapshot } from '@prisma/client'

interface Props { snapshot: JourneySnapshot | null }

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export function JourneyFunnel({ snapshot }: Props) {
  const steps = snapshot ? [
    { label: 'IMPRESII', value: snapshot.totalImpressions, rate: null },
    { label: 'CLICKURI', value: snapshot.totalAdClicks, rate: pct(snapshot.ctrAd) },
    { label: 'VIZITE', value: snapshot.totalProductViews, rate: null },
    { label: 'FORMULAR', value: snapshot.totalScrollToForm, rate: pct(snapshot.rateVisitToScroll) },
    { label: 'SUBMIT', value: snapshot.totalFormSubmits, rate: pct(snapshot.rateStartToSubmit) },
    { label: 'COMENZI', value: snapshot.totalOrders, rate: pct(snapshot.rateSubmitToOrder) },
  ] : FALLBACK_STEPS // keep existing hardcoded as fallback for empty state

  // ... rest of existing JSX, replace hardcoded values with steps array
}
```

- [ ] **Step 3: Update JourneyAIPanel to accept props**

```typescript
// src/features/journey/JourneyAIPanel.tsx
import type { JourneyAIReport } from '@prisma/client'

interface Props {
  report: JourneyAIReport | null
  onRegenerate: () => void
  isLoading?: boolean
}

export function JourneyAIPanel({ report, onRegenerate, isLoading }: Props) {
  if (isLoading) return <AIReportSkeleton />
  if (!report) return <EmptyAIState onGenerate={onRegenerate} />
  
  const problems = report.problems as { title: string; severity: string; description: string; metric: string }[]
  const suggestions = report.suggestions as { action: string; example: string; expectedImpact: string }[]
  const quickWins = report.quickWins as { action: string; effort: string; impact: string }[]

  // ... rest of JSX uses these instead of hardcoded data
}
```

- [ ] **Step 4: Update JourneyFilters to call report API**

```typescript
// src/features/journey/JourneyFilters.tsx — add to existing component
import { useState } from 'react'

// Add to component:
const [isAnalyzing, setIsAnalyzing] = useState(false)

async function handleAnalyzeNow() {
  setIsAnalyzing(true)
  await fetch('/api/journey/snapshot', { method: 'POST' })
  await fetch('/api/journey/report', { method: 'POST' })
  setIsAnalyzing(false)
  // trigger React Query refetch via queryClient.invalidateQueries(['journey'])
}
```

- [ ] **Step 5: Update page.tsx to pass data**

```typescript
// src/app/(dashboard)/journey/page.tsx
// Change from server component fetching to client-driven:
// The page renders JourneyFilters (client component) which owns the period state
// Pass period down to other components, or make page a client component
// that uses useJourneyData hook and passes snapshot/aiReport as props
```

- [ ] **Step 6: Verify UI in browser**

Navigate to `/journey` → should show real data from database (or zeros if no tracking events yet).
Trigger "Analizează acum" → should compute snapshot then generate AI report.

- [ ] **Step 7: Commit**

```bash
git add src/features/journey/ src/app/(dashboard)/journey/
git commit -m "feat: wire journey UI to real API data"
```

---

## Phase 3 — Alerts + Cron

### Task 9: Alert Generation + `/api/journey/alerts`

**Files:**
- Create: `src/lib/journey/alerts.ts`
- Create: `src/app/api/journey/alerts/route.ts`

- [ ] **Step 1: Create alert logic**

```typescript
// src/lib/journey/alerts.ts
import { db } from '@/lib/db'
import { JourneyAlertType } from '@prisma/client'

const THRESHOLDS = {
  FORM_ABANDON_SPIKE: 0.20,   // >20% increase in abandon rate
  LOW_SCROLL_RATE: 0.20,      // scroll rate drops >20%
  CONVERSION_DROP: 0.20,      // conversion drops >20%
  AD_CLICK_DROP: 0.20,        // CTR drops >20%
}

export async function checkAndCreateAlerts(organizationId: string) {
  const [recent, baseline] = await Promise.all([
    db.journeySnapshot.findFirst({ where: { organizationId, periodDays: 7 }, orderBy: { createdAt: 'desc' } }),
    db.journeySnapshot.findFirst({
      where: { organizationId, periodDays: 7, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!recent || !baseline) return

  const checks: { type: JourneyAlertType; current: number; base: number; metric: string }[] = [
    { type: 'CONVERSION_DROP', current: recent.overallConversion, base: baseline.overallConversion, metric: 'overallConversion' },
    { type: 'LOW_SCROLL_RATE', current: recent.rateVisitToScroll, base: baseline.rateVisitToScroll, metric: 'rateVisitToScroll' },
    { type: 'AD_CLICK_DROP', current: recent.ctrAd, base: baseline.ctrAd, metric: 'ctrAd' },
  ]

  for (const { type, current, base, metric } of checks) {
    if (base === 0) continue
    const delta = (base - current) / base
    if (delta >= THRESHOLDS[type]) {
      await db.journeyAlert.create({
        data: {
          organizationId,
          type,
          severity: delta >= 0.35 ? 'critical' : 'warning',
          metric,
          currentValue: current,
          baselineValue: base,
          deltaPercent: delta,
        },
      })
    }
  }
}
```

- [ ] **Step 2: Create alerts GET route**

```typescript
// src/app/api/journey/alerts/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  const alerts = await db.journeyAlert.findMany({
    where: { organizationId: orgId, resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json(alerts)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/journey/alerts.ts src/app/api/journey/alerts/
git commit -m "feat: add journey alert detection and alerts API"
```

---

### Task 10: Daily Cron Job

**Files:**
- Create: `src/app/api/cron/journey/route.ts`

- [ ] **Step 1: Write cron route**

```typescript
// src/app/api/cron/journey/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeJourneySnapshot } from '@/lib/journey/snapshot'
import { generateJourneyAIReport } from '@/lib/journey/ai-report'
import { checkAndCreateAlerts } from '@/lib/journey/alerts'

// Secured by CRON_SECRET env var
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const orgs = await db.organization.findMany({ select: { id: true } })

  for (const org of orgs) {
    try {
      await computeJourneySnapshot(org.id, 7)
      await computeJourneySnapshot(org.id, 30)
      await computeJourneySnapshot(org.id, 90)

      const snapshot = await db.journeySnapshot.findFirst({
        where: { organizationId: org.id, periodDays: 30 },
        orderBy: { createdAt: 'desc' },
      })

      if (snapshot && snapshot.totalOrders > 0) {
        const report = await generateJourneyAIReport(snapshot)
        await db.journeyAIReport.create({
          data: {
            organizationId: org.id,
            snapshotId: snapshot.id,
            problems: report.problems,
            suggestions: report.suggestions,
            quickWins: report.quickWins,
          },
        })
      }

      await checkAndCreateAlerts(org.id)
    } catch (err) {
      console.error(`Journey cron failed for org ${org.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Add CRON_SECRET to .env**

```bash
# Add to .env.local:
CRON_SECRET=<generate-random-secret>
```

- [ ] **Step 3: Schedule in Dokploy**

In Dokploy cron configuration, add:
```
30 0 * * * curl -X POST https://rise.azora.ro/api/cron/journey -H "Authorization: Bearer $CRON_SECRET"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/
git commit -m "feat: add daily journey cron job"
```

---

## Verification End-to-End

- [ ] Open azora-shop product page → DevTools Network → see `POST /api/tracking/event` for `product_view`
- [ ] Fill and submit EasySell form → see `form_interaction_start`, `form_progress`, `form_submit_cod` events
- [ ] Check Prisma Studio → `TrackingEvent` rows present, `JourneySession` row with funnel timestamps
- [ ] `POST /api/journey/snapshot` → `JourneySnapshot` rows created with calculated rates
- [ ] `POST /api/journey/report` → `JourneyAIReport` with Romanian problems/suggestions
- [ ] Navigate to `/journey` → funnel shows real numbers, AI panel shows real report
- [ ] Click "Analizează acum" → triggers snapshot + report regeneration, UI updates
- [ ] Insert mock high-abandon data → verify `JourneyAlert` created with `FORM_ABANDON_SPIKE` type
