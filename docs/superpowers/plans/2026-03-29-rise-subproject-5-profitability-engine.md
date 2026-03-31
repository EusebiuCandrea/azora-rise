# Rise — Sub-proiectul 5: Motorul de Profitabilitate Reală

**Data planului:** 2026-03-29
**Autor:** Product Manager / Business Intelligence
**Status:** Draft v1.0
**Depinde de:** Sub-proiect 3 (Shopify Sync), Sub-proiect 4 (Meta Ads Integration)

---

## 1. Overview și Obiective

### 1.1 Problema rezolvată

Un magazin Shopify tipic știe cât a vândut. Nu știe **cât a câștigat**. Diferența dintre revenue și profit net real poate fi 40–60% din cifra de afaceri, consumată de:

- COGS (costul mărfii)
- TVA plătit furnizorilor (nerecuperat dacă nu ești plătitor TVA)
- Transport + ambalare per colet
- Comision Shopify (2% implicit)
- Cheltuieli Meta Ads (adesea ignorate din calculul per-produs)
- Retururi (5–15% în beauty/wellness România)
- Impozit venit (microîntreprindere 1–3% sau profit 16%)
- Alte cheltuieli fixe: chirie, salarii, software

**Rise Sub-proiect 5** construiește motorul care calculează profitabilitatea reală, pe toate dimensiunile: per produs, per campanie, per lună, per magazin total.

### 1.2 Obiective măsurabile

| Obiectiv | Metric de succes |
|----------|-----------------|
| Profit net real calculat automat | Dashboard afișează profit net cu toate deducerile în < 2 s |
| Atribuire ads → produs | ≥ 80% din cheltuielile Meta asociate unui produs specific |
| Recomandări acționabile | ≥ 3 recomandări generate automat pe săptămână |
| Export date | CSV/Excel exportabil în < 5 s pentru orice perioadă |
| Break-even vizibil | Fiecare produs cu ≥ 5 vânzări afișează break-even volume |

### 1.3 Principii de design

1. **Single Source of Truth** — toate calculele pornesc din formula canonică definită în `lib/profitability-engine.ts`. Nu există calcule duplicat în API routes sau componente.
2. **Snapshots cached** — profitabilitatea per produs se calculează nocturn și se stochează în `ProductProfitabilitySnapshot`. Calculul live e costisitor și lent.
3. **Transparență totală** — fiecare cifră din dashboard are un tooltip care explică formula. Utilizatorul trebuie să înțeleagă de unde vine numărul.
4. **Configurabilitate** — cursul EUR/RON, rata de retur, impozitul — toate configurabile per organizație, nu hardcoded.
5. **Fail gracefully** — dacă lipsesc date (ex: nu există ProductCost pentru un produs), produsul apare cu avertisment, nu blochează restul calculelor.

---

## 2. Schema Prisma Nouă

### 2.1 MonthlyExpense — Cheltuieli manuale lunare

```prisma
model MonthlyExpense {
  id             String              @id @default(cuid())
  organizationId String
  organization   Organization        @relation(fields: [organizationId], references: [id])

  // Perioada
  year           Int                 // ex: 2026
  month          Int                 // 1–12

  // Categorii de cheltuieli
  category       ExpenseCategory
  description    String              // ex: "Chirie depozit Militari"
  amount         Float               // RON, fără TVA
  vatDeductible  Boolean @default(false)  // e deductibil TVA-ul?
  vatAmount      Float   @default(0)      // TVA aferent (dacă deductibil)
  currency       String  @default("RON")  // RON sau EUR

  // Metadate
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, year, month, category, description])
  @@index([organizationId, year, month])
}

enum ExpenseCategory {
  RENT            // Chirie spațiu / depozit
  SALARY          // Salarii + contribuții angajator
  COURIER         // Costuri curier suplimentare / returnări
  SOFTWARE        // Shopify, Rise, Meta, design tools
  MARKETING_OTHER // Influenceri, foto, video (non-Meta)
  ACCOUNTING      // Contabilitate
  BANK_FEES       // Comisioane bancare, procesare plăți
  OTHER           // Diverse
}
```

### 2.2 ProductProfitabilitySnapshot — Cache calculat

```prisma
model ProductProfitabilitySnapshot {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // Produs
  productId      String
  product        Product  @relation(fields: [productId], references: [id])

  // Perioada snapshot-ului
  periodStart    DateTime
  periodEnd      DateTime
  periodDays     Int      // 30 sau 90

  // Volume
  unitsSold      Int
  ordersCount    Int
  unitsReturned  Int      @default(0)

  // Revenue
  grossRevenue   Float    // suma totalPrice a itemelor
  netRevenue     Float    // grossRevenue - retururi estimate
  avgSellingPrice Float

  // Costuri directe
  totalCogs      Float    // unitsSold × cogs
  totalShipping  Float    // unitsSold × shippingCost
  totalPackaging Float    // unitsSold × packagingCost
  totalShopifyFee Float   // netRevenue × shopifyFeeRate

  // Provizioane
  returnProvision Float   // grossRevenue × returnRate × avgMargin
  vatCollected    Float   // netRevenue × vatRate / (1 + vatRate) — TVA inclus în preț
  vatDeductible   Float   // totalCogs × vatRate (dacă supplierVatDeductible)

  // Ads attribution
  adsSpendRON    Float    @default(0)  // cheltuieli Meta atribuite acestui produs
  adsPurchases   Int      @default(0)  // conversii Meta atribuite
  adsRoas        Float?               // netRevenue / adsSpendRON

  // Profitabilitate
  grossProfit    Float    // netRevenue - totalCogs
  operatingProfit Float   // grossProfit - totalShipping - totalPackaging - totalShopifyFee - returnProvision
  incomeTax      Float    // operatingProfit × taxRate (dacă > 0)
  netProfit      Float    // operatingProfit - incomeTax - adsSpendRON
  marginPct      Float    // netProfit / netRevenue × 100

  // Status recomandare
  recommendation RecommendationType?
  recommendationNote String?

  // Metadate
  calculatedAt   DateTime @default(now())
  isStale        Boolean  @default(false)  // true dacă ProductCost s-a schimbat după snapshot

  @@unique([organizationId, productId, periodStart, periodEnd])
  @@index([organizationId, periodStart])
  @@index([organizationId, marginPct])
}

enum RecommendationType {
  SCALE_UP        // Margin > 30%, volum mare → mărire stoc
  MONITOR         // Margin 10–30%, stabil
  REVIEW_COSTS    // Margin < 10% → analizează costuri
  KILL_ADS        // ROAS < 1.5 → oprește ads
  DEAD_STOCK      // Fără vânzări 30 zile
  BREAK_EVEN      // Nu acoperă cheltuielile fixe alocate
}
```

### 2.3 StoreProfitabilitySnapshot — Snapshot magazin total

```prisma
model StoreProfitabilitySnapshot {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  year           Int
  month          Int   // 1–12

  // Revenue
  grossRevenue   Float
  refunds        Float
  netRevenue     Float

  // Costuri produse
  totalCogs      Float
  totalShipping  Float
  totalPackaging Float
  totalShopifyFees Float

  // Ads
  totalAdsSpend  Float   // din Meta (convertit RON)
  totalAdsPurchases Int

  // Cheltuieli manuale
  totalManualExpenses Float

  // Provizioane
  totalReturnProvision Float
  totalVatCollected    Float
  totalVatDeductible   Float

  // Profitabilitate
  grossProfit          Float
  operatingProfit      Float
  incomeTax            Float
  netProfit            Float
  netMarginPct         Float

  // Comparație luna anterioară
  prevMonthNetProfit   Float?
  growthPct            Float?

  calculatedAt   DateTime @default(now())

  @@unique([organizationId, year, month])
}
```

### 2.4 MetaProductMapping — Atribuire campanie → produs

```prisma
model MetaProductMapping {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // Campania Meta
  campaignId     String
  campaign       Campaign @relation(fields: [campaignId], references: [id])

  // Produsul asociat
  productId      String
  product        Product  @relation(fields: [productId], references: [id])

  // Tipul de atribuire
  mappingType    MappingType
  confidence     Float    @default(1.0)  // 0–1, 1 = manual/cert

  // Pentru pattern matching
  matchPattern   String?  // ex: "ep-2011" din numele campaniei

  createdAt      DateTime @default(now())
  createdBy      String   // userId care a creat mapping-ul

  @@unique([campaignId, productId])
  @@index([organizationId, productId])
}

enum MappingType {
  MANUAL          // utilizatorul a selectat explicit
  UTM_AUTO        // detectat din utm_content / utm_campaign
  NAME_PATTERN    // campaniei conține SKU / slug produs
  AI_SUGGESTED    // sugerat de AI (necesită confirmare)
}
```

### 2.5 ExchangeRate — Cursul EUR/RON

```prisma
model ExchangeRate {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  date           DateTime @db.Date
  eurToRon       Float    // ex: 4.97

  source         ExchangeRateSource @default(MANUAL)
  createdAt      DateTime @default(now())

  @@unique([organizationId, date])
  @@index([organizationId, date])
}

enum ExchangeRateSource {
  MANUAL          // pastat manual de utilizator
  BNR_API         // BNR XML feed (viitor)
  FIXED           // rată fixă configurată pe Organization
}
```

### 2.6 Modificări pe modele existente

```prisma
// Adăugat la Organization
model Organization {
  // ... câmpurile existente ...

  // Cursul EUR/RON
  eurToRonFixed   Float?   // dacă setat, se folosește mereu această rată
  useFixedRate    Boolean  @default(true)  // Phase 1: rată fixă

  // Configurări profitabilitate
  defaultReturnRate Float  @default(0.05)  // 5% — override per produs în ProductCost
  incomeTaxType   IncomeTaxType  // MICRO_1 | MICRO_3 | PROFIT_16

  // Relații noi
  monthlyExpenses  MonthlyExpense[]
  productSnapshots ProductProfitabilitySnapshot[]
  storeSnapshots   StoreProfitabilitySnapshot[]
  exchangeRates    ExchangeRate[]
  metaMappings     MetaProductMapping[]
}
```

---

## 3. Motorul de Profitabilitate — `lib/profitability-engine.ts`

### 3.1 Structuri de date (tipuri TypeScript)

```typescript
// lib/profitability-engine.ts

export interface ProductCostConfig {
  cogs: number;                  // cost achiziție per unitate, RON fără TVA
  supplierVatDeductible: boolean; // furnizor cu factură TVA?
  shippingCost: number;          // cost transport per unitate
  packagingCost: number;         // cost ambalaj per unitate
  vatRate: number;               // TVA colectat (0.19 = 19%)
  returnRate: number;            // rata returnărilor (ex: 0.08 = 8%)
}

export interface OrganizationTaxConfig {
  incomeTaxType: 'MICRO_1' | 'MICRO_3' | 'PROFIT_16';
  shopifyFeeRate: number;        // ex: 0.02 = 2%
  eurToRon: number;              // cursul de schimb aplicabil
}

export interface SalesData {
  unitsSold: number;
  grossRevenue: number;          // suma prețurilor cu TVA
  totalDiscounts: number;
}

export interface AdsData {
  spendEur: number;              // cheltuieli Meta în EUR
  spendRon: number;              // convertit cu eurToRon
  purchases: number;             // conversii raportate de Meta
}

export interface ProductProfitabilityResult {
  // Input rezumat
  unitsSold: number;
  grossRevenue: number;

  // Revenue net (după retururi)
  estimatedReturns: number;      // unitsSold × returnRate
  returnedRevenue: number;       // estimatedReturns × avgSellingPrice
  netRevenue: number;            // grossRevenue - returnedRevenue

  // TVA
  vatCollected: number;          // netRevenue × vatRate / (1 + vatRate)
  revenueExVat: number;          // netRevenue / (1 + vatRate)

  // Costuri directe
  totalCogs: number;             // unitsSold × cogs
  totalShipping: number;         // unitsSold × shippingCost
  totalPackaging: number;        // unitsSold × packagingCost
  totalShopifyFee: number;       // netRevenue × shopifyFeeRate
  vatDeductibleAmount: number;   // totalCogs × vatRate (dacă deductibil)

  // Provizioane
  returnProvision: number;       // returnedRevenue × cogsMarginRatio — cost mărfii returnate

  // Profit înainte de ads și impozit
  grossProfit: number;           // netRevenue - totalCogs
  operatingProfit: number;       // grossProfit - shipping - packaging - shopifyFee - returnProvision

  // Ads attribution
  adsSpendRon: number;
  profitAfterAds: number;        // operatingProfit - adsSpendRon

  // Impozit
  incomeTax: number;
  netProfit: number;             // profitAfterAds - incomeTax

  // Marje
  grossMarginPct: number;        // grossProfit / netRevenue × 100
  operatingMarginPct: number;    // operatingProfit / netRevenue × 100
  netMarginPct: number;          // netProfit / netRevenue × 100

  // Ads efficiency
  roas: number | null;           // netRevenue / adsSpendRon
  costPerPurchase: number | null; // adsSpendRon / purchases

  // Break-even
  breakEvenUnits: number;        // câte unități pentru profit = 0
  maxSustainableAdsBudget: number; // buget max ads la care netProfit = 0
}
```

### 3.2 Formula canonică — explicată pas cu pas

```typescript
/**
 * Calculează profitabilitatea unui produs pentru o perioadă dată.
 *
 * FORMULA (în ordine de aplicare):
 *
 * 1. NET REVENUE:
 *    returnsEstimate = unitsSold × returnRate
 *    returnedRevenue = returnsEstimate × avgSellingPrice
 *    netRevenue = grossRevenue - returnedRevenue
 *
 * 2. TVA COLECTAT (TVA inclus în prețul de vânzare):
 *    vatCollected = netRevenue × vatRate / (1 + vatRate)
 *    revenueExVat = netRevenue - vatCollected = netRevenue / (1 + vatRate)
 *
 * 3. COSTURI DIRECTE:
 *    totalCogs = unitsSold × cogs
 *    totalShipping = unitsSold × shippingCost
 *    totalPackaging = unitsSold × packagingCost
 *    totalShopifyFee = netRevenue × shopifyFeeRate
 *    vatDeductible = supplierVatDeductible ? totalCogs × vatRate : 0
 *    cogsNet = totalCogs - vatDeductible  // costul real după recuperare TVA
 *
 * 4. GROSS PROFIT:
 *    grossProfit = netRevenue - cogsNet
 *
 * 5. RETURN PROVISION (costul mărfii pentru unitățile returnate):
 *    returnProvision = returnsEstimate × cogs
 *    (marfa returnată poate fi revândută, dar pierde 50% din valoare în beauty)
 *    returnProvision = returnsEstimate × cogs × 0.5  // pierdere parțială
 *
 * 6. OPERATING PROFIT:
 *    operatingProfit = grossProfit
 *                    - totalShipping
 *                    - totalPackaging
 *                    - totalShopifyFee
 *                    - returnProvision
 *
 * 7. PROFIT AFTER ADS:
 *    profitAfterAds = operatingProfit - adsSpendRon
 *
 * 8. INCOME TAX (pe profitAfterAds dacă > 0):
 *    taxRate = MICRO_1 → 0.01 | MICRO_3 → 0.03 | PROFIT_16 → 0.16
 *    incomeTax = max(0, profitAfterAds) × taxRate
 *    ATENȚIE: microimpozitul se calculează pe REVENUE, nu pe profit!
 *    Pentru MICRO_1/MICRO_3: incomeTax = netRevenue × taxRate
 *    Pentru PROFIT_16: incomeTax = max(0, profitAfterAds) × 0.16
 *
 * 9. NET PROFIT:
 *    netProfit = profitAfterAds - incomeTax
 */
export function calculateProductProfitability(
  sales: SalesData,
  cost: ProductCostConfig,
  tax: OrganizationTaxConfig,
  ads: AdsData = { spendEur: 0, spendRon: 0, purchases: 0 }
): ProductProfitabilityResult {
  const avgSellingPrice = sales.unitsSold > 0
    ? sales.grossRevenue / sales.unitsSold
    : 0;

  // 1. Net revenue după retururi
  const returnsEstimate = Math.round(sales.unitsSold * cost.returnRate);
  const returnedRevenue = returnsEstimate * avgSellingPrice;
  const netRevenue = sales.grossRevenue - returnedRevenue;

  // 2. TVA colectat
  const vatCollected = netRevenue * cost.vatRate / (1 + cost.vatRate);
  const revenueExVat = netRevenue / (1 + cost.vatRate);

  // 3. Costuri directe
  const totalCogs = sales.unitsSold * cost.cogs;
  const totalShipping = sales.unitsSold * cost.shippingCost;
  const totalPackaging = sales.unitsSold * cost.packagingCost;
  const totalShopifyFee = netRevenue * tax.shopifyFeeRate;
  const vatDeductibleAmount = cost.supplierVatDeductible
    ? totalCogs * cost.vatRate
    : 0;
  const cogsNet = totalCogs - vatDeductibleAmount;

  // 4. Gross profit
  const grossProfit = netRevenue - cogsNet;

  // 5. Return provision (50% din costul mărfii returnate — pierdere parțială)
  const returnProvision = returnsEstimate * cost.cogs * 0.5;

  // 6. Operating profit
  const operatingProfit = grossProfit
    - totalShipping
    - totalPackaging
    - totalShopifyFee
    - returnProvision;

  // 7. Profit after ads
  const adsSpendRon = ads.spendRon > 0
    ? ads.spendRon
    : ads.spendEur * tax.eurToRon;
  const profitAfterAds = operatingProfit - adsSpendRon;

  // 8. Income tax (CRITIC: microimpozit se aplică pe revenue, nu profit)
  let incomeTax = 0;
  if (tax.incomeTaxType === 'MICRO_1') {
    incomeTax = netRevenue * 0.01;
  } else if (tax.incomeTaxType === 'MICRO_3') {
    incomeTax = netRevenue * 0.03;
  } else {
    // PROFIT_16 — impozit pe profit, nu pe revenue
    incomeTax = Math.max(0, profitAfterAds) * 0.16;
  }

  // 9. Net profit
  const netProfit = profitAfterAds - incomeTax;

  // Marje
  const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const operatingMarginPct = netRevenue > 0 ? (operatingProfit / netRevenue) * 100 : 0;
  const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // Ads efficiency
  const roas = adsSpendRon > 0 ? netRevenue / adsSpendRon : null;
  const costPerPurchase = ads.purchases > 0 ? adsSpendRon / ads.purchases : null;

  // Break-even analysis
  // La break-even: netProfit = 0, deci trebuie să găsim unitsBE
  // netRevenue_BE = unitsBE × avgSellingPrice
  // operatingProfit_BE = netRevenue_BE × (1 - returnRate) - totalCosts_per_unit × unitsBE
  // ... simplificat:
  const profitPerUnit = avgSellingPrice * (1 - cost.returnRate)
    - cost.cogs * (1 - (cost.supplierVatDeductible ? cost.vatRate : 0))
    - cost.shippingCost
    - cost.packagingCost
    - avgSellingPrice * tax.shopifyFeeRate * (1 - cost.returnRate);
  const microTaxPerUnit = tax.incomeTaxType !== 'PROFIT_16'
    ? avgSellingPrice * (1 - cost.returnRate) * (tax.incomeTaxType === 'MICRO_1' ? 0.01 : 0.03)
    : 0;
  const netProfitPerUnit = profitPerUnit - microTaxPerUnit;
  const breakEvenUnits = netProfitPerUnit > 0
    ? Math.ceil(0 / netProfitPerUnit) // 0 cheltuieli fixe per produs în izolare
    : Infinity;

  // Max ads budget sustenabil: profitAfterAds = adsSpend → adsSpend = operatingProfit / 2
  const maxSustainableAdsBudget = Math.max(0, operatingProfit * 0.5);

  return {
    unitsSold: sales.unitsSold,
    grossRevenue: sales.grossRevenue,
    estimatedReturns: returnsEstimate,
    returnedRevenue,
    netRevenue,
    vatCollected,
    revenueExVat,
    totalCogs,
    totalShipping,
    totalPackaging,
    totalShopifyFee,
    vatDeductibleAmount,
    returnProvision,
    grossProfit,
    operatingProfit,
    adsSpendRon,
    profitAfterAds,
    incomeTax,
    netProfit,
    grossMarginPct,
    operatingMarginPct,
    netMarginPct,
    roas,
    costPerPurchase,
    breakEvenUnits,
    maxSustainableAdsBudget,
  };
}
```

### 3.3 Exemplu numeric concret — Produs EP-2011

**Date intrare:**

| Parametru | Valoare |
|-----------|---------|
| Preț vânzare | 299 RON (cu TVA 19%) |
| Unități vândute (30 zile) | 47 |
| Gross revenue | 14.053 RON |
| COGS (cost achiziție) | 89 RON fără TVA |
| Furnizor cu factură TVA | Da |
| Transport per colet | 18 RON |
| Ambalaj per colet | 5 RON |
| Comision Shopify | 2% |
| Rata retur | 8% |
| Impozit | Micro 1% |
| Ads Meta (luna) | 450 EUR × 4.97 = 2.236,50 RON |

**Calcul pas cu pas:**

```
1. RETURURI:
   returnsEstimate = round(47 × 0.08) = 4 unități
   returnedRevenue = 4 × 299 = 1.196 RON
   netRevenue = 14.053 - 1.196 = 12.857 RON

2. TVA COLECTAT:
   vatCollected = 12.857 × 0.19 / 1.19 = 2.052,74 RON
   revenueExVat = 12.857 / 1.19 = 10.804,20 RON

3. COSTURI DIRECTE:
   totalCogs = 47 × 89 = 4.183 RON
   vatDeductible = 4.183 × 0.19 = 794,77 RON  (furnizor cu TVA)
   cogsNet = 4.183 - 794,77 = 3.388,23 RON
   totalShipping = 47 × 18 = 846 RON
   totalPackaging = 47 × 5 = 235 RON
   totalShopifyFee = 12.857 × 0.02 = 257,14 RON

4. GROSS PROFIT:
   grossProfit = 12.857 - 3.388,23 = 9.468,77 RON

5. RETURN PROVISION:
   returnProvision = 4 × 89 × 0.5 = 178 RON

6. OPERATING PROFIT:
   operatingProfit = 9.468,77 - 846 - 235 - 257,14 - 178 = 7.952,63 RON

7. PROFIT AFTER ADS:
   profitAfterAds = 7.952,63 - 2.236,50 = 5.716,13 RON

8. MICROIMPOZIT 1% (pe netRevenue):
   incomeTax = 12.857 × 0.01 = 128,57 RON

9. NET PROFIT:
   netProfit = 5.716,13 - 128,57 = 5.587,56 RON

MARJE:
   grossMarginPct = 9.468,77 / 12.857 × 100 = 73,6%
   operatingMarginPct = 7.952,63 / 12.857 × 100 = 61,8%
   netMarginPct = 5.587,56 / 12.857 × 100 = 43,5%

ADS EFFICIENCY:
   ROAS = 12.857 / 2.236,50 = 5.75x  ← excelent (> 3.0 = bun)
```

**Concluzie automată:** Margin 43.5%, ROAS 5.75x → Recomandare: **SCALE_UP** — mărește buget ads și stoc.

---

## 4. Atribuirea Meta Ads → Produse

### 4.1 Strategii de atribuire (în ordine de prioritate)

**Prioritate 1 — Mapping manual confirmat**
Utilizatorul selectează explicit care campanie Meta promovează care produs. Confidence = 1.0. Dacă există mapping manual, se ignoră celelalte metode.

**Prioritate 2 — UTM Parameters**
La crearea reclamelor în Meta, se adaugă UTM parameters:
```
utm_source=facebook
utm_medium=paid_social
utm_campaign=ep-2011-demo
utm_content=product-ep2011
```
Shopify înregistrează UTM în `Order.landingPageParams`. Putem extrage `utm_content` sau `utm_campaign` și face match cu produsele.

```typescript
// lib/utm-attribution.ts
export function extractProductFromUTM(utmContent: string | null): string | null {
  if (!utmContent) return null;
  // Convenție: utm_content = "product-{shopify-handle}"
  // ex: "product-ep-2011" → "ep-2011"
  const match = utmContent.match(/^product-(.+)$/);
  return match ? match[1] : null;
}
```

**Prioritate 3 — Naming convention campanie**
Convenție Azora: numele campaniei conține SKU sau slug-ul produsului.

```typescript
// lib/campaign-name-matcher.ts
// Exemple de naming convention:
// "EP-2011 | Demo | Romania | Broad"     → product slug: "ep-2011"
// "BearGift | Engagement | F18-35"       → product slug: "bear-gift"
// "EP-2011-Ad2 | Conversions | Retarget" → product slug: "ep-2011"

export function inferProductFromCampaignName(
  campaignName: string,
  productSlugs: string[]
): { slug: string; confidence: number } | null {
  const normalized = campaignName.toLowerCase();

  for (const slug of productSlugs) {
    if (normalized.includes(slug.toLowerCase())) {
      return { slug, confidence: 0.85 };
    }
  }

  return null;
}
```

**Prioritate 4 — Distribuție proporțională (fallback)**
Dacă o campanie nu poate fi atribuită unui produs specific, cheltuiala se distribuie proporțional cu revenue-ul fiecărui produs din acea perioadă.

```typescript
// Cheltuiala nedistribuită se împarte proporțional:
// adsShareProduct_i = adsSpendUndistributed × (revenue_i / totalRevenue)
```

### 4.2 UI pentru mapping

În pagina `/profitability/attribution`:
- Lista tuturor campaniilor Meta active
- Status atribuire: ✓ Manual | ~ Auto-detectat | ✗ Neatribuit
- Dropdown per campanie: selectează produsul asociat
- Buton "Aplică naming convention" — rulează auto-detection pentru toate campaniile neatribuite
- Campanii cu `confidence < 0.8` afișate cu badge "Necesită confirmare"

### 4.3 Schema de atribuire în calcule

```typescript
// lib/ads-attribution.ts
export async function getProductAdsSpend(
  productId: string,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  eurToRon: number
): Promise<AdsData> {
  // 1. Găsește campaniile cu mapping manual pentru acest produs
  const manualMappings = await prisma.metaProductMapping.findMany({
    where: { organizationId, productId, mappingType: 'MANUAL' },
    include: { campaign: { include: { metrics: { where: {
      date: { gte: periodStart, lte: periodEnd }
    }}}}}
  });

  // 2. Găsește campaniile auto-detectate (confidence >= 0.8)
  const autoMappings = await prisma.metaProductMapping.findMany({
    where: {
      organizationId,
      productId,
      mappingType: { in: ['UTM_AUTO', 'NAME_PATTERN'] },
      confidence: { gte: 0.8 }
    },
    include: { campaign: { include: { metrics: { where: {
      date: { gte: periodStart, lte: periodEnd }
    }}}}}
  });

  // 3. Calculează totalul
  const allMappings = [...manualMappings, ...autoMappings];
  const totalSpendEur = allMappings.reduce((sum, mapping) =>
    sum + mapping.campaign.metrics.reduce((s, m) => s + m.spend, 0), 0
  );
  const totalPurchases = allMappings.reduce((sum, mapping) =>
    sum + mapping.campaign.metrics.reduce((s, m) => s + m.purchases, 0), 0
  );

  return {
    spendEur: totalSpendEur,
    spendRon: totalSpendEur * eurToRon,
    purchases: totalPurchases,
  };
}
```

---

## 5. API Routes

### 5.1 Structura API

```
/api/analytics/
├── profitability/
│   ├── GET  /                     — profitabilitate magazin total (luna curentă)
│   ├── GET  /?period=2026-02      — profitabilitate lună specifică
│   ├── GET  /trend                — ultimele 6 luni, grafic trend
│   └── POST /recalculate          — forțează recalcul snapshot
├── products/
│   ├── GET  /                     — profitabilitate per produs (30 zile default)
│   ├── GET  /?days=90             — ultimele 90 zile
│   ├── GET  /:productId           — detaliu complet produs
│   └── GET  /recommendations      — lista recomandări active
├── expenses/
│   ├── GET  /?year=2026&month=3   — cheltuieli manuale lunare
│   ├── POST /                     — adaugă cheltuială manuală
│   ├── PUT  /:id                  — editează cheltuială
│   └── DELETE /:id                — șterge cheltuială
├── attribution/
│   ├── GET  /                     — mapările campanie → produs
│   ├── POST /                     — creează mapping manual
│   ├── POST /auto-detect          — rulează auto-detection
│   └── DELETE /:id                — șterge mapping
└── export/
    ├── GET  /csv?period=2026-03   — export CSV profitabilitate
    └── GET  /excel?period=2026-03 — export Excel complet
```

### 5.2 GET /api/analytics/profitability

```typescript
// app/api/analytics/profitability/route.ts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period'); // "2026-03" sau null

  const { year, month } = period
    ? parsePeriod(period)
    : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

  const org = await getOrganizationForUser(session.user.id);

  // Caută snapshot cached
  let snapshot = await prisma.storeProfitabilitySnapshot.findUnique({
    where: { organizationId_year_month: { organizationId: org.id, year, month } }
  });

  // Dacă nu există sau e mai vechi de 6 ore, recalculează
  if (!snapshot || isOlderThan(snapshot.calculatedAt, 6)) {
    snapshot = await recalculateStoreSnapshot(org.id, year, month);
  }

  // Luna anterioară pentru comparație
  const prevMonth = month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };

  const prevSnapshot = await prisma.storeProfitabilitySnapshot.findUnique({
    where: { organizationId_year_month: { organizationId: org.id, ...prevMonth } }
  });

  return NextResponse.json({
    current: snapshot,
    previous: prevSnapshot,
    growthPct: prevSnapshot && prevSnapshot.netProfit !== 0
      ? ((snapshot.netProfit - prevSnapshot.netProfit) / Math.abs(prevSnapshot.netProfit)) * 100
      : null,
  });
}
```

### 5.3 GET /api/analytics/products

```typescript
// Răspuns structurat pentru lista produselor
interface ProductProfitabilityListItem {
  productId: string;
  productTitle: string;
  productHandle: string;
  imageUrl: string | null;

  // Volum
  unitsSold: number;

  // Revenue
  netRevenue: number;

  // Profit
  netProfit: number;
  netMarginPct: number;

  // Ads
  adsSpendRon: number;
  roas: number | null;

  // Recomandare
  recommendation: RecommendationType | null;

  // Status date
  hasCostData: boolean;  // false dacă ProductCost lipsește
  isStale: boolean;
}
```

### 5.4 POST /api/analytics/profitability/recalculate

```typescript
// Declanșat manual sau prin cron nocturn
// Recalculează toate snapshot-urile pentru luna curentă
export async function POST(req: NextRequest) {
  const { organizationId } = await req.json();

  // Job asincron — returnează imediat cu jobId
  const jobId = await queueRecalculationJob(organizationId);

  return NextResponse.json({ jobId, status: 'queued' });
}
```

---

## 6. Dashboard Principal — Redesign `/dashboard`

### 6.1 Layout nou

```
┌─────────────────────────────────────────────────────────────────┐
│  RISE Dashboard          Martie 2026    [← Prev] [Next →]       │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  REVENUE NET │  PROFIT NET  │  MARJA NETĂ  │   CHELTUIELI ADS   │
│  42.857 RON  │  18.243 RON  │    42.5%     │    8.920 RON       │
│  ▲ +12% luna │  ▲ +8% luna  │  ▲ +2.1pp   │   ROAS: 4.8x      │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│                    Trend Profit Net (30 zile)                    │
│  [grafic linie: profit zilnic cumulat + cheltuieli ads zilnice]  │
├──────────────────────────────────┬──────────────────────────────┤
│  Waterfall Profitabilitate       │  Top 5 Produse după Profit   │
│                                  │                              │
│  Revenue brut:   +56.400 RON     │  1. EP-2011      5.587 RON   │
│  - Retururi:      -4.512 RON     │  2. Bear Gift    3.241 RON   │
│  = Revenue net:  +51.888 RON     │  3. ...                      │
│  - COGS:         -18.200 RON     │                              │
│  - Transport:     -2.800 RON     │  Bottom 3 (risc):            │
│  - Ambalaj:         -940 RON     │  ⚠ Produs X    -120 RON     │
│  - Shopify fee:   -1.038 RON     │  ⚠ Produs Y      45 RON     │
│  - Ads Meta:      -8.920 RON     │                              │
│  - Alte chelt:    -3.200 RON     │                              │
│  - Impozit:         -428 RON     │                              │
│  = PROFIT NET:  +16.362 RON      │                              │
├──────────────────────────────────┴──────────────────────────────┤
│  Alerte active                                                   │
│  ⚠ 2 produse cu margin < 10%  |  ✓ Ads ROAS > 3.0 general     │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Componente noi

**`<ProfitWaterfallChart />`**
Grafic waterfall (cascadă) folosind Recharts. Bare verticale: verde = revenue, roșu = deduceri, albastru = profit final. Fiecare bară are tooltip cu explicație formula.

**`<KPICard />`**
Card metric cu: valoare principală, comparație luna anterioară (%, săgeată), sparkline 7 zile în fundal.

**`<ProductRankingTable />`**
Tabel sortabil după: revenue, profit net, margin%, ROAS. Colorare condiționată: roșu margin < 10%, galben 10-20%, verde > 20%.

**`<AlertsPanel />`**
Lista recomandărilor active, sortate după severitate. Click → deschide detaliu produs sau cheltuială relevantă.

---

## 7. Pagina Profitabilitate — `/profitability`

### 7.1 Structura paginii

```
/profitability
├── Tabs: [Produse] [Magazin Total] [Cheltuieli] [Atribuire Ads]
│
├── [Tab: Produse]
│   ├── Filtru: perioadă (30/90/custom), categorie, status
│   ├── Sortare: margin%, profit net, revenue, ROAS
│   ├── Tabel produse cu toate metricile
│   └── Detaliu expandat per produs (click row)
│
├── [Tab: Magazin Total]
│   ├── Selector lună/an
│   ├── Waterfall complet
│   ├── Grafic trend 6 luni
│   └── Comparație YoY (dacă există date)
│
├── [Tab: Cheltuieli]
│   ├── Lista cheltuieli lunare manuale
│   ├── Buton "Adaugă cheltuială"
│   ├── Total pe categorii (pie chart)
│   └── Trend cheltuieli 6 luni
│
└── [Tab: Atribuire Ads]
    ├── Status atribuire toate campaniile
    ├── Buton "Auto-detect"
    └── Mapping manual per campanie
```

### 7.2 Detaliu expandat produs

La click pe un produs în tabel, se expandează un panel cu:

```
EP-2011 LED Facial Device — Detaliu Profitabilitate (Martie 2026)

Revenue brut:        14.053 RON  (47 unități × 299 RON avg)
Retururi estimate:   -1.196 RON  (4 unități × 8% rată)
Revenue net:         12.857 RON

TVA colectat:        -2.052 RON  (inclus în preț, plătit la stat)
Revenue ex-TVA:      10.805 RON  ← baza de calcul contabil

COGS:               -4.183 RON  (47 × 89 RON)
Recuperare TVA furn:  +795 RON   (factură cu TVA)
COGS net:           -3.388 RON

Profit brut:         9.469 RON   (73.6%)

Transport:            -846 RON   (47 × 18 RON)
Ambalaj:              -235 RON   (47 × 5 RON)
Comision Shopify:     -257 RON   (2% din net revenue)
Provision retur:      -178 RON   (4 unități × 89/2 RON)

Profit operațional:  7.953 RON   (61.8%)

Cheltuieli ads:     -2.237 RON   (450 EUR × 4.97 RON/EUR)
Profit după ads:     5.716 RON

Microimpozit 1%:      -129 RON   (pe revenue net)

PROFIT NET:          5.588 RON   (43.5%) ✓

Recomandare: SCALE UP — Margin excelentă + ROAS 5.75x
Budget max sustenabil ads: 3.977 RON/lună
```

### 7.3 Recomandări — logica completă

```typescript
// lib/recommendations.ts
export function generateRecommendation(
  snapshot: ProductProfitabilitySnapshot,
  thresholds = {
    scaleUpMargin: 30,     // %
    reviewMargin: 10,      // %
    killAdsRoas: 1.5,
    deadStockDays: 30,
  }
): { type: RecommendationType; note: string } {
  const { netMarginPct, roas, unitsSold, adsSpendRon } = snapshot;

  // Prioritate 1: Stoc mort
  if (unitsSold === 0) {
    return {
      type: 'DEAD_STOCK',
      note: `Nicio vânzare în ultimele ${snapshot.periodDays} zile. Evaluează lichidare sau promoție agresivă.`
    };
  }

  // Prioritate 2: Ads ineficiente
  if (adsSpendRon > 0 && roas !== null && roas < thresholds.killAdsRoas) {
    return {
      type: 'KILL_ADS',
      note: `ROAS ${roas.toFixed(2)}x sub pragul de 1.5x. Oprește sau restructurează campania Meta. ` +
            `Pierzi ${((1 - roas) * adsSpendRon).toFixed(0)} RON din ads.`
    };
  }

  // Prioritate 3: Margine negativă sau foarte mică
  if (netMarginPct < thresholds.reviewMargin) {
    return {
      type: 'REVIEW_COSTS',
      note: netMarginPct < 0
        ? `Produs NEPROFITABIL — pierdere de ${Math.abs(netMarginPct).toFixed(1)}% din revenue. ` +
          `Renegociază prețul cu furnizorul sau crește prețul de vânzare.`
        : `Margine sub 10% (${netMarginPct.toFixed(1)}%). Analizează reducerea costurilor sau ` +
          `creșterea prețului.`
    };
  }

  // Prioritate 4: Scale up
  if (netMarginPct > thresholds.scaleUpMargin && unitsSold >= 20) {
    return {
      type: 'SCALE_UP',
      note: `Margin ${netMarginPct.toFixed(1)}% cu volum bun (${unitsSold} unități). ` +
            `Mărește stocul și bugetul de ads. Budget max sustenabil: ` +
            `${snapshot.maxSustainableAdsBudget.toFixed(0)} RON/lună.`
    };
  }

  // Default: monitorizare
  return {
    type: 'MONITOR',
    note: `Performanță stabilă. Margin ${netMarginPct.toFixed(1)}%.`
  };
}
```

---

## 8. Break-Even Analysis

### 8.1 Formula break-even per produs

Break-even reprezintă volumul minim de unități vândute pentru ca produsul să acopere:
- COGS net
- Transport + ambalaj
- Comision Shopify
- Cheltuielile ads fixe lunare alocate
- Impozit

```typescript
// lib/break-even.ts

export interface BreakEvenResult {
  breakEvenUnits: number;
  breakEvenRevenue: number;
  currentVolume: number;
  safetyMarginUnits: number;   // cât de departe suntem de break-even
  safetyMarginPct: number;
  maxAdsBudgetRON: number;     // la ce buget ads ajungem la break-even
  breakEvenAdsBudgetRON: number; // buget la care profitul = 0
}

export function calculateBreakEven(
  avgSellingPrice: number,
  cost: ProductCostConfig,
  tax: OrganizationTaxConfig,
  currentUnitsSold: number,
  currentAdsSpendRon: number
): BreakEvenResult {
  // Contribuție per unitate (contribution margin)
  const priceExVat = avgSellingPrice / (1 + cost.vatRate);
  const cogsNet = cost.cogs * (1 - (cost.supplierVatDeductible ? cost.vatRate : 0));
  const shopifyFeePerUnit = avgSellingPrice * tax.shopifyFeeRate;
  const returnCostPerUnit = cost.cogs * cost.returnRate * 0.5;

  const contributionPerUnit = priceExVat * (1 - cost.returnRate)
    - cogsNet
    - cost.shippingCost
    - cost.packagingCost
    - shopifyFeePerUnit
    - returnCostPerUnit;

  // Microimpozit reduce contribuția (aplicat pe revenue)
  const microTaxPerUnit = tax.incomeTaxType !== 'PROFIT_16'
    ? avgSellingPrice * (1 - cost.returnRate) * (tax.incomeTaxType === 'MICRO_1' ? 0.01 : 0.03)
    : 0;

  const netContributionPerUnit = contributionPerUnit - microTaxPerUnit;

  // Break-even cu cheltuielile ads actuale
  const breakEvenUnits = netContributionPerUnit > 0
    ? Math.ceil(currentAdsSpendRon / netContributionPerUnit)
    : Infinity;

  const breakEvenRevenue = breakEvenUnits * avgSellingPrice;
  const safetyMarginUnits = currentUnitsSold - breakEvenUnits;

  // Budget maxim ads sustenabil (la profitul curent)
  const currentTotalContribution = netContributionPerUnit * currentUnitsSold;
  const maxAdsBudgetRON = Math.max(0, currentTotalContribution); // 100% din contribuție → profit 0

  return {
    breakEvenUnits,
    breakEvenRevenue,
    currentVolume: currentUnitsSold,
    safetyMarginUnits,
    safetyMarginPct: currentUnitsSold > 0
      ? (safetyMarginUnits / currentUnitsSold) * 100
      : 0,
    maxAdsBudgetRON,
    breakEvenAdsBudgetRON: currentAdsSpendRon,
  };
}
```

### 8.2 Exemplu vizual break-even

```
EP-2011 — Break-Even Analysis

Contribuție netă/unitate:
  299 RON preț vânz.
  -251 RON / 1.19 TVA = -251.26 ex-TVA
  Wait... let me re-express:

  Price incl VAT: 299 RON
  Price ex VAT: 251.26 RON  (299 / 1.19)
  Ajustat retur: 251.26 × 0.92 = 231.16 RON
  COGS net: 89 × (1 - 0.19) = 72.09 RON
  Transport: 18.00 RON
  Ambalaj: 5.00 RON
  Shopify: 299 × 0.02 = 5.98 RON
  Return provision: 89 × 0.08 × 0.5 = 3.56 RON
  Microimpozit: 299 × 0.92 × 0.01 = 2.75 RON
  ─────────────────────────────────────
  Net contribution/unit = 231.16 - 72.09 - 18 - 5 - 5.98 - 3.56 - 2.75
                        = 123.78 RON/unitate

  Break-even la ads = 2.237 RON:
  breakEvenUnits = ceil(2.237 / 123.78) = 19 unități

  Volume curent: 47 unități
  Safety margin: 28 unități (59.6%)
  → Poți vinde cu 60% mai puțin și tot ești pe break-even

  Budget ads maxim sustenabil: 123.78 × 47 = 5.818 RON/lună
  (vs cheltuieli actuale 2.237 RON — ai marge de creștere 2.6×)
```

---

## 9. Sistem Cheltuieli Manuale

### 9.1 Formularul de adăugare

```typescript
// Exemplu date lună Martie 2026, Azora
const monthlyExpenses = [
  { category: 'RENT',       description: 'Chirie depozit Militari',    amount: 1200 },
  { category: 'SALARY',     description: 'Asistent comenzi part-time', amount: 1800 },
  { category: 'SOFTWARE',   description: 'Shopify Basic subscription', amount: 130  },
  { category: 'SOFTWARE',   description: 'Rise platform',              amount: 99   },
  { category: 'ACCOUNTING', description: 'Contabilitate lunară',       amount: 350  },
  { category: 'COURIER',    description: 'Returnări neacoperite curier', amount: 280 },
  { category: 'BANK_FEES',  description: 'Stripe/procesare plăți',     amount: 210  },
];
// TOTAL: 4.069 RON
```

### 9.2 Cum afectează profitabilitatea totală

Cheltuielile manuale intră în calculul `StoreProfitabilitySnapshot` ca `totalManualExpenses` și sunt deduse din operating profit:

```
netProfit = operatingProfit - totalAdsSpend - totalManualExpenses - incomeTax
```

**Important:** Cheltuielile manuale NU se alocă per produs în mod automat (sunt cheltuieli de overhead). Opțional, utilizatorul poate aloca manual un procent dintr-o cheltuială la un produs specific (feature avansat, Phase 2).

---

## 10. Cursul EUR/RON

### 10.1 Abordarea Phase 1 — rată fixă configurabilă

```typescript
// settings/organization page
const exchangeRateConfig = {
  useFixedRate: true,
  eurToRonFixed: 4.97,  // cursul configurat de utilizator
  // BNR API integration — Phase 2
};
```

### 10.2 Stocarea ratei folosite per perioadă

La calculul fiecărui snapshot, rata folosită se salvează explicit:

```typescript
// În StoreProfitabilitySnapshot
adsSpendEur: Float    // suma în EUR
eurToRonUsed: Float   // cursul aplicat la acel moment
adsSpendRON: Float    // EUR × rate (calculat la snapshot time)
```

Asta asigură că re-rularea calculelor nu modifică rezultatele istorice.

### 10.3 BNR API — Plan Phase 2

BNR publică cursurile zilnice în XML: `https://www.bnr.ro/nbrfxrates.xml`

```typescript
// lib/bnr-exchange-rate.ts — Phase 2
async function fetchBNRRate(date: string): Promise<number> {
  const url = `https://www.bnr.ro/nbrfxrates${date.replace(/-/g, '')}.xml`;
  const response = await fetch(url);
  const xml = await response.text();
  // Parse XML, extrage EUR rate
  const match = xml.match(/<Rate currency="EUR">([\d.]+)<\/Rate>/);
  return match ? parseFloat(match[1]) : 4.97; // fallback
}
```

---

## 11. Export Rapoarte

### 11.1 Export CSV

```typescript
// app/api/analytics/export/csv/route.ts
export async function GET(req: NextRequest) {
  const { period, scope } = parseExportParams(req);
  const data = await getExportData(session.user.organizationId, period, scope);

  const csvRows = [
    // Header
    ['Produs', 'Unități', 'Revenue Net (RON)', 'COGS', 'Transport',
     'Ambalaj', 'Shopify Fee', 'Ads Spend', 'ROAS', 'Profit Net', 'Margine %'],
    // Data rows
    ...data.products.map(p => [
      p.title,
      p.unitsSold,
      p.netRevenue.toFixed(2),
      p.totalCogs.toFixed(2),
      p.totalShipping.toFixed(2),
      p.totalPackaging.toFixed(2),
      p.totalShopifyFee.toFixed(2),
      p.adsSpendRon.toFixed(2),
      p.roas?.toFixed(2) ?? 'N/A',
      p.netProfit.toFixed(2),
      p.netMarginPct.toFixed(1) + '%',
    ]),
    // Summary row
    ['TOTAL', data.store.totalUnits, data.store.netRevenue, ...],
  ];

  const csv = csvRows.map(row => row.join(',')).join('\n');
  const filename = `rise-profitabilitate-${period}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    }
  });
}
```

### 11.2 Export Excel (cu xlsx)

Folosind biblioteca `xlsx` (SheetJS):

```typescript
import * as XLSX from 'xlsx';

// Foaie 1: Summary
// Foaie 2: Produse detaliat
// Foaie 3: Cheltuieli lunare
// Foaie 4: Campanii Meta
// Formatare condiționată: celule roșii pentru margin < 10%
```

### 11.3 Raport PDF (Phase 2)

Un raport PDF lunar cu toate metricile, watermark Azora, trimis automat pe email la 1 ale lunii.

---

## 12. Cron Jobs

### 12.1 Recalcul nocturn snapshot-uri

```typescript
// app/api/cron/recalculate-profitability/route.ts
// Declanșat via Vercel Cron sau cron job Dokploy la 02:00 zilnic

export async function POST(req: NextRequest) {
  // Verifică secret header pentru securitate
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const organizations = await prisma.organization.findMany({
    where: { isActive: true }
  });

  for (const org of organizations) {
    const now = new Date();
    // Recalculează luna curentă și luna anterioară
    await recalculateStoreSnapshot(org.id, now.getFullYear(), now.getMonth() + 1);
    await recalculateProductSnapshots(org.id, now, 30);
    await recalculateProductSnapshots(org.id, now, 90);
  }

  return NextResponse.json({ success: true, orgsProcessed: organizations.length });
}
```

---

## 13. Considerații România — Detalii Fiscale

### 13.1 Microimpozit — ATENȚIE critică

**Microimpozitul în România se calculează pe CIFRA DE AFACERI (revenue), NU pe profit.**

```
Micro 1%: aplică dacă SRL are cel puțin 1 salariat
Micro 3%: aplică dacă SRL nu are salariați

Formula: incomeTax = netRevenue × 0.01 (sau 0.03)
NU: incomeTax = netProfit × 0.01
```

Aceasta înseamnă că un produs poate fi "profitable" înainte de impozit dar microimpozitul reduce marja cu 1–3% din revenue, indiferent dacă ești în pierdere.

**Exemplu concret:**
- Revenue net: 100.000 RON/lună
- Profit operațional (după toate costurile): 5.000 RON (5%)
- Microimpozit 3%: 3.000 RON (pe revenue!)
- Profit net REAL: 2.000 RON (2%)
- Dacă crezi că plătești 3% din profit = 150 RON, ești greșit cu 1.850 RON

### 13.2 TVA — Flux complet

```
Magazin plătitor TVA (>300.000 RON/an sau opțiune voluntară):

TVA colectat de la clienți (19% din prețul de vânzare):
  → se plătește la ANAF trimestrial

TVA deductibil din achiziții (dacă furnizori cu factură TVA):
  → se deduce din TVA de plată

TVA de plată = TVA colectat - TVA deductibil

IMPORTANT: Magazinul NU „câștigă" TVA-ul. Este un impozit indirect.
Rise trebuie să afișeze revenue ex-TVA ca bază reală de calcul.
```

### 13.3 Retururi în beauty/wellness România

| Categorie produs | Rata retur tipică | Configurat implicit |
|-----------------|-------------------|---------------------|
| Dispozitive LED/EMS | 5–8% | 6% |
| Parfumuri/cosmetice | 3–5% | 4% |
| Cadouri/peluche | 2–4% | 3% |
| Electrocasnice beauty | 8–12% | 8% |

Fiecare `ProductCost` poate override rata implicită a organizației.

---

## 14. Sugestii de Îmbunătățire Viitoare

### 14.1 Scurt termen (Phase 2 — inclus în Sub-proiect 5+)

1. **BNR API integration** — cursul EUR/RON actualizat zilnic automat din XML-ul BNR
2. **Alertă ROAS scăzut** — notificare email/push când ROAS sub prag pentru 3 zile consecutive
3. **Proiecție lunară** — pe baza ritmului actual, estimează profitul final al lunii
4. **Comparație YoY** — profit Martie 2026 vs Martie 2025 (dacă există date)

### 14.2 Mediu termen (Sub-proiect 6)

5. **AI Hook Generator** — Claude analizează produsele profitabile și generează hooks pentru reclame noi (deplasit din Sub-proiect 5 per nota arhitecturală)
6. **Semantic product search** — pgvector embeddings pentru căutare inteligentă în biblioteca de produse
7. **Scenarii „What If"** — ce se întâmplă cu profitul dacă cresc prețul cu 10%? Dacă reduc COGS cu 5%?
8. **Alocarea cheltuielilor fixe per produs** — distribuție proporțională după revenue sau manuală

### 14.3 Long term (Phase 3)

9. **Multi-store support** — profitabilitate agregată pentru mai multe magazine Shopify
10. **Comparație cu concurența** — benchmark margini per categorie (date agregate anonimizate)
11. **Predicție ML** — model ARIMA/Prophet pentru predicția vânzărilor și profitabilității lunare
12. **Integrare contabilitate** — export direct în SmartBill/Saga pentru declarații fiscale

---

## 15. Plan de Implementare

### Faza 1 — Fundament (Săptămâna 1–2)

- [ ] Migrare schema Prisma (MonthlyExpense, snapshots, MetaProductMapping, ExchangeRate)
- [ ] Implementare `lib/profitability-engine.ts` cu unit tests complete
- [ ] Implementare `lib/break-even.ts` cu unit tests
- [ ] Implementare `lib/recommendations.ts`
- [ ] API routes: `/api/analytics/profitability`, `/api/analytics/products`

### Faza 2 — Attribution și Cheltuieli (Săptămâna 3)

- [ ] `lib/utm-attribution.ts` + `lib/campaign-name-matcher.ts`
- [ ] API routes: `/api/analytics/attribution`, `/api/analytics/expenses`
- [ ] UI: Tab Cheltuieli + formular adăugare
- [ ] UI: Tab Atribuire Ads

### Faza 3 — Dashboard și UI (Săptămâna 4)

- [ ] Redesign `/dashboard` cu toate metricile reale
- [ ] Pagina `/profitability` cu toate tab-urile
- [ ] `<ProfitWaterfallChart />`, `<KPICard />`, `<ProductRankingTable />`
- [ ] Detaliu expandat per produs cu break-even vizual

### Faza 4 — Export și Cron (Săptămâna 5)

- [ ] Export CSV
- [ ] Export Excel (SheetJS)
- [ ] Cron job recalcul nocturn
- [ ] Documentare + testing end-to-end

---

## 16. Unit Tests — Exemple

```typescript
// __tests__/profitability-engine.test.ts

describe('calculateProductProfitability', () => {
  const baseCost: ProductCostConfig = {
    cogs: 89,
    supplierVatDeductible: true,
    shippingCost: 18,
    packagingCost: 5,
    vatRate: 0.19,
    returnRate: 0.08,
  };

  const baseTax: OrganizationTaxConfig = {
    incomeTaxType: 'MICRO_1',
    shopifyFeeRate: 0.02,
    eurToRon: 4.97,
  };

  it('calculează corect net revenue cu retururi', () => {
    const result = calculateProductProfitability(
      { unitsSold: 47, grossRevenue: 14053, totalDiscounts: 0 },
      baseCost, baseTax
    );
    expect(result.estimatedReturns).toBe(4); // round(47 × 0.08)
    expect(result.returnedRevenue).toBeCloseTo(1196, 0);
    expect(result.netRevenue).toBeCloseTo(12857, 0);
  });

  it('calculează TVA colectat corect', () => {
    const result = calculateProductProfitability(
      { unitsSold: 47, grossRevenue: 14053, totalDiscounts: 0 },
      baseCost, baseTax
    );
    expect(result.vatCollected).toBeCloseTo(2052.74, 1);
  });

  it('aplică microimpozit pe revenue, nu pe profit', () => {
    const result = calculateProductProfitability(
      { unitsSold: 47, grossRevenue: 14053, totalDiscounts: 0 },
      baseCost, baseTax
    );
    // Micro 1% din netRevenue 12857 = 128.57
    expect(result.incomeTax).toBeCloseTo(128.57, 1);
  });

  it('calculează ROAS corect în RON', () => {
    const result = calculateProductProfitability(
      { unitsSold: 47, grossRevenue: 14053, totalDiscounts: 0 },
      baseCost, baseTax,
      { spendEur: 450, spendRon: 450 * 4.97, purchases: 12 }
    );
    expect(result.roas).toBeCloseTo(5.75, 1);
  });

  it('net profit EP-2011 example matches manual calculation', () => {
    const result = calculateProductProfitability(
      { unitsSold: 47, grossRevenue: 14053, totalDiscounts: 0 },
      baseCost, baseTax,
      { spendEur: 450, spendRon: 450 * 4.97, purchases: 12 }
    );
    // Conform exemplului din secțiunea 3.3:
    expect(result.netProfit).toBeCloseTo(5587.56, 0);
    expect(result.netMarginPct).toBeCloseTo(43.5, 0.5);
  });

  it('returnează breakEvenUnits Infinity dacă contribution per unit <= 0', () => {
    const lossProduct: ProductCostConfig = {
      ...baseCost,
      cogs: 280, // COGS mai mare decât prețul de vânzare posibil
    };
    const result = calculateProductProfitability(
      { unitsSold: 10, grossRevenue: 2000, totalDiscounts: 0 },
      lossProduct, baseTax
    );
    expect(result.breakEvenUnits).toBe(Infinity);
  });
});
```

---

## 17. Securitate și Validări

### 17.1 Authorization

Toate API routes verifică `organizationId` din sesiune. Niciodată nu se acceptă `organizationId` din parametrii request-ului fără verificare sesiune.

```typescript
// lib/auth-guards.ts
export async function getOrgFromSession(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true }
  });

  if (!user?.organization) throw new NotFoundError('Organization');
  return user.organization;
}
```

### 17.2 Validare input cheltuieli

```typescript
// Folosind Zod pentru validare
const MonthlyExpenseSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  category: z.enum(['RENT', 'SALARY', 'COURIER', 'SOFTWARE',
                     'MARKETING_OTHER', 'ACCOUNTING', 'BANK_FEES', 'OTHER']),
  description: z.string().min(3).max(200),
  amount: z.number().positive().max(1_000_000), // max 1M RON per cheltuială
  vatDeductible: z.boolean().default(false),
  vatAmount: z.number().min(0).default(0),
  currency: z.enum(['RON', 'EUR']).default('RON'),
  notes: z.string().max(500).optional(),
});
```

---

## 18. Metrici de Succes și Monitorizare

### 18.1 Metrici tehnice

| Metric | Target |
|--------|--------|
| Timp calcul snapshot produs | < 500ms |
| Timp încărcare dashboard | < 1.5s (date din cache) |
| Precizie calcule | Eroare < 0.01 RON vs calcul manual |
| Uptime API profitabilitate | 99.9% |

### 18.2 Metrici business

| Metric | Target după 30 zile |
|--------|---------------------|
| Utilizatori care consultă profitabilitate zilnic | ≥ 80% din sesiuni |
| Acțiuni bazate pe recomandări (click "Mărește stoc") | ≥ 2/săptămână |
| Export rapoarte generate | ≥ 4/lună |
| Acuratețe atribuire ads (din feedback utilizator) | ≥ 85% |

---

*Document generat: 2026-03-29*
*Versiune: 1.0*
*Next review: după finalizarea Sub-proiect 4 (Meta Ads Integration)*
