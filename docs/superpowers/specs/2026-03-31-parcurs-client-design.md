# Rise — Parcurs Client: Analiză Completă Conversie

**Data:** 2026-03-31
**Status:** Aprobat — ready for implementation planning
**Feature slug:** `journey`
**Poziție sidebar:** între CAMPANII și ANALIZĂ

---

## 1. Context & Motivație

Azora.ro rulează reclame Meta (și TikTok) care aduc trafic direct pe pagini de produs Shopify. Conversia finală se întâmplă prin formularul EasySell COD sau prin redirect la checkout Shopify (card). În prezent, Rise oferă date despre reclamele Meta (CTR, ROAS, spend) și despre comenzile finalizate din Shopify — dar **nu există vizibilitate asupra a ce se întâmplă între aceste două puncte**: câți vizitatori ajung la formular, câți îl încep, câți abandonează și de ce.

Această lipsă face imposibilă diagnosticarea corectă a problemelor de conversie: nu știi dacă problema e la reclamă, la pagina de produs, la formular sau la produs/preț în sine.

**Parcurs Client** rezolvă asta prin:
1. Instrumentarea completă a azora-shop (events custom în azora.js)
2. Agregarea datelor într-un funnel calculat în Rise
3. Analiză AI cu Claude, contextualizată pentru piața românească

**Outcome dorit:** Managerul magazinului vede constant unde se pierd clienții și primește sugestii acționabile pentru a îmbunătăți conversia, reduce abandonul formularului, și optimiza reclamele.

---

## 2. Arhitectură — 3 Straturi

```
[azora-shop / azora.js]
  ↓ POST /api/tracking/event (events cu session_id = fbp cookie)
[Rise Backend]
  ↓ TrackingEvent → JourneySession (upsert per sesiune)
  ↓ Cron zilnic → JourneySnapshot (funnel agregat)
  ↓ Trigger → JourneyAIReport (Claude analysis)
[Rise UI /journey]
  ↑ Funnel vizual + KPI cards + split view date/AI
```

### Identificarea sesiunii (Hybrid)

- **`session_id`** = `fbp` cookie (setat automat de Meta Pixel, deja prezent pe site)
- **`ad_source`** = `fbc` cookie (setat când vizitatorul vine dintr-o reclamă Meta)
- Date personale (telefon/email) sunt asociate sesiunii **doar la `order_confirmed`**, retrospectiv prin `order_id` Shopify
- Înainte de comandă: totul e anonim prin `session_id`

---

## 3. Stratul de Colectare — azora-shop

### Fișier modificat: `assets/azora.js`

Toate evenimentele sunt trimise **simultan** la:
1. Meta Pixel (standard events unde aplicabil)
2. Rise endpoint: `POST https://rise.azora.ro/api/tracking/event`

### Evenimente

| Event | Trigger | Data payload |
|---|---|---|
| `page_view` | Orice pagină încărcată | `fbp`, `fbc`, `url`, `referrer`, `product_id?` |
| `product_view` | Pagina de produs loaded | `product_id`, `product_title`, `price`, `variant_id` |
| `scroll_to_form` | EasySell form intră în viewport (IntersectionObserver) | `product_id`, `scroll_depth_pct`, `time_on_page_s` |
| `form_interaction_start` | Primul focus pe câmp formular | `product_id`, `field_name` |
| `form_progress` | La blur pe fiecare câmp completat | `product_id`, `field_name`, `fields_filled_count`, `fields_total` |
| `form_abandon` | `visibilitychange` / `beforeunload` după `form_interaction_start`, fără submit | `product_id`, `last_field_touched`, `fields_filled_count` |
| `form_submit_cod` | Submit EasySell form | `product_id`, `variant_id`, `price`, `quantity` |
| `form_submit_error` | EasySell returnează eroare | `product_id`, `error_type` |
| `card_payment_click` | Click "Plătește cu cardul" | `product_id`, `form_filled_pct` |
| `order_confirmed` | Pagina `/thank_you` sau `/orders/` Shopify | `order_id`, `product_id`, `payment_method`, `price`, `variant_id` |

### Payload standard trimis la Rise

```typescript
interface TrackingPayload {
  event: string;
  session_id: string;        // fbp cookie
  ad_source?: string;        // fbc cookie
  organization_id: string;   // hardcodat în theme (per magazin)
  timestamp: number;         // Date.now()
  data: Record<string, unknown>;
}
```

Endpoint-ul Rise este **fire-and-forget** din shop (nu se așteaptă response, erori ignorate silențios pentru a nu afecta UX).

---

## 4. Stratul de Procesare — Rise Backend

### Schema Prisma (adăugări noi)

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
  paymentMethod  String?      // "cod" | "card"
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
  periodDays     Int          // 7 | 30 | 90

  totalImpressions      Int   @default(0)   // din Meta API
  totalAdClicks         Int   @default(0)   // din Meta API
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

  // Date post-comandă (din Shopify orders)
  totalReturns          Int   @default(0)
  totalUndelivered      Int   @default(0)
  returnRate            Float @default(0)
  undeliveredRate       Float @default(0)

  productBreakdown      Json  // array per produs
  campaignBreakdown     Json  // array per campanie
  ga4Data               Json? // date GA4 (Faza 3)

  createdAt      DateTime     @default(now())

  @@unique([organizationId, date, periodDays])
  @@index([organizationId, date])
}

model JourneyAIReport {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  snapshotId     String

  problems       Json         // [{ title, severity: "critical|medium|low", description, metric, benchmark }]
  suggestions    Json         // [{ problemRef, action, example, expectedImpact }]
  quickWins      Json         // [{ action, effort: "low|medium", impact: "low|medium|high" }]

  generatedAt    DateTime     @default(now())
  modelUsed      String       @default("claude-sonnet-4-6")

  @@index([organizationId, generatedAt])
}

model JourneyAlert {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  type           JourneyAlertType
  severity       String           // "critical" | "warning"
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

### API Routes noi

| Route | Metodă | Scop |
|---|---|---|
| `/api/tracking/event` | POST | Primește events din azora-shop (public, no auth, rate limited) |
| `/api/journey/snapshot` | POST | Calculează JourneySnapshot (cron + manual) |
| `/api/journey/report` | POST | Generează JourneyAIReport cu Claude |
| `/api/journey/data` | GET | Date pentru UI (snapshot + raport curent) |
| `/api/journey/alerts` | GET | Alerte active |

### Job cron (zilnic 00:30)
1. Calculează `JourneySnapshot` pentru ziua precedentă (periodDays: 7, 30, 90)
2. Verifică pragurile de alertă → creează `JourneyAlert` dacă e cazul
3. Generează `JourneyAIReport` dacă există date noi

---

## 5. Stratul de Inteligență — Claude AI

### Knowledge Base (pre-integrată, actualizare trimestrială)

Fișier: `src/lib/journey/knowledge-base.ts`

Conținut:
- Benchmarks conversie piața RO: 1.2–2.5% overall, abandon formular 75–85%
- COD dominanță: ~65% din comenzile RO sunt ramburs
- Comportament mobil RO: conversie cu ~40% mai mică pe mobile față de desktop
- Câmpuri formular: >5 câmpuri cresc abandonul cu ~30%
- Timp mediu decizie pe produs: 45–90 secunde
- Surse: Gomag eCommerce Pulse 2026, GPeC, eCommerceNews.ro, MerchantPro, Netopia Payments

### Prompt Structure

```
CONTEXT PIAȚĂ ROMÂNIA:
[knowledge_base content]

DATELE MAGAZINULUI (ultimele {periodDays} zile):
Funnel:
  - Impresii reclamă: {totalImpressions}
  - Clickuri reclamă: {totalAdClicks} (CTR: {ctrAd}%)
  - Vizite produs: {totalProductViews}
  - Scroll la formular: {totalScrollToForm} ({rateVisitToScroll}%)
  - Start completare formular: {totalFormStarts} ({rateScrollToStart}%)
  - Submit formular: {totalFormSubmits} ({rateStartToSubmit}%)
  - Comenzi confirmate: {totalOrders} ({rateSubmitToOrder}%)
  - Conversie globală ad→comandă: {overallConversion}%

Top produse cu abandon mare: [productBreakdown sorted by abandon]
Top campanii cu CTR slab: [campaignBreakdown sorted by ctr]
Trend față de perioada precedentă: [delta per metrică]

Context produs (pentru analiza preț/produs):
  - Prețurile produselor: [product prices din Shopify]
  - Rate de return per produs: [returnRate din ProductCost]
  - Comenzi neridicate/refuzate: {totalUndelivered} ({undeliveredRate}%)
  - Retururi: {totalReturns} ({returnRate}%)

Generează un raport JSON cu structura:
{
  "problems": [{ "title", "severity", "description", "metric", "benchmark" }],
  "suggestions": [{ "problemRef", "action", "example", "expectedImpact" }],
  "quickWins": [{ "action", "effort", "impact" }]
}

Maxim 3 probleme, 3 sugestii, 2 quick wins. Focusat pe piața RO.
Exemple reale din magazine românești unde există. Limbă: română.
```

### Web Search pentru Knowledge Base

Mecanism: **Claude Tool Use cu `web_search`** (Anthropic native — același SDK deja integrat în Rise).

Claude primește tool-ul `web_search` activat și îl folosește automat când are nevoie de date recente specifice (ex: benchmarks actualizate, studii de caz noi). Knowledge base-ul static rămâne contextul principal; web search-ul intervine doar pentru completări punctuale.

Actualizare trimestrială a knowledge base-ului static: job manual declanșat de admin — rulează o sesiune Claude cu web search activ și regenerează `src/lib/journey/knowledge-base.ts`.

### Trigger-uri pentru generare raport
- Cron zilnic automat (dacă există date din ziua precedentă)
- Buton manual "Analizează acum" din UI
- Alertă automată (dacă delta >20% față de media 7 zile)

---

## 6. UI — Pagina `/journey`

**Locație sidebar:** secțiunea nouă `PARCURS CLIENT` între `CAMPANII` și `ANALIȚĂ`

### Layout (3 zone verticale)

**Zona 1 — Funnel Vizual (full width)**

6 carduri conectate cu săgeți:
```
[IMPRESII] → [CLICKURI] → [VIZITE] → [FORMULAR] → [SUBMIT] → [COMENZI]
  12,450        890          743         312          187         134
              CTR 7.1%     83.5%       42.0%        59.9%       71.6%
```
- Fiecare card: valoare absolută + rata față de etapa precedentă
- Culoare indicator: verde (peste benchmark RO), portocaliu (aproape), roșu (sub benchmark)
- Tooltip pe hover: benchmark-ul RO pentru acea etapă

**Zona 2 — Filtre + KPI Cards**

Filtre: selector perioadă (7/30/90 zile) + selector produs + selector campanie + buton "Analizează acum"

4 KPI Cards (rândul 1):
- Conversie globală (cu comparativ benchmark RO)
- Abandon formular % (cu trend față de perioada precedentă)
- Timp mediu până la submit
- Split COD vs Card %

2 KPI Cards (rândul 2 — post-comandă):
- Rată returnuri % (cu trend)
- Comenzi neridicate/refuzate % (specific COD piața RO)

**Zona 3 — Split View**

*Stânga (50%) — Date & Metrici:*
- Grafic linie: conversie zilnică ultimele N zile
- Tabel: breakdown per produs (vizite, rată scroll, rată submit, comenzi, abandon%)
- Tabel: breakdown per campanie (clickuri, CTR, vizite generate, conversie)

*Dreapta (50%) — Analiză AI:*
- Timestamp generare raport + buton Regenerează
- Lista probleme (🔴 Critică / 🟡 Medie / 🟢 Mică) cu descriere și metrică afectată
- Lista sugestii acționabile cu exemple reale din piața RO
- Secțiune "Ce testezi săptămâna aceasta" (quick wins)
- Loading state cu skeleton când raportul se generează

### Componente noi (`features/journey/`)

| Componentă | Scop |
|---|---|
| `JourneyFunnel.tsx` | Funnel vizual cu 6 carduri |
| `JourneyKPICards.tsx` | 4 carduri metrici cheie |
| `JourneyMetricsChart.tsx` | Grafic conversie în timp |
| `JourneyProductTable.tsx` | Tabel breakdown per produs |
| `JourneyCampaignTable.tsx` | Tabel breakdown per campanie |
| `JourneyAIPanel.tsx` | Panoul dreapta analiză Claude |
| `JourneyAlertBanner.tsx` | Banner alert probleme critice |
| `JourneyFilters.tsx` | Selector perioadă/produs/campanie |

Toate sub 150 linii. Hooks în `features/journey/hooks/`.

---

## 7. Google Analytics 4 — Integrare

GA4 servește ca **strat de validare** independent față de datele Rise (cross-check) și captează traficul organic/direct care nu vine din reclame Meta.

**Implementare:** Google Tag (gtag.js) adăugat în `layout/theme.liquid`, după Meta Pixel.

**Events GA4 mapate** (standard ecommerce schema):
- `view_item` → la `product_view`
- `begin_checkout` → la `form_interaction_start`
- `add_payment_info` → la `card_payment_click`
- `purchase` → la `order_confirmed`
- Custom event `form_progress` cu parametru `fields_filled`

**Date GA4 în Rise:** integrare via Google Analytics Data API (GA4) — nou endpoint `POST /api/integrations/google-analytics/connect` + sync periodic în `JourneySnapshot.ga4Data Json`.

---

## 8. Verificare End-to-End

### Faza 1 — Events azora-shop
```bash
# DevTools → Network pe pagina de produs
# Verifici POST-uri la /api/tracking/event pentru fiecare acțiune
# Verifici fbp/fbc cookies prezente în payload
```

### Faza 2 — Backend processing
```bash
npm run db:studio
# TrackingEvent: evenimente salvate cu organizationId corect
# JourneySession: upsert corect per sessionId
POST /api/journey/snapshot  # rulează manual
# JourneySnapshot: rate calculate corect
```

### Faza 3 — AI Report
```bash
POST /api/journey/report
# JourneyAIReport: problems/suggestions/quickWins populate
# UI JourneyAIPanel: afișează raportul corect
```

### Faza 4 — Alerte
```bash
# Insert mock data cu abandon spike în DB
# Verifici JourneyAlert creat cu tip FORM_ABANDON_SPIKE
# Verifici banner în header Rise + în /journey
```

### Criterii de acceptare
- [ ] Un vizitator real pe azora-shop generează sesiune completă în Rise
- [ ] Funnel-ul vizual reflectă date reale (ultimele 30 zile)
- [ ] Claude produce minim 2 probleme + sugestii în română
- [ ] Alerta se declanșează când rata scade >20%
- [ ] Buton "Analizează acum" forțează regenerare raport
- [ ] Filtrele per produs și campanie funcționează corect

---

## 9. Prompt Stitch — Design UI

Folosește promptul de mai jos în [Google Stitch](https://stitch.withgoogle.com/) pentru a genera mockup-uri vizuale care păstrează stilul platformei Rise:

```
Design a new dashboard tab called "Parcurs Client" (Customer Journey)
for an AI-powered e-commerce analytics platform called Rise.

EXISTING DESIGN SYSTEM to match:
- Color palette: Deep purple primary (#8d2de2), pink accent (#c026d3),
  white backgrounds, gray-50/100 for cards
- Typography: Clean sans-serif, Romanian language labels
- Components: shadcn/ui style — rounded cards (radius 8-12px),
  subtle shadows, gradient accents on primary actions
- Dark sidebar with white content area
- Overall aesthetic: Professional SaaS, not playful — similar to
  Linear, Vercel, or Stripe dashboards but with purple brand colors

PAGE LAYOUT (top to bottom):
1. PAGE HEADER: Title "Parcurs Client" + subtitle +
   period selector (7/30/90 days) + product filter dropdown +
   "Analizează acum" button (purple gradient)

2. ALERT BANNER (conditional): Red/orange banner when critical
   issue detected — "Rată abandon formular crescută cu 34% față de medie"

3. CONVERSION FUNNEL (full width):
   6 cards connected with arrows in a horizontal flow:
   IMPRESII → CLICKURI → VIZITE → FORMULAR → SUBMIT → COMENZI
   Each card shows: absolute number (large, bold) + conversion rate
   from previous step (smaller, colored).
   Color coding: green = above RO benchmark, orange = near benchmark,
   red = below benchmark. Include small benchmark tooltip indicator.

4. KPI CARDS: two rows of metric cards:
   ROW 1 (pre-order funnel):
   - "Conversie Globală" 1.5% with up arrow and "(RO: 1.2-2.5%)" benchmark
   - "Abandon Formular" 40.1% with trend indicator
   - "Timp Mediu Submit" 4m 32s
   - "COD vs Card" donut or split bar 68% / 32%
   ROW 2 (post-order quality):
   - "Rată Returnuri" 8.2% with trend indicator
   - "Comenzi Neridicate" 12.4% with trend indicator (important for COD market)

5. SPLIT VIEW (two columns, equal width):
   LEFT COLUMN "Date & Metrici":
   - Line chart showing daily conversion rate for selected period
   - Table: product breakdown with columns: Produs, Vizite, Scroll%,
     Start Form%, Submit%, Comenzi, Abandon%

   RIGHT COLUMN "Analiză AI" (styled as an AI assistant panel):
   - Header: "Analiză generată azi 06:30" + "Regenerează" ghost button
   - Problem cards with severity badges:
     🔴 CRITICĂ — card with red left border
     🟡 MEDIE — card with orange left border
     🟢 MICĂ — card with green left border
   Each problem card: bold title, description text, affected metric chip
   - Suggestions section below problems with actionable items
   - "Ce testezi săptămâna aceasta" section with 2 quick-win chips
   - Loading skeleton state variant

STYLE NOTES:
- Use purple gradients sparingly (only CTA buttons and active states)
- Cards should feel light and airy, not heavy
- The AI panel on the right should feel slightly different —
  maybe a very subtle purple-tinted background (#faf5ff) to
  indicate it's AI-generated content
- Romanian text labels throughout
- Show realistic mock data (not "Lorem ipsum")
```

---

## 10. Faze de Implementare

| Fază | Conținut | Valoare livrată |
|---|---|---|
| **Faza 1** | Events în azora-shop + `/api/tracking/event` + JourneySession/TrackingEvent schema + Funnel vizual în UI | Vizibilitate completă comportament pe site |
| **Faza 2** | JourneySnapshot (cron) + KPI cards + tabele breakdown + Knowledge base + Claude raport | Analiză AI funcțională |
| **Faza 3** | Alerte automate + GA4 integration + filtre avansate + actualizare knowledge base | Monitorizare proactivă completă |
