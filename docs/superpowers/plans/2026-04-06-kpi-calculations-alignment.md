# KPI Calculations Alignment — Blueprint Spreadsheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinierea calculelor din azora-rise cu formulele exacte din "Blueprint Supreme Ecom KPI Sheet" (Dec 2025), adăugând Marginal Ratio, CPP_BE, ROAS_BE, target KPIs și alertă 1/2 BE CPP, plus rezolvarea inconsistențelor existente.

**Architecture:** Toate calculele noi sunt adăugate în `lib/profitability-engine.ts` (sursa de adevăr), propagate în `OrganizationTaxConfig` și în paginile care consumă engine-ul. Alertele noi sunt adăugate în `features/meta/alerts.ts`. Schema Prisma primește `targetProfitMarginPct` pe `Organization` și `HALF_BE_CPP_NO_PURCHASE` în `AlertType`.

**Tech Stack:** Next.js 16, Prisma ORM (PostgreSQL), TypeScript

---

## Fișiere modificate

| Fișier | Schimbare |
|--------|-----------|
| `prisma/schema.prisma` | Adaugă `targetProfitMarginPct` în `Organization` + `HALF_BE_CPP_NO_PURCHASE` în `AlertType` |
| `lib/profitability-engine.ts` | Adaugă câmpuri noi în `ProductProfitabilityResult` + calcule noi |
| `lib/profitability.ts` | Fix: `returnsProvision` consistent cu engine; fix: `shopifyFee` pe `revenueNet` nu `price` |
| `features/meta/alerts.ts` | Adaugă `checkHalfBeCppAlert` |
| `app/(dashboard)/dashboard/page.tsx` | Fix: ROAS calculat cu `grossRevenue` (consistent cu Meta) |
| `app/(dashboard)/profitability/page.tsx` | Afișează `marginalRatio`, `cppBe`, `roasBe` în tabel |
| `app/(dashboard)/products/[id]/page.tsx` | Afișează `productMarginalRatio`, `cppBe` în tab profitabilitate |

---

## Task 1: Schema Prisma — câmpuri noi

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/` (auto-generat de Prisma)

- [ ] **Step 1: Adaugă `targetProfitMarginPct` în modelul `Organization`**

În `prisma/schema.prisma`, după linia `shippingCostDefault Float @default(20)`:

```prisma
targetProfitMarginPct  Float              @default(0.20)  // target profit 20% — folosit pentru CPP_target și ROAS_target
```

- [ ] **Step 2: Adaugă `HALF_BE_CPP_NO_PURCHASE` în enum `AlertType`**

În `prisma/schema.prisma`, la enum `AlertType` (după `HOOK_RATE_LOW`):

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
  HALF_BE_CPP_NO_PURCHASE
}
```

- [ ] **Step 3: Generează și aplică migrația**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npm run db:migrate -- --name kpi_calculations_alignment
```

Expected output: `The following migration(s) have been created and applied from new schema changes: migrations/TIMESTAMP_kpi_calculations_alignment`

---

## Task 2: `profitability-engine.ts` — câmpuri noi în interfețe și calcule

**Files:**
- Modify: `lib/profitability-engine.ts`

### Step 1: Extinde `OrganizationTaxConfig` cu `targetProfitMarginPct`

- [ ] Înlocuiește interfața `OrganizationTaxConfig` (liniile 13-18):

```typescript
export interface OrganizationTaxConfig {
  incomeTaxType: 'MICRO_1' | 'MICRO_3' | 'PROFIT_16'
  shopifyFeeRate: number        // ex: 0.02 = 2%
  eurToRon: number              // cursul de schimb aplicabil
  isVatPayer: boolean
  targetProfitMarginPct: number // ex: 0.20 = 20% profit target (default 0.20)
}
```

### Step 2: Extinde `ProductProfitabilityResult` cu câmpurile noi

- [ ] Adaugă câmpurile noi în `ProductProfitabilityResult` (după `netMarginPct: number`, linia ~64):

```typescript
  // Marginal Ratio (din Blueprint Spreadsheet)
  // Per produs: avgSellingPrice / cogs — criteriu validare ≥ 2.5
  productMarginalRatio: number | null
  // Per perioadă cu ads: grossRevenue / (totalCogs + adsSpendRon)
  marginalRatio: number | null

  // Break-Even KPIs (din Blueprint Spreadsheet — Sheet 3, L11/L12)
  // CPP_BE = avgPriceExVat × (1 - shopifyFeeRate) - cogs
  cppBe: number | null
  // ROAS_BE = avgSellingPrice / cppBe
  roasBe: number | null
  // 1/2 BE CPP — pragul de kill pentru campania de test (J6 = L11/2)
  halfBeCpp: number | null

  // Target KPIs cu profit margin (din Blueprint Spreadsheet — Sheet 3, U5-U9)
  // CPP_target = avgPriceExVat × (1 - shopifyFeeRate) - cogs - avgSellingPrice × targetProfitMarginPct
  cppTarget: number | null
  // ROAS_target = avgSellingPrice / cppTarget
  roasTarget: number | null
  // CPATC_target = cppTarget × (purchaseRate / atcRate) — folosind baseline-urile din RO_BENCHMARKS
  cpatcTarget: number | null
  // CPULC_target = cppTarget × purchaseRate
  cpulcTarget: number | null
  // CPIC_target = cppTarget × (purchaseRate / checkoutRate)
  cpicTarget: number | null
```

### Step 3: Calculează câmpurile noi în `calculateProductProfitability`

- [ ] Adaugă calculele noi după blocul de marje (după linia `const netMarginPct = ...`):

```typescript
  // ── Marginal Ratio ──────────────────────────────────────────────────────────
  // Per produs: prețul de vânzare / COGS (criteriu validare Blueprint: ≥ 2.5)
  const productMarginalRatio = cost.cogs > 0 ? avgSellingPrice / cost.cogs : null

  // Per perioadă cu ads: revenue brut / (COGS total + Ads spend)
  const marginalRatioDenominator = (sales.unitsSold * cost.cogs) + adsSpendRon
  const marginalRatio = marginalRatioDenominator > 0
    ? sales.grossRevenue / marginalRatioDenominator
    : null

  // ── Break-Even KPIs (Blueprint Sheet 3: L11, L12, J6) ───────────────────────
  // avgPriceExVat = prețul mediu fără TVA (baza pentru calcul CPP)
  const avgPriceExVat = tax.isVatPayer ? avgSellingPrice / (1 + cost.vatRate) : avgSellingPrice

  // CPP_BE = (AOV_exVat × (1 - shopifyFeeRate)) - COGS
  // Formula exactă din spreadsheet: (C5*(100-C6)/100 - C7) * D16
  const cppBeRaw = avgPriceExVat * (1 - tax.shopifyFeeRate) - cost.cogs
  const cppBe = cppBeRaw > 0 ? cppBeRaw : null

  // ROAS_BE = AOV / CPP_BE (folosim prețul brut pentru ROAS, ca în Meta)
  const roasBe = cppBe !== null && cppBe > 0 ? avgSellingPrice / cppBe : null

  // 1/2 BE CPP — spreadsheet J6 = L11/2
  const halfBeCpp = cppBe !== null ? cppBe / 2 : null

  // ── Target KPIs cu profit margin (Blueprint Sheet 3: U5-U9) ──────────────────
  // CPP_target = AOV_exVat × (1 - shopifyFeeRate) - COGS - AOV × profitTarget%
  // Formula exactă: (C5*(100-C6)/100 - C7 - C5*(C8/100)) * D16
  const cppTargetRaw = cppBe !== null
    ? cppBe - avgSellingPrice * tax.targetProfitMarginPct
    : null
  const cppTarget = cppTargetRaw !== null && cppTargetRaw > 0 ? cppTargetRaw : null

  // ROAS_target = AOV / CPP_target
  const roasTarget = cppTarget !== null && cppTarget > 0 ? avgSellingPrice / cppTarget : null

  // Funnel rates baseline (Blueprint: ATC 6%, Checkout 4.5%, Purchase 2.5%)
  // Folosim RO_BENCHMARKS.addToCartRate.ok și purchase rate implied
  const PURCHASE_RATE = 0.025  // 2.5% din Blueprint
  const ATC_RATE      = 0.06   // 6% din Blueprint
  const CHECKOUT_RATE = 0.045  // 4.5% din Blueprint

  // CPATC_target = CPP_target × (purchase% / ATC%) — Blueprint K6, U7
  const cpatcTarget = cppTarget !== null ? cppTarget * (PURCHASE_RATE / ATC_RATE) : null

  // CPULC_target = CPP_target × purchase% — Blueprint U8
  const cpulcTarget = cppTarget !== null ? cppTarget * PURCHASE_RATE : null

  // CPIC_target = CPP_target × (purchase% / checkout%) — Blueprint U9
  const cpicTarget = cppTarget !== null ? cppTarget * (PURCHASE_RATE / CHECKOUT_RATE) : null
```

### Step 4: Adaugă câmpurile noi în `return` statement

- [ ] În blocul `return { ... }` (după `maxSustainableAdsBudget`), adaugă:

```typescript
    productMarginalRatio,
    marginalRatio,
    cppBe,
    roasBe,
    halfBeCpp,
    cppTarget,
    roasTarget,
    cpatcTarget,
    cpulcTarget,
    cpicTarget,
```

---

## Task 3: Fix inconsistențe în `profitability.ts` (legacy per-unit)

**Files:**
- Modify: `lib/profitability.ts`

### Step 1: Fix `shopifyFee` — aplică pe `revenueNet` nu `price`

- [ ] Înlocuiește linia 68 (`shopifyFee = price * shopifyFeeRate`):

```typescript
  // Shopify aplică comisionul pe revenue-ul net (după TVA), nu pe prețul brut
  const shopifyFee = revenueNet * shopifyFeeRate
```

### Step 2: Fix `returnsProvision` — consistent cu `profitability-engine.ts`

`profitability.ts` linia 79 folosește `grossProfit × returnRate`, dar engine-ul folosește `returnsEstimate × cogs × 0.5`. Alinierea corectă: engine-ul e mai precis (provizionul e costul mărfii returnate, nu profitul).

- [ ] Înlocuiește blocul linii 78-80:

```typescript
  // Provizion retururi — 50% din COGS per unitate estimat returnată
  // (aliniată cu profitability-engine.ts: returnsEstimate × cogs × 0.5)
  const estimatedReturnedUnits = returnRate  // returnRate = fracție dintr-o unitate (per-unit calc)
  const returnsProvision = estimatedReturnedUnits * cost.cogs * 0.5
```

---

## Task 4: Fix ROAS în Dashboard — consistent cu Meta Ads Manager

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

Problema: Dashboard-ul calculează `avgRoas = grossRevenue / totalAdsSpend` (corect față de Meta), dar textul din cod și UI poate fi înșelător. Lasă calculul neschimbat (e corect), adaugă doar comentariu explicit.

- [ ] Găsește linia cu `avgRoas` în `dashboard/page.tsx` și adaugă comentariu:

```typescript
  // ROAS = revenue brut (cu TVA) / ads spend — aliniat cu Meta Ads Manager
  // Nu folosim netRevenue aici pentru că Meta raportează purchase value = prețul brut Shopify
  const avgRoas = totalAdsSpend > 0 ? grossRevenue / totalAdsSpend : null
```

---

## Task 5: Propagă `targetProfitMarginPct` în paginile care construiesc `taxConfig`

Orice pagină care construiește `OrganizationTaxConfig` trebuie să paseze noul câmp.

**Files:**
- Modify: `app/(dashboard)/profitability/page.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/api/products/[id]/profitability/route.ts` (dacă există)

- [ ] **Profitability page** — găsește blocul `taxConfig` (în jurul liniei 55) și adaugă câmpul:

```typescript
  const taxConfig = {
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shopifyFeeRate: org.shopifyFeeRate,
    eurToRon,
    isVatPayer: org.isVatPayer,
    targetProfitMarginPct: org.targetProfitMarginPct ?? 0.20,
  }
```

- [ ] **Dashboard page** — același bloc `taxConfig`, adaugă câmpul:

```typescript
  const taxConfig = {
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shopifyFeeRate: org.shopifyFeeRate,
    eurToRon,
    isVatPayer: org.isVatPayer,
    targetProfitMarginPct: org.targetProfitMarginPct ?? 0.20,
  }
```

- [ ] **API route profitability produs** — verifică `app/api/products/[id]/profitability/route.ts` și adaugă câmpul în `taxConfig` acolo.

---

## Task 6: Afișează câmpurile noi în `/profitability` page

**Files:**
- Modify: `app/(dashboard)/profitability/page.tsx`

- [ ] **În tabelul de produse**, adaugă coloana `Marginal Ratio` după coloana `Marjă netă`:

Găsește header-ul tabelului și adaugă:
```tsx
<th>Marginal Ratio</th>
```

În rândul de date:
```tsx
<td>
  {result.productMarginalRatio !== null ? (
    <span className={result.productMarginalRatio >= 2.5 ? 'text-green-600' : 'text-red-500'}>
      {result.productMarginalRatio.toFixed(1)}x
    </span>
  ) : '—'}
</td>
```

- [ ] **În sumar**, adaugă `Marginal Ratio agregat` (total revenue / total costuri+ads) în KPI cards:

```tsx
// Calculat în server component după agregarea rezultatelor:
const totalCostsAndAds = rows.reduce((s, r) => s + (r.result?.totalCogs ?? 0) + (r.result?.adsSpendRon ?? 0), 0)
const overallMarginalRatio = totalCostsAndAds > 0
  ? rows.reduce((s, r) => s + (r.result?.grossRevenue ?? 0), 0) / totalCostsAndAds
  : null
```

---

## Task 7: Afișează `cppBe` și `roasBe` în detaliu produs

**Files:**
- Modify: `app/(dashboard)/products/[id]/page.tsx` (tab profitabilitate)

- [ ] Găsește secțiunea de breakdown profitabilitate din product detail și adaugă o secțiune nouă "Break-Even KPIs":

```tsx
{result.cppBe !== null && (
  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
    <p className="text-xs font-medium text-amber-800 mb-2">Break-Even KPIs (Blueprint)</p>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <span className="text-[#78716C]">CPP Break-Even</span>
        <p className="font-medium">{result.cppBe.toFixed(2)} RON</p>
        <p className="text-[#A8A29E]">Cost max per comandă fără pierdere</p>
      </div>
      <div>
        <span className="text-[#78716C]">ROAS Break-Even</span>
        <p className="font-medium">{result.roasBe?.toFixed(2)}x</p>
        <p className="text-[#A8A29E]">ROAS minim pentru a nu pierde</p>
      </div>
      {result.cppTarget !== null && (
        <>
          <div>
            <span className="text-[#78716C]">CPP Target (20% profit)</span>
            <p className="font-medium text-green-700">{result.cppTarget.toFixed(2)} RON</p>
          </div>
          <div>
            <span className="text-[#78716C]">ROAS Target</span>
            <p className="font-medium text-green-700">{result.roasTarget?.toFixed(2)}x</p>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

---

## Task 8: Alertă `HALF_BE_CPP_NO_PURCHASE` în `alerts.ts`

**Files:**
- Modify: `features/meta/alerts.ts`

Alerta se declanșează când o campanie a cheltuit mai mult de `CPP_BE / 2` în ultimele 3 zile fără nicio achiziție. Necesită ca campania să fie linked la un produs (prin `MetaProductMapping`) pentru a calcula `CPP_BE`.

- [ ] **Adaugă `checkHalfBeCppAlert` în `alerts.ts`**

Mai întâi extinde query-ul principal `db.campaign.findMany` din `checkAlertsForOrganization` (linia ~61) să includă produsele linked:

```typescript
    include: {
      metrics: {
        orderBy: { date: 'desc' },
        take: 7,
        select: { spend: true, impressions: true, clicks: true, roas: true, cpm: true, ctr: true, purchases: true, frequency: true, landingPageViews: true, addToCart: true, videoPlays: true, videoP25: true },
      },
      metaMappings: {
        include: {
          product: {
            include: { cost: true },
            select: { price: true, cost: true },
          },
        },
        take: 1,
      },
    },
```

Și extinde `CampaignWithMetrics` type:

```typescript
type CampaignWithMetrics = Awaited<ReturnType<typeof db.campaign.findFirst>> & {
  metrics: Array<{ spend: number; impressions: number; clicks: number; roas: number | null; cpm: number | null; ctr: number | null; purchases: number; frequency: number | null; landingPageViews: number | null; addToCart: number | null; videoPlays: number | null; videoP25: number | null }>
  metaMappings: Array<{ product: { price: number; cost: { cogs: number } | null } | null }>
}
```

- [ ] Adaugă funcția `checkHalfBeCppAlert`:

```typescript
async function checkHalfBeCppAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  // Calculăm CPP_BE doar dacă avem un produs linked cu cost configurat
  const linkedProduct = campaign.metaMappings?.[0]?.product
  if (!linkedProduct?.cost) return

  const avgPrice = linkedProduct.price
  const cogs = linkedProduct.cost.cogs
  // Formula Blueprint Sheet 3, L11 (simplificat, fără TVA pentru alert rapid)
  const cppBe = avgPrice * 0.98 - cogs  // 0.98 = 1 - shopifyFeeRate default 2%
  if (cppBe <= 0) return

  const halfBeCpp = cppBe / 2

  // Spend total ultimele 3 zile
  const last3Days = campaign.metrics.slice(0, 3)
  const totalSpend = last3Days.reduce((sum, m) => sum + m.spend, 0)
  const totalPurchases = last3Days.reduce((sum, m) => sum + m.purchases, 0)

  if (totalSpend < halfBeCpp || totalPurchases > 0) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.HALF_BE_CPP_NO_PURCHASE, {
    spend: totalSpend,
    halfBeCpp,
    cppBe,
    message: `Cheltuit ${totalSpend.toFixed(0)} RON (peste 1/2 CPP_BE = ${halfBeCpp.toFixed(0)} RON) fără nicio comandă — evaluează oprirea campaniei`,
  })
}
```

- [ ] Adaugă apelul în `checkAlertsForOrganization` (după `checkHookRateAlert`):

```typescript
    await checkHalfBeCppAlert(campaign as CampaignWithMetrics, organizationId)
```

---

## Task 9: Verificare TypeScript și build

- [ ] **Rulează type check:**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npx tsc --noEmit 2>&1 | head -50
```

Expected: zero erori TypeScript. Dacă există erori, rezolvă-le înainte de a continua.

- [ ] **Rulează lint:**

```bash
npm run lint 2>&1 | head -30
```

Expected: zero erori lint.

- [ ] **Commit:**

```bash
git add prisma/schema.prisma lib/profitability-engine.ts lib/profitability.ts features/meta/alerts.ts app/\(dashboard\)/profitability/page.tsx app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add Blueprint KPI calculations (Marginal Ratio, CPP_BE, ROAS_BE, target KPIs, half-BE alert)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Marginal Ratio per produs (`productMarginalRatio = price / cogs`) — Task 2
- ✅ Marginal Ratio agregat (`grossRevenue / (cogs + ads)`) — Task 2
- ✅ CPP_BE calculat din formula exactă din spreadsheet — Task 2
- ✅ ROAS_BE calculat — Task 2
- ✅ 1/2 BE CPP — Task 2 (valoare) + Task 8 (alertă)
- ✅ CPP_target, ROAS_target, CPATC_target, CPULC_target, CPIC_target — Task 2
- ✅ `targetProfitMarginPct` configurabil în org — Task 1
- ✅ Fix `shopifyFee` base în `profitability.ts` — Task 3
- ✅ Fix `returnsProvision` consistent — Task 3
- ✅ Fix ROAS dashboard comentariu — Task 4
- ✅ Afișare în `/profitability` — Task 6
- ✅ Afișare în product detail — Task 7
- ❌ Daily breakdown în `/profitability` — exclus din acest plan (scope separat)
- ❌ `targetProfitMarginPct` editabil în Settings UI — exclus (Settings UI e scope separat)

**Note implementare:**
- Funcția `checkHalfBeCppAlert` din Task 8 folosește `shopifyFeeRate` hardcodat la 2% pentru simplitate în context alertă. Dacă vrei precizie maximă, pasează `org.shopifyFeeRate` prin `AlertConfig`.
- CPULC/CPATC/CPIC target folosesc funnel rates baseline din Blueprint (2.5%/6%/4.5%). Acestea sunt constante, nu configurabile per org — OK pentru faza 1.
