# Campaign Intelligence — Faza 1: Data Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corectează datele de campanie — fix bug sync, extinde schema cu metrici lipsă (reach, frequency, funnel, video), aliniază attribution window cu Meta Ads Manager, adaugă alerte noi.

**Architecture:** Modificări în 4 straturi: schema Prisma (câmpuri noi) → client Meta API (fields extinse) → campaigns-sync.ts (parsare + stocare) → alerts.ts (reguli noi). Nicio componentă UI nouă în Faza 1 — doar fix query în campaigns page.

**Tech Stack:** Prisma ORM, Meta Marketing API v21.0, Next.js 16 App Router, TypeScript

---

## File Map

| Fișier | Acțiune | Ce face |
|--------|---------|---------|
| `prisma/schema.prisma` | Modify | Adaugă 10 câmpuri în CampaignMetrics + AdSetMetrics + AdMetrics; adaugă 4 valori în enum AlertType |
| `features/meta/client.ts` | Modify | Extinde MetaInsights interface; adaugă fields noi în fetchCampaignInsights; adaugă funcții parse |
| `features/meta/campaigns-sync.ts` | Modify | Stochează câmpurile noi; adaugă syncAdSetMetrics() |
| `features/meta/alerts.ts` | Modify | Adaugă checkFrequencyAlert, checkLandingPageAlert, checkNoAddToCartAlert, checkHookRateAlert |
| `app/api/meta/sync/route.ts` | Modify | Fix: today → yesterday ca end date |
| `app/(dashboard)/campaigns/page.tsx` | Modify | Fix: exclude ziua curentă din suma spend afișată |
| `app/api/meta/campaigns/route.ts` | Modify | Fix: exclude ziua curentă din suma spend |

---

### Task 1: Fix Bug Sync — today → yesterday

**Files:**
- Modify: `app/api/meta/sync/route.ts`

- [ ] **Step 1: Deschide fișierul și localizează bug-ul**

```bash
cat app/api/meta/sync/route.ts
```

Linia cu problema:
```typescript
const today = new Date().toISOString().split("T")[0]
// ...
const metricsResult = await syncDailyMetrics(organizationId, thirtyDaysAgo, today)
```

- [ ] **Step 2: Aplică fix-ul**

În `app/api/meta/sync/route.ts`, înlocuiește:

```typescript
// ÎNAINTE
const today = new Date().toISOString().split("T")[0]
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
const metricsResult = await syncDailyMetrics(organizationId, thirtyDaysAgo, today)
```

Cu:

```typescript
// DUPĂ — exclude ziua curentă (date parțiale intraday)
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
const metricsResult = await syncDailyMetrics(organizationId, thirtyDaysAgo, yesterday)
```

- [ ] **Step 3: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: niciun error TypeScript

- [ ] **Step 4: Commit**

```bash
git add app/api/meta/sync/route.ts
git commit -m "fix: exclude current day from manual sync to prevent partial intraday data"
```

---

### Task 2: Fix Queries Campaigns Page — exclude ziua curentă

**Files:**
- Modify: `app/(dashboard)/campaigns/page.tsx` (linia ~22)
- Modify: `app/api/meta/campaigns/route.ts`

- [ ] **Step 1: Fix campaigns page**

În `app/(dashboard)/campaigns/page.tsx`, găsește blocul:

```typescript
metrics: { orderBy: { date: 'desc' }, take: 30 },
```

Înlocuiește cu:

```typescript
metrics: {
  where: { date: { lte: new Date(Date.now() - 86400000) } },
  orderBy: { date: 'desc' },
  take: 30,
},
```

- [ ] **Step 2: Fix campaign detail page**

În `app/(dashboard)/campaigns/[id]/page.tsx`, găsește același pattern `metrics: { orderBy: { date: 'desc' }, take: 30 }` și aplică același fix:

```typescript
metrics: {
  where: { date: { lte: new Date(Date.now() - 86400000) } },
  orderBy: { date: 'desc' },
  take: 30,
},
```

- [ ] **Step 3: Fix API route campaigns**

Deschide `app/api/meta/campaigns/route.ts` și aplică același fix pentru orice query care include `metrics`.

- [ ] **Step 4: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/campaigns/page.tsx app/(dashboard)/campaigns/\[id\]/page.tsx app/api/meta/campaigns/route.ts
git commit -m "fix: exclude today from campaign spend totals to match Meta Ads Manager"
```

---

### Task 3: Schema Prisma — Câmpuri Noi în Metrics + AlertType

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adaugă câmpuri noi în CampaignMetrics**

În `prisma/schema.prisma`, găsește modelul `CampaignMetrics` și adaugă după câmpul `ctr Float?`:

```prisma
  // Audience
  reach             Int?    // Utilizatori unici care au văzut reclama
  frequency         Float?  // impressions / reach — indicator ad fatigue

  // Revenue
  purchaseValue     Float?  // Valoarea RON a achizițiilor

  // Funnel
  landingPageViews  Int?    // Vizite efective pe site
  addToCart         Int?    // Adăugări în coș
  initiateCheckout  Int?    // Inițieri checkout

  // Video
  videoPlays            Int?
  videoP25              Int?    // Hook rate indicator (p25/plays)
  videoP50              Int?
  videoP75              Int?
  videoP95              Int?
  videoAvgWatchTimeSec  Float?
  videoThruPlays        Int?
```

- [ ] **Step 2: Adaugă aceleași câmpuri în AdSetMetrics**

Găsește modelul `AdSetMetrics` și adaugă după `ctr Float?` aceleași câmpuri ca mai sus (reach, frequency, purchaseValue, landingPageViews, addToCart, initiateCheckout, video*).

- [ ] **Step 3: Adaugă aceleași câmpuri în AdMetrics**

Găsește modelul `AdMetrics` și adaugă după `ctr Float?` aceleași câmpuri.

- [ ] **Step 4: Extinde enum AlertType cu valori noi**

Găsește:
```prisma
enum AlertType {
  ROAS_LOW
  SPEND_EXCEEDED
  CTR_LOW
  CPM_HIGH
  AUTO_PAUSED
  LEARNING_PHASE
  BUDGET_ENDING
}
```

Înlocuiește cu:
```prisma
enum AlertType {
  ROAS_LOW
  SPEND_EXCEEDED
  CTR_LOW
  CPM_HIGH
  AUTO_PAUSED
  LEARNING_PHASE
  BUDGET_ENDING
  FREQUENCY_HIGH
  LANDING_PAGE_DROP
  NO_ADD_TO_CART
  HOOK_RATE_LOW
}
```

- [ ] **Step 5: Rulează migrația**

```bash
npm run db:migrate
```

Când cere numele migrației, scrie: `add_extended_metrics_and_alert_types`

Expected output:
```
✔ Your database is now in sync with your schema.
```

- [ ] **Step 6: Verificare Prisma generate**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add reach, frequency, funnel and video metrics fields to CampaignMetrics schema"
```

---

### Task 4: Meta API Client — Fields Extinse + Parse Functions

**Files:**
- Modify: `features/meta/client.ts`

- [ ] **Step 1: Extinde interface MetaInsights**

În `features/meta/client.ts`, găsește `export interface MetaInsights` și adaugă câmpuri noi după `action_values`:

```typescript
export interface MetaInsights {
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  clicks: string
  cpm?: string
  ctr?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
  // Câmpuri noi
  reach?: string
  frequency?: string
  landing_page_views?: string
  video_avg_time_watched_actions?: Array<{ action_type: string; value: string }>
  video_p25_watched_actions?: Array<{ action_type: string; value: string }>
  video_p50_watched_actions?: Array<{ action_type: string; value: string }>
  video_p75_watched_actions?: Array<{ action_type: string; value: string }>
  video_p95_watched_actions?: Array<{ action_type: string; value: string }>
  video_play_actions?: Array<{ action_type: string; value: string }>
  video_thruplay_watched_actions?: Array<{ action_type: string; value: string }>
}
```

- [ ] **Step 2: Adaugă funcții parse pentru acțiuni funnel**

Adaugă după funcția `parsePurchaseValue` existentă:

```typescript
export function parseActionCount(insights: MetaInsights, actionType: string): number {
  const action = insights.actions?.find((a) => a.action_type === actionType)
  return action ? parseInt(action.value, 10) : 0
}

export function parseVideoMetric(
  field: Array<{ action_type: string; value: string }> | undefined
): number {
  if (!field || field.length === 0) return 0
  return parseInt(field[0].value, 10)
}

export function parseVideoAvgWatchTime(insights: MetaInsights): number {
  const field = insights.video_avg_time_watched_actions
  if (!field || field.length === 0) return 0
  return parseFloat(field[0].value)
}
```

- [ ] **Step 3: Actualizează fetchCampaignInsights cu fields noi**

Găsește funcția `fetchCampaignInsights` și înlocuiește array-ul `fields`:

```typescript
export async function fetchCampaignInsights(
  accessToken: string,
  adAccountId: string,
  dateFrom: string,
  dateTo: string,
  level: "campaign" | "adset" | "ad" = "campaign"
): Promise<MetaInsights[]> {
  const fields = [
    "campaign_id",
    "adset_id",
    "ad_id",
    "date_start",
    "date_stop",
    "spend",
    "impressions",
    "clicks",
    "cpm",
    "ctr",
    "actions",
    "action_values",
    // Câmpuri noi
    "reach",
    "frequency",
    "landing_page_views",
    "video_avg_time_watched_actions",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p95_watched_actions",
    "video_play_actions",
    "video_thruplay_watched_actions",
  ].join(",")

  const data = await metaFetch<{ data: MetaInsights[] }>(
    `${adAccountId}/insights`,
    accessToken,
    {
      fields,
      level,
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: "1",
      limit: "2000",
      use_account_attribution_setting: "true",
    }
  )

  return data.data
}
```

- [ ] **Step 4: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add features/meta/client.ts
git commit -m "feat: extend Meta API client with reach, frequency, funnel and video fields"
```

---

### Task 5: campaigns-sync.ts — Stochează Câmpuri Noi + AdSet Sync

**Files:**
- Modify: `features/meta/campaigns-sync.ts`

- [ ] **Step 1: Actualizează syncDailyMetrics să stocheze câmpurile noi**

În `features/meta/campaigns-sync.ts`, găsește funcția `syncDailyMetrics`. Localizează blocul unde se parsează metricile (în jurul liniei 163-190) și înlocuiește cu versiunea extinsă:

```typescript
    const spend = parseFloat(insight.spend || "0")
    const purchases = parsePurchases(insight)
    const purchaseValue = parsePurchaseValue(insight)
    const impressions = parseInt(insight.impressions || "0", 10)
    const clicks = parseInt(insight.clicks || "0", 10)
    const cpm = parseFloat(insight.cpm || "0")
    const ctr = parseFloat(insight.ctr || "0")
    const roas = spend > 0 ? purchaseValue / spend : null

    // Câmpuri noi
    const reach = insight.reach ? parseInt(insight.reach, 10) : null
    const frequency = insight.frequency ? parseFloat(insight.frequency) : null
    const landingPageViews = insight.landing_page_views
      ? parseInt(insight.landing_page_views, 10)
      : null
    const addToCart = parseActionCount(insight, "add_to_cart") || null
    const initiateCheckout = parseActionCount(insight, "initiate_checkout") || null
    const videoPlays = parseVideoMetric(insight.video_play_actions) || null
    const videoP25 = parseVideoMetric(insight.video_p25_watched_actions) || null
    const videoP50 = parseVideoMetric(insight.video_p50_watched_actions) || null
    const videoP75 = parseVideoMetric(insight.video_p75_watched_actions) || null
    const videoP95 = parseVideoMetric(insight.video_p95_watched_actions) || null
    const videoAvgWatchTimeSec = parseVideoAvgWatchTime(insight) || null
    const videoThruPlays = parseVideoMetric(insight.video_thruplay_watched_actions) || null
```

- [ ] **Step 2: Actualizează upsert CampaignMetrics să includă câmpurile noi**

Găsește `db.campaignMetrics.upsert` și extinde cu câmpurile noi:

```typescript
    await db.campaignMetrics.upsert({
      where: {
        campaignId_date: {
          campaignId: campaign.id,
          date: new Date(insightDate),
        },
      },
      create: {
        campaignId: campaign.id,
        date: new Date(insightDate),
        spend, impressions, clicks, purchases, roas, cpm, ctr,
        reach, frequency, purchaseValue, landingPageViews,
        addToCart, initiateCheckout,
        videoPlays, videoP25, videoP50, videoP75, videoP95,
        videoAvgWatchTimeSec, videoThruPlays,
      },
      update: {
        spend, impressions, clicks, purchases, roas, cpm, ctr,
        reach, frequency, purchaseValue, landingPageViews,
        addToCart, initiateCheckout,
        videoPlays, videoP25, videoP50, videoP75, videoP95,
        videoAvgWatchTimeSec, videoThruPlays,
      },
    })
```

- [ ] **Step 3: Asigură-te că importurile parse functions sunt corecte**

La topul fișierului `campaigns-sync.ts`, adaugă `parseActionCount` și `parseVideoMetric` la import:

```typescript
import {
  fetchCampaigns,
  fetchAdSets,
  fetchAds,
  fetchCampaignInsights,
  parseMetaBudget,
  parsePurchases,
  parsePurchaseValue,
  parseActionCount,
  parseVideoMetric,
  parseVideoAvgWatchTime,
} from "./client"
```

- [ ] **Step 4: Adaugă funcția syncAdSetMetrics**

Adaugă după funcția `syncDailyMetrics` existentă:

```typescript
export async function syncAdSetMetrics(
  organizationId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ metricsUpserted: number; error?: string }> {
  const resolvedFrom = dateFrom ?? getYesterday()
  const resolvedTo = dateTo ?? resolvedFrom

  const connection = await db.metaConnection.findUnique({
    where: { organizationId },
  })
  if (!connection) throw new Error("No Meta connection")

  const accessToken = decrypt(connection.accessTokenEncrypted)

  const insights = await fetchCampaignInsights(
    accessToken,
    connection.adAccountId,
    resolvedFrom,
    resolvedTo,
    "adset"
  )

  let metricsUpserted = 0

  for (const insight of insights) {
    if (!insight.adset_id) continue

    const adSet = await db.adSet.findFirst({
      where: { organizationId, metaAdSetId: insight.adset_id },
    })
    if (!adSet) continue

    const spend = parseFloat(insight.spend || "0")
    const purchases = parsePurchases(insight)
    const purchaseValue = parsePurchaseValue(insight)
    const impressions = parseInt(insight.impressions || "0", 10)
    const clicks = parseInt(insight.clicks || "0", 10)
    const cpm = parseFloat(insight.cpm || "0")
    const ctr = parseFloat(insight.ctr || "0")
    const roas = spend > 0 ? purchaseValue / spend : null
    const reach = insight.reach ? parseInt(insight.reach, 10) : null
    const frequency = insight.frequency ? parseFloat(insight.frequency) : null
    const landingPageViews = insight.landing_page_views
      ? parseInt(insight.landing_page_views, 10)
      : null
    const addToCart = parseActionCount(insight, "add_to_cart") || null
    const initiateCheckout = parseActionCount(insight, "initiate_checkout") || null
    const videoPlays = parseVideoMetric(insight.video_play_actions) || null
    const videoP25 = parseVideoMetric(insight.video_p25_watched_actions) || null
    const videoP50 = parseVideoMetric(insight.video_p50_watched_actions) || null
    const videoP75 = parseVideoMetric(insight.video_p75_watched_actions) || null
    const videoP95 = parseVideoMetric(insight.video_p95_watched_actions) || null
    const videoAvgWatchTimeSec = parseVideoAvgWatchTime(insight) || null
    const videoThruPlays = parseVideoMetric(insight.video_thruplay_watched_actions) || null

    await db.adSetMetrics.upsert({
      where: {
        adSetId_date: {
          adSetId: adSet.id,
          date: new Date(insight.date_start),
        },
      },
      create: {
        adSetId: adSet.id,
        date: new Date(insight.date_start),
        spend, impressions, clicks, purchases, roas, cpm, ctr,
        reach, frequency, purchaseValue, landingPageViews,
        addToCart, initiateCheckout,
        videoPlays, videoP25, videoP50, videoP75, videoP95,
        videoAvgWatchTimeSec, videoThruPlays,
      },
      update: {
        spend, impressions, clicks, purchases, roas, cpm, ctr,
        reach, frequency, purchaseValue, landingPageViews,
        addToCart, initiateCheckout,
        videoPlays, videoP25, videoP50, videoP75, videoP95,
        videoAvgWatchTimeSec, videoThruPlays,
      },
    })

    metricsUpserted++
  }

  return { metricsUpserted }
}
```

- [ ] **Step 5: Apelează syncAdSetMetrics din sync route**

În `app/api/meta/sync/route.ts`, adaugă importul și apelul:

```typescript
import { syncCampaignsFromMeta, syncDailyMetrics, syncAdSetMetrics } from "@/features/meta/campaigns-sync"

// ... în POST handler, după metricsResult:
const adSetMetricsResult = await syncAdSetMetrics(organizationId, thirtyDaysAgo, yesterday)

return NextResponse.json({
  success: true,
  ...campaignsResult,
  metricsUpserted: metricsResult.metricsUpserted,
  adSetMetricsUpserted: adSetMetricsResult.metricsUpserted,
  syncedAt: new Date().toISOString(),
})
```

- [ ] **Step 6: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add features/meta/campaigns-sync.ts app/api/meta/sync/route.ts
git commit -m "feat: store reach, frequency, funnel and video metrics; add adset-level sync"
```

---

### Task 6: Alerte Noi — Frequency, Landing Page, No Add-to-Cart, Hook Rate

**Files:**
- Modify: `features/meta/alerts.ts`

- [ ] **Step 1: Adaugă funcția checkFrequencyAlert**

În `features/meta/alerts.ts`, adaugă după funcția `checkCpmAlert` existentă:

```typescript
async function checkFrequencyAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const recentMetrics = campaign.metrics.filter((m) => m.frequency !== null && m.frequency !== undefined)
  if (recentMetrics.length < 3) return

  const highFreqDays = recentMetrics.filter((m) => (m.frequency ?? 0) > 3.5)
  if (highFreqDays.length >= 3) {
    const avgFrequency = highFreqDays.reduce((s, m) => s + (m.frequency ?? 0), 0) / highFreqDays.length
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.FREQUENCY_HIGH, {
      frequency: avgFrequency,
      threshold: 3.5,
      daysAbove: highFreqDays.length,
      message: `Audiență obosită — frecvența medie ${avgFrequency.toFixed(1)}x (peste 3.5x) în ultimele ${highFreqDays.length} zile. Schimbă creative-ul sau extinde audiența.`,
    })
  }
}
```

- [ ] **Step 2: Adaugă funcția checkLandingPageAlert**

```typescript
async function checkLandingPageAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  const today = campaign.metrics[0]
  if (!today || !today.landingPageViews || !today.clicks || today.clicks === 0) return

  const landingPageRate = today.landingPageViews / today.clicks
  if (landingPageRate < 0.5 && today.clicks > 100) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.LANDING_PAGE_DROP, {
      landingPageViews: today.landingPageViews,
      clicks: today.clicks,
      rate: landingPageRate,
      message: `Doar ${Math.round(landingPageRate * 100)}% din click-uri ajung pe site (${today.landingPageViews} din ${today.clicks}). Verifică URL-ul reclamei și viteza paginii.`,
    })
  }
}
```

- [ ] **Step 3: Adaugă funcția checkNoAddToCartAlert**

```typescript
async function checkNoAddToCartAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  const last3Days = campaign.metrics.slice(0, 3)
  if (last3Days.length < 2) return

  const totalSpend = last3Days.reduce((s, m) => s + m.spend, 0)
  const totalAddToCart = last3Days.reduce((s, m) => s + (m.addToCart ?? 0), 0)

  if (totalSpend > 200 && totalAddToCart === 0) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.NO_ADD_TO_CART, {
      spend: totalSpend,
      days: last3Days.length,
      message: `${totalSpend.toFixed(0)} RON cheltuiți fără nicio adăugare în coș. Problema e la landing page (preț, pagina produsului sau CTA).`,
    })
  }
}
```

- [ ] **Step 4: Adaugă funcția checkHookRateAlert**

```typescript
async function checkHookRateAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  const today = campaign.metrics[0]
  if (!today || !today.videoPlays || !today.videoP25 || today.videoPlays < 100) return

  const hookRate = today.videoP25 / today.videoPlays
  if (hookRate < 0.25) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.HOOK_RATE_LOW, {
      hookRate,
      videoPlays: today.videoPlays,
      videoP25: today.videoP25,
      message: `Hook slab — doar ${Math.round(hookRate * 100)}% din vizionatori trec de primele 25% ale video-ului. Testează un hook nou (pain point, curiozitate sau testimonial).`,
    })
  }
}
```

- [ ] **Step 5: Apelează alertele noi în checkAlertsForOrganization**

Găsește funcția `checkAlertsForOrganization` și adaugă apelurile noi:

```typescript
  for (const campaign of campaigns) {
    await checkRoasAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkSpendAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCtrAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCpmAlert(campaign as CampaignWithMetrics, config, organizationId)
    // Alerte noi
    await checkFrequencyAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkLandingPageAlert(campaign as CampaignWithMetrics, organizationId)
    await checkNoAddToCartAlert(campaign as CampaignWithMetrics, organizationId)
    await checkHookRateAlert(campaign as CampaignWithMetrics, organizationId)
  }
```

- [ ] **Step 6: Actualizează tipul CampaignWithMetrics să includă câmpurile noi**

Găsește definiția tipului `CampaignWithMetrics` și extinde metrics array:

```typescript
type CampaignWithMetrics = Awaited<
  ReturnType<typeof db.campaign.findFirst>
> & {
  metrics: Array<{
    spend: number
    impressions: number
    clicks: number
    roas: number | null
    cpm: number | null
    ctr: number | null
    purchases: number
    // Câmpuri noi
    frequency: number | null
    landingPageViews: number | null
    addToCart: number | null
    videoPlays: number | null
    videoP25: number | null
  }>
}
```

- [ ] **Step 7: Asigură-te că query-ul din checkAlertsForOrganization include câmpurile noi**

Găsește `db.campaign.findMany` în `checkAlertsForOrganization` și extinde `include.metrics`:

```typescript
  include: {
    metrics: {
      orderBy: { date: "desc" },
      take: 7,
      select: {
        spend: true,
        impressions: true,
        clicks: true,
        roas: true,
        cpm: true,
        ctr: true,
        purchases: true,
        frequency: true,
        landingPageViews: true,
        addToCart: true,
        videoPlays: true,
        videoP25: true,
      },
    },
  },
```

- [ ] **Step 8: Verificare build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add features/meta/alerts.ts
git commit -m "feat: add frequency, landing page drop, no-add-to-cart and hook rate alerts"
```

---

### Task 7: Verificare End-to-End

- [ ] **Step 1: Pornește dev server**

```bash
npm run dev
```

- [ ] **Step 2: Trigger sync manual**

Du-te la `http://localhost:3000/campaigns` și apasă butonul "Sync". Verifică în consolă (terminal) că nu există erori.

- [ ] **Step 3: Verificare DB — câmpuri noi salvate**

```bash
psql "postgresql://postgres:KrKyzkJeASXpTBfUdXIkABKjmYlqPvHv@hopper.proxy.rlwy.net:42003/railway" -c 'SELECT "campaignId", date, spend, reach, frequency, "purchaseValue", "addToCart", "videoP25", "videoPlays" FROM "CampaignMetrics" ORDER BY date DESC LIMIT 10;'
```

Expected: coloanele noi există, valorile pot fi NULL dacă Meta nu returnează date video pentru campaniile existente (normal).

- [ ] **Step 4: Verificare suma spend pe pagina campaigns**

Compară suma din Rise cu Meta Ads Manager (filtrat pe aceeași perioadă). Diferența pentru campaniile PAUSED ar trebui să fie 0.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: phase 1 data foundation complete - verify sync accuracy"
```
