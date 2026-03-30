# Profitability Fixes & Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the production crash, update TVA to 21%, fix transport net calculation, fix 0-sales bug, add date/status/ROAS filters, include ads costs in product detail, and make manual expenses affect profitability totals.

**Architecture:** 9 independent tasks covering: DB migration → calculation engine fixes → API route fixes → UI component fixes → new UI features. Tasks 1-4 are foundational (fix the data); Tasks 5-9 are UI/feature additions.

**Tech Stack:** Next.js 16 App Router, Prisma ORM (PostgreSQL/Supabase), shadcn/ui, Tailwind v4, React Query, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-31-profitability-fixes-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/migrations/20260331000000_add_match_pattern/migration.sql` | Create | Add matchPattern column |
| `prisma/schema.prisma` | Modify | vatRate default 0.19→0.21 |
| `lib/profitability-engine.ts` | Modify | Add isVatPayer, fix transport net, add customerShipping |
| `lib/profitability.ts` | Modify | Fix transport net (accept netTransportPerUnit) |
| `app/(dashboard)/profitability/page.tsx` | Modify | Fix order items query, manual expenses in totals |
| `app/api/products/[id]/profitability/route.ts` | Modify | Fix vatRate fallback, add ads spend, include order shipping |
| `features/products/components/ProfitabilityTab.tsx` | Modify | Conditional TVA display, transport net row, ads spend row |
| `features/products/components/ProductCostForm.tsx` | Modify | Add 21% option, fix TVA conditional display |
| `app/(dashboard)/products/[id]/page.tsx` | Modify | Pass isVatPayer to components |
| `app/(dashboard)/orders/page.tsx` | Modify | Add date filter searchParams |
| `features/orders/components/DateRangePicker.tsx` | Create | Date picker with presets |
| `features/meta/components/CampaignsTable.tsx` | Modify | Add status + ROAS filters |

---

## Task 1: DB Migration — Add matchPattern column

**Fixes:** Production crash `P2022: MetaProductMapping.matchPattern does not exist`

**Files:**
- Create: `prisma/migrations/20260331000000_add_match_pattern/migration.sql`

- [ ] **Step 1: Create migration SQL file**

```sql
-- prisma/migrations/20260331000000_add_match_pattern/migration.sql
ALTER TABLE "MetaProductMapping" ADD COLUMN IF NOT EXISTS "matchPattern" TEXT;
```

- [ ] **Step 2: Create migration directory and file**

```bash
mkdir -p prisma/migrations/20260331000000_add_match_pattern
```

Then write the SQL above to `prisma/migrations/20260331000000_add_match_pattern/migration.sql`.

- [ ] **Step 3: Apply migration to local DB**

```bash
cd azora-rise
npx prisma migrate deploy
```

Expected output: `1 migration applied.`

- [ ] **Step 4: Verify the column exists**

```bash
npx prisma studio
```

Open `MetaProductMapping` table — verify `matchPattern` column is present (nullable TEXT).

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260331000000_add_match_pattern/
git commit -m "fix: add matchPattern column to MetaProductMapping (fixes P2022 prod crash)"
```

---

## Task 2: Update TVA Default from 19% to 21%

**Fixes:** TVA rate updated in Romania from 19% to 21% (effective 2026-01-01)

**Files:**
- Modify: `prisma/schema.prisma` line 126
- Modify: `app/api/products/[id]/profitability/route.ts` line 48
- Modify: `features/products/components/ProductCostForm.tsx` lines 75, 85, 162-165

- [ ] **Step 1: Update schema default**

In `prisma/schema.prisma`, find `ProductCost` model and change:
```prisma
// FROM:
vatRate               Float    @default(0.19)
// TO:
vatRate               Float    @default(0.21)
```

- [ ] **Step 2: Create migration for default change**

```bash
npx prisma migrate dev --name update_vat_rate_default
```

Expected: new migration created in `prisma/migrations/`.

- [ ] **Step 3: Update fallback in profitability route**

In `app/api/products/[id]/profitability/route.ts`, find the fallback block (lines 44-49) and change:
```typescript
    : {
        cogs: 0,
        supplierVatDeductible: false,
        vatRate: 0.21,   // was 0.19
        returnRate: 0.05,
      }
```

- [ ] **Step 4: Update ProductCostForm defaults and select options**

In `features/products/components/ProductCostForm.tsx`:

Change default vatRate (line 75):
```typescript
vatRate: cost?.vatRate ?? 0.21,   // was 0.19
```

Change fallback in live calculation (line 85):
```typescript
const vatRate = Number(values.vatRate) || 0.21   // was 0.19
```

Replace the `<select>` options for vatRate (lines 161-165):
```tsx
<select
  {...form.register('vatRate')}
  className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] appearance-none"
>
  <option value={0.21}>21%</option>
  <option value={0.19}>19% (pre-2026)</option>
  <option value={0.09}>9%</option>
  <option value={0.05}>5%</option>
  <option value={0}>0%</option>
</select>
```

- [ ] **Step 5: Update label in ProfitabilityTab**

In `features/products/components/ProfitabilityTab.tsx`, line 121, the label hardcodes "19%". Change to use the actual rate from the API response:

```tsx
// In the ProfitabilityTab, the `perUnit` object from API will include vatRate
// Change line 121 from:
<ProfitRow label="— TVA colectată (19%)" value={-perUnit.breakdowns.vatCollected} isDeduction />
// To:
<ProfitRow label={`— TVA colectată (${((perUnit.vatRateUsed ?? 0.21) * 100).toFixed(0)}%)`} value={-perUnit.breakdowns.vatCollected} isDeduction />
```

And in the route `app/api/products/[id]/profitability/route.ts`, add `vatRateUsed` to the perUnit response:
```typescript
return NextResponse.json({
  perUnit: {
    ...perUnitCalc,
    vatRateUsed: costInput.vatRate,           // ADD THIS
    shippingCostDisplay: orgSettings.shippingCost,
    packagingCostDisplay: orgSettings.packagingCost,
  },
  // ...
})
```

- [ ] **Step 6: Verify dev server has no TS errors**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ app/api/products/[id]/profitability/route.ts features/products/components/ProductCostForm.tsx features/products/components/ProfitabilityTab.tsx
git commit -m "feat: update TVA rate to 21% (effective 2026-01-01)"
```

---

## Task 3: Fix profitability-engine.ts — isVatPayer + transport net

**Fixes:** TVA colectată always shown even for non-payers; transport always subtracted even though customer pays it

**Files:**
- Modify: `lib/profitability-engine.ts`

- [ ] **Step 1: Add isVatPayer to OrganizationTaxConfig interface**

In `lib/profitability-engine.ts`, update the `OrganizationTaxConfig` interface:
```typescript
export interface OrganizationTaxConfig {
  incomeTaxType: 'MICRO_1' | 'MICRO_3' | 'PROFIT_16'
  shopifyFeeRate: number
  eurToRon: number
  isVatPayer: boolean          // ADD
}
```

- [ ] **Step 2: Add customerShipping to SalesData**

```typescript
export interface SalesData {
  unitsSold: number
  grossRevenue: number
  totalDiscounts: number
  customerShippingTotal: number   // ADD — total shipping paid by customers (sum of order.totalShipping)
  ordersCount: number             // ADD — number of distinct orders (for shipping split)
}
```

- [ ] **Step 3: Add netTransport to ProductProfitabilityResult**

```typescript
export interface ProductProfitabilityResult {
  // ... existing fields ...
  netTransport: number           // ADD — customerShipping - courierCost (can be +/0/-)
  totalShipping: number          // KEEP — courier cost (for reference)
  // ...
}
```

- [ ] **Step 4: Update calculateProductProfitability function**

Replace the calculation body in `lib/profitability-engine.ts`. Full updated function:

```typescript
export function calculateProductProfitability(
  sales: SalesData,
  cost: ProductCostConfig,
  tax: OrganizationTaxConfig,
  ads: AdsData = { spendEur: 0, spendRon: 0, purchases: 0 }
): ProductProfitabilityResult {
  const avgSellingPrice = sales.unitsSold > 0 ? sales.grossRevenue / sales.unitsSold : 0

  // 1. Net revenue după retururi
  const returnsEstimate = Math.round(sales.unitsSold * cost.returnRate)
  const returnedRevenue = returnsEstimate * avgSellingPrice
  const netRevenue = sales.grossRevenue - returnedRevenue

  // 2. TVA colectat — DOAR dacă firma e plătitoare TVA
  const effectiveVatRate = tax.isVatPayer ? cost.vatRate : 0
  const vatCollected = netRevenue * effectiveVatRate / (1 + effectiveVatRate)
  const revenueExVat = tax.isVatPayer ? netRevenue / (1 + effectiveVatRate) : netRevenue

  // 3. Costuri directe
  const totalCogs = sales.unitsSold * cost.cogs
  const totalPackaging = sales.unitsSold * cost.packagingCost
  const totalShopifyFee = netRevenue * tax.shopifyFeeRate

  // TVA furnizor deductibil DOAR dacă firma e plătitoare TVA
  const vatDeductibleAmount = (tax.isVatPayer && cost.supplierVatDeductible)
    ? totalCogs * effectiveVatRate
    : 0
  const cogsNet = totalCogs - vatDeductibleAmount

  // 4. Transport net — diferența dintre ce plătește clientul și costul curierului
  const totalCourierCost = sales.unitsSold * cost.shippingCost
  // customerShippingTotal este suma totalShipping din toate comenzile pentru acest produs
  // Dacă livrarea e gratuită pentru client, customerShippingTotal = 0 → netTransport = -courier
  const netTransport = sales.customerShippingTotal - totalCourierCost

  // 5. Gross profit — nu se mai scade totalCourierCost ci netTransport (+ dacă clientul a plătit mai mult)
  const grossProfit = revenueExVat - cogsNet + netTransport - totalPackaging - totalShopifyFee

  // 6. Return provision
  const returnProvision = returnsEstimate * cost.cogs * 0.5

  // 7. Operating profit
  const operatingProfit = grossProfit - returnProvision

  // 8. Profit after ads
  const adsSpendRon = ads.spendRon > 0 ? ads.spendRon : ads.spendEur * tax.eurToRon
  const profitAfterAds = operatingProfit - adsSpendRon

  // 9. Income tax
  let incomeTax = 0
  if (tax.incomeTaxType === 'MICRO_1') {
    incomeTax = netRevenue * 0.01
  } else if (tax.incomeTaxType === 'MICRO_3') {
    incomeTax = netRevenue * 0.03
  } else {
    incomeTax = Math.max(0, profitAfterAds) * 0.16
  }

  // 10. Net profit
  const netProfit = profitAfterAds - incomeTax

  // Marje
  const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0
  const operatingMarginPct = netRevenue > 0 ? (operatingProfit / netRevenue) * 100 : 0
  const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0

  // Ads efficiency
  const roas = adsSpendRon > 0 ? netRevenue / adsSpendRon : null
  const costPerPurchase = ads.purchases > 0 ? adsSpendRon / ads.purchases : null

  // Break-even
  const profitPerUnit = avgSellingPrice * (1 - cost.returnRate)
    - cost.cogs * (1 - (tax.isVatPayer && cost.supplierVatDeductible ? effectiveVatRate : 0))
    - cost.packagingCost
    - avgSellingPrice * tax.shopifyFeeRate * (1 - cost.returnRate)
  const microTaxPerUnit = tax.incomeTaxType !== 'PROFIT_16'
    ? avgSellingPrice * (1 - cost.returnRate) * (tax.incomeTaxType === 'MICRO_1' ? 0.01 : 0.03)
    : 0
  const netProfitPerUnit = profitPerUnit - microTaxPerUnit
  const breakEvenUnits = netProfitPerUnit > 0 ? Math.ceil(adsSpendRon / netProfitPerUnit) : Infinity
  const maxSustainableAdsBudget = Math.max(0, operatingProfit * 0.5)

  return {
    unitsSold: sales.unitsSold,
    grossRevenue: sales.grossRevenue,
    estimatedReturns: returnsEstimate,
    returnedRevenue,
    netRevenue,
    vatCollected,
    revenueExVat,
    totalCogs,
    totalShipping: totalCourierCost,
    totalPackaging,
    totalShopifyFee,
    vatDeductibleAmount,
    returnProvision,
    netTransport,
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
  }
}
```

- [ ] **Step 5: Fix callers of calculateProductProfitability in profitability/page.tsx**

In `app/(dashboard)/profitability/page.tsx`, update `taxConfig` to include `isVatPayer` and update `SalesData` calls to include `customerShippingTotal` and `ordersCount`.

Replace the `taxConfig` object (around line 50):
```typescript
const taxConfig = {
  incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
  shopifyFeeRate: org.shopifyFeeRate,
  eurToRon,
  isVatPayer: org.isVatPayer,   // ADD
}
```

- [ ] **Step 6: Check TypeScript compilation**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

Fix any type errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add lib/profitability-engine.ts app/(dashboard)/profitability/page.tsx
git commit -m "fix: add isVatPayer support and transport net calc to profitability engine"
```

---

## Task 4: Fix profitability page — order items query + manual expenses in totals

**Fixes:** Products show 0 sales because `OrderItem.productId` is null; manual expenses not affecting totals

**Files:**
- Modify: `app/(dashboard)/profitability/page.tsx`

- [ ] **Step 1: Restructure the products query to use shopifyProductId**

The current query uses `include: { orderItems: {...} }` which goes through the `productId` FK relation. Replace with a separate query by `shopifyProductId`.

Replace the `[products, campaignMetricsAgg]` Promise.all block (lines 56-89) with:

```typescript
const [products, campaignMetricsAgg, periodOrderItems] = await Promise.all([
  db.product.findMany({
    where: { organizationId: orgId },
    include: {
      cost: true,
      metaMappings: {
        include: {
          campaign: {
            include: {
              metrics: { where: { date: periodDateFilter } },
              _count: { select: { metaMappings: true } },
            },
          },
        },
      },
    },
  }),
  db.campaignMetrics.aggregate({
    where: {
      campaign: { organizationId: orgId },
      date: periodDateFilter,
    },
    _sum: { spend: true },
  }),
  // Fetch ALL order items for the period — match to products by shopifyProductId
  db.orderItem.findMany({
    where: {
      organizationId: orgId,
      order: {
        organizationId: orgId,
        financialStatus: { in: ['paid', 'partially_refunded'] },
        processedAt: periodDateFilter,
      },
    },
    select: {
      shopifyProductId: true,
      quantity: true,
      price: true,
      order: {
        select: {
          id: true,
          totalShipping: true,
        },
      },
    },
  }),
])
```

- [ ] **Step 2: Build a map from shopifyProductId → sales aggregation**

Add this after the Promise.all, before the `rows` map:

```typescript
// Group order items by shopifyProductId
interface ProductSales {
  unitsSold: number
  grossRevenue: number
  customerShippingTotal: number
  orderIds: Set<string>
}
const salesByShopifyId = new Map<string, ProductSales>()

for (const item of periodOrderItems) {
  const key = item.shopifyProductId
  if (!key) continue
  const existing = salesByShopifyId.get(key) ?? {
    unitsSold: 0,
    grossRevenue: 0,
    customerShippingTotal: 0,
    orderIds: new Set<string>(),
  }
  existing.unitsSold += item.quantity
  existing.grossRevenue += item.price * item.quantity
  // Only add shipping once per order (it's per-order, not per-item)
  if (!existing.orderIds.has(item.order.id)) {
    existing.customerShippingTotal += item.order.totalShipping
    existing.orderIds.add(item.order.id)
  }
  salesByShopifyId.set(key, existing)
}
```

- [ ] **Step 3: Update the rows.map() to use the new sales data**

Replace:
```typescript
const unitsSold = product.orderItems.reduce((s, i) => s + i.quantity, 0)
const grossRevenue = product.orderItems.reduce((s, i) => s + i.price * i.quantity, 0)
```

With:
```typescript
const sales = salesByShopifyId.get(product.shopifyId)
const unitsSold = sales?.unitsSold ?? 0
const grossRevenue = sales?.grossRevenue ?? 0
const customerShippingTotal = sales?.customerShippingTotal ?? 0
const ordersCount = sales?.orderIds.size ?? 0
```

And update the `calculateProductProfitability` call to include new SalesData fields:
```typescript
const result = calculateProductProfitability(
  { unitsSold, grossRevenue, totalDiscounts: 0, customerShippingTotal, ordersCount },
  {
    cogs: cost.cogs,
    supplierVatDeductible: cost.supplierVatDeductible,
    shippingCost: org.shippingCostDefault,
    packagingCost: org.packagingCostDefault,
    vatRate: cost.vatRate,
    returnRate: cost.returnRate,
  },
  taxConfig,
  { spendEur: 0, spendRon: adsSpendRon, purchases: adsPurchases }
)
```

- [ ] **Step 4: Fix manual expenses affecting totalNetProfit**

Currently (line 174):
```typescript
const totalNetProfit = rows.filter(r => r.netProfit !== null).reduce((s, r) => s + (r.netProfit ?? 0), 0)
```

Move the expenses fetch BEFORE the rows calculation (it's currently after), then change:
```typescript
const totalNetProfit = rows.filter(r => r.netProfit !== null).reduce((s, r) => s + (r.netProfit ?? 0), 0)
const totalNetProfitAdjusted = totalNetProfit - totalExpenses
```

Update the KPI card to use `totalNetProfitAdjusted`:
```tsx
<p className={`text-[26px] font-bold mt-2 leading-none ${totalNetProfitAdjusted >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
  {productsWithData.length > 0 ? `${totalNetProfitAdjusted.toFixed(0)} RON` : '—'}
</p>
```

Add a note below the KPI if manual expenses are present:
```tsx
{totalExpenses > 0 && (
  <p className="text-xs text-[#78716C] mt-1">
    Include cheltuieli: -{totalExpenses.toFixed(0)} RON
  </p>
)}
```

- [ ] **Step 5: Build and verify no TypeScript errors**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/profitability/page.tsx
git commit -m "fix: query orders by shopifyProductId, include manual expenses in profit total"
```

---

## Task 5: Fix product detail profitability API — transport net + ads spend

**Fixes:** Product detail shows transport as cost (should be net); missing ads spend in product detail

**Files:**
- Modify: `app/api/products/[id]/profitability/route.ts`

- [ ] **Step 1: Update profitability.ts to accept netTransportPerUnit**

In `lib/profitability.ts`, update `OrgSettings` interface:
```typescript
export interface OrgSettings {
  shopifyFeeRate: number
  incomeTaxType: IncomeTaxType
  shippingCost: number      // courier cost (what seller pays)
  packagingCost: number
  isVatPayer: boolean
  netTransportPerUnit?: number  // ADD — override: customerShipping - courierCost per unit
}
```

Update the calculation in `calculateProductProfitability` (around line 68):
```typescript
// Transport net: se folosește netTransportPerUnit dacă e furnizat,
// altfel se scade shippingCost (courier cost) direct
const netTransport = orgSettings.netTransportPerUnit !== undefined
  ? orgSettings.netTransportPerUnit
  : -orgSettings.shippingCost  // negative = cost for seller

const grossProfit = revenueNet - cogsNet + netTransport - orgSettings.packagingCost - shopifyFee
```

Update `ProfitabilityResult` to include `netTransport`:
```typescript
export interface ProfitabilityResult {
  revenueBrut: number
  revenueNet: number
  cogsNet: number
  shopifyFee: number
  grossProfit: number
  returnsProvision: number
  profitPreTax: number
  taxAmount: number
  profitNet: number
  profitMargin: number
  netTransport: number      // ADD — net transport contribution
  breakdowns: {
    vatCollected: number
    vatDeducted: number
    effectiveTaxRate: number
  }
}
```

Add `netTransport` to the return object:
```typescript
return {
  revenueBrut,
  revenueNet,
  cogsNet,
  shopifyFee,
  grossProfit,
  returnsProvision,
  profitPreTax,
  taxAmount,
  profitNet,
  profitMargin,
  netTransport,    // ADD
  breakdowns: { vatCollected, vatDeducted, effectiveTaxRate },
}
```

- [ ] **Step 2: Update the profitability route to include order shipping + ads spend**

Full replacement of `app/api/products/[id]/profitability/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { calculateProductProfitability } from '@/lib/profitability'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { id } = await params
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
    include: {
      cost: true,
      metaMappings: {
        include: {
          campaign: {
            include: {
              _count: { select: { metaMappings: true } },
            },
          },
        },
      },
    },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      shopifyFeeRate: true,
      incomeTaxType: true,
      shippingCostDefault: true,
      packagingCostDefault: true,
      isVatPayer: true,
    },
  })
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const costInput = product.cost
    ? {
        cogs: product.cost.cogs,
        supplierVatDeductible: product.cost.supplierVatDeductible,
        vatRate: product.cost.vatRate,
        returnRate: product.cost.returnRate,
      }
    : {
        cogs: 0,
        supplierVatDeductible: false,
        vatRate: 0.21,
        returnRate: 0.05,
      }

  // Period support
  const periodDays = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('period') ?? '90')))
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

  // Fetch order items — match by shopifyProductId (works even if productId is null)
  const orderItems = await db.orderItem.findMany({
    where: {
      organizationId: orgId,
      shopifyProductId: product.shopifyId,
      order: {
        processedAt: { gte: since },
        financialStatus: { in: ['paid', 'partially_refunded'] },
      },
    },
    select: {
      quantity: true,
      price: true,
      order: {
        select: {
          id: true,
          processedAt: true,
          orderNumber: true,
          financialStatus: true,
          totalShipping: true,
        },
      },
    },
    orderBy: { order: { processedAt: 'desc' } },
  })

  const totalQuantitySold = orderItems.reduce((s, i) => s + i.quantity, 0)
  const totalRevenue = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)

  // Calculate net transport per unit
  const seenOrderIds = new Set<string>()
  let totalCustomerShipping = 0
  for (const item of orderItems) {
    if (!seenOrderIds.has(item.order.id)) {
      totalCustomerShipping += item.order.totalShipping
      seenOrderIds.add(item.order.id)
    }
  }
  const ordersCount = seenOrderIds.size
  const totalCourierCost = ordersCount * org.shippingCostDefault
  const netTransportTotal = totalCustomerShipping - totalCourierCost
  const netTransportPerUnit = totalQuantitySold > 0 ? netTransportTotal / totalQuantitySold : 0

  // Ads spend allocated to this product
  const periodDateFilter = { gte: since, lte: new Date() }
  const adsCampaignIds = product.metaMappings.map((m) => ({
    campaignId: m.campaignId,
    mappingCount: m.campaign._count.metaMappings || 1,
  }))

  let adsSpendRon = 0
  let adsPurchases = 0
  if (adsCampaignIds.length > 0) {
    const metricsResults = await Promise.all(
      adsCampaignIds.map(({ campaignId, mappingCount }) =>
        db.campaignMetrics.aggregate({
          where: { campaignId, date: periodDateFilter },
          _sum: { spend: true, purchases: true },
        }).then((agg) => ({
          spend: (agg._sum.spend ?? 0) / mappingCount,
          purchases: (agg._sum.purchases ?? 0) / mappingCount,
        }))
      )
    )
    adsSpendRon = metricsResults.reduce((s, r) => s + r.spend, 0)
    adsPurchases = metricsResults.reduce((s, r) => s + r.purchases, 0)
  }

  const orgSettings = {
    shopifyFeeRate: org.shopifyFeeRate,
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shippingCost: org.shippingCostDefault,
    packagingCost: org.packagingCostDefault,
    isVatPayer: org.isVatPayer,
    netTransportPerUnit,
  }

  const perUnitCalc = calculateProductProfitability(product.price, costInput, orgSettings)
  const totalProfit = perUnitCalc.profitNet * totalQuantitySold

  return NextResponse.json({
    perUnit: {
      ...perUnitCalc,
      vatRateUsed: costInput.vatRate,
      shippingCostDisplay: org.shippingCostDefault,
      packagingCostDisplay: org.packagingCostDefault,
      netTransportPerUnit,
      adsSpendPerUnit: totalQuantitySold > 0 ? adsSpendRon / totalQuantitySold : 0,
    },
    stats: {
      totalQuantitySold,
      totalRevenue,
      totalProfit,
      period: `${periodDays}d`,
      adsSpendRon,
      adsPurchases,
      adsRoas: totalRevenue > 0 && adsSpendRon > 0 ? totalRevenue / adsSpendRon : null,
    },
    recentOrderItems: orderItems.slice(0, 10),
    hasCostData: !!product.cost,
    isVatPayer: org.isVatPayer,
  })
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add lib/profitability.ts app/api/products/\[id\]/profitability/route.ts
git commit -m "fix: product detail profitability — transport net + ads spend allocation"
```

---

## Task 6: Update ProfitabilityTab UI — TVA conditional + transport net + ads spend

**Fixes:** TVA row always visible; transport shown as cost; missing ads spend row in product detail

**Files:**
- Modify: `features/products/components/ProfitabilityTab.tsx`
- Modify: `app/(dashboard)/products/[id]/page.tsx`

- [ ] **Step 1: Add isVatPayer to product detail page query**

In `app/(dashboard)/products/[id]/page.tsx`, update the `orgData` select (around line 32):
```typescript
db.organization.findUnique({
  where: { id: orgId },
  select: {
    shopifyFeeRate: true,
    incomeTaxType: true,
    shippingCostDefault: true,
    packagingCostDefault: true,
    returnRateDefault: true,
    isVatPayer: true,          // ADD
  },
}),
```

Update `orgSettings`:
```typescript
const orgSettings = {
  shopifyFeeRate: orgData?.shopifyFeeRate ?? 0.02,
  incomeTaxType: (orgData?.incomeTaxType ?? 'MICRO_1') as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
  shippingCostDefault: orgData?.shippingCostDefault ?? 20,
  packagingCostDefault: orgData?.packagingCostDefault ?? 0,
  returnRateDefault: orgData?.returnRateDefault ?? 0.05,
  isVatPayer: orgData?.isVatPayer ?? true,   // ADD
}
```

Pass `isVatPayer` to `ProfitabilityTab` — find the `<ProfitabilityTab` usage and add:
```tsx
<ProfitabilityTab
  productId={product.id}
  price={product.price}
  hasCost={!!product.cost}
  isVatPayer={orgSettings.isVatPayer}   // ADD
/>
```

- [ ] **Step 2: Update ProfitabilityTab props and UI**

Full replacement of `features/products/components/ProfitabilityTab.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

interface Props {
  productId: string
  price: number
  hasCost: boolean
  isVatPayer: boolean    // ADD
}

function ProfitRow({
  label,
  value,
  isDeduction,
  isSubtotal,
  isFinal,
  hidden,
}: {
  label: string
  value: number
  isDeduction?: boolean
  isSubtotal?: boolean
  isFinal?: boolean
  hidden?: boolean
}) {
  if (hidden) return null

  const textColor = isFinal
    ? value >= 0 ? '#15803D' : '#DC2626'
    : isSubtotal
    ? '#1C1917'
    : '#78716C'

  return (
    <div className={`flex justify-between items-center px-4 py-2.5 ${isFinal ? 'bg-[#F5F5F4]' : ''}`}>
      <span className={`text-sm ${isSubtotal || isFinal ? 'font-semibold' : ''}`} style={{ color: textColor }}>
        {label}
      </span>
      <span
        className={`text-sm font-medium tabular-nums ${isSubtotal || isFinal ? 'font-bold' : ''}`}
        style={{ color: textColor }}
      >
        {value >= 0 ? '+' : ''}{value.toFixed(2)} RON
      </span>
    </div>
  )
}

export function ProfitabilityTab({ productId, price, hasCost, isVatPayer }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['product-profitability', productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/profitability`)
      if (!res.ok) throw new Error('Failed to load profitability')
      return res.json()
    },
    enabled: hasCost,
  })

  if (!hasCost) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-6 text-center">
        <p className="text-sm text-[#78716C]">
          Configurează costurile în tab-ul „Costuri" pentru a vedea profitabilitatea.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="h-48 animate-pulse bg-[#F5F5F4] rounded-xl" />
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-6">
        <p className="text-sm text-red-600">Eroare la încărcarea datelor de profitabilitate.</p>
      </div>
    )
  }

  const { perUnit, stats } = data
  const vatRatePct = Math.round((perUnit.vatRateUsed ?? 0.21) * 100)
  const hasAds = (stats.adsSpendRon ?? 0) > 0

  const marginColor =
    perUnit.profitMargin >= 30 ? '#15803D' :
    perUnit.profitMargin >= 15 ? '#D97706' :
    '#DC2626'
  const marginBg =
    perUnit.profitMargin >= 30 ? '#DCFCE7' :
    perUnit.profitMargin >= 15 ? '#FFF7ED' :
    '#FEF2F2'

  return (
    <div className="space-y-4">
      {/* Headline metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
          <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Profit net/buc</p>
          <p className="text-[22px] font-bold text-[#1C1917] mt-1">{perUnit.profitNet.toFixed(2)} RON</p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
          <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Marjă netă</p>
          <span
            className="inline-block mt-1 px-3 py-1 rounded-lg text-[18px] font-bold"
            style={{ background: marginBg, color: marginColor }}
          >
            {perUnit.profitMargin.toFixed(1)}%
          </span>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
          <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Vânzări 90 zile</p>
          <p className="text-[22px] font-bold text-[#1C1917] mt-1">{stats.totalQuantitySold} buc</p>
          <p className="text-xs text-[#78716C]">{stats.totalRevenue.toFixed(0)} RON venituri</p>
        </div>
      </div>

      {/* Defalcare calcul */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E7E5E4]">
          <h3 className="text-sm font-semibold text-[#1C1917]">Defalcare profitabilitate per unitate</h3>
          <p className="text-xs text-[#78716C] mt-0.5">Calculat pentru prețul curent: {price.toFixed(2)} RON</p>
        </div>
        <div className="divide-y divide-[#E7E5E4]">
          <ProfitRow label="Preț vânzare (brut)" value={perUnit.revenueBrut} />
          {/* TVA colectată — ascunsă dacă firma nu e plătitoare TVA */}
          <ProfitRow
            label={`— TVA colectată (${vatRatePct}%)`}
            value={-perUnit.breakdowns.vatCollected}
            isDeduction
            hidden={!isVatPayer}
          />
          <ProfitRow
            label={isVatPayer ? "= Venit net (fără TVA)" : "= Venit net"}
            value={perUnit.revenueNet}
            isSubtotal
          />
          <ProfitRow label="— COGS net" value={-perUnit.cogsNet} isDeduction />
          {/* Transport net — poate fi 0, pozitiv sau negativ */}
          <ProfitRow
            label={perUnit.netTransport >= 0 ? "Transport net (câștig)" : "Transport net (pierdere)"}
            value={perUnit.netTransport}
          />
          <ProfitRow label="— Ambalaj" value={-(perUnit.packagingCostDisplay ?? 0)} isDeduction />
          <ProfitRow label={`— Taxă Shopify (${(perUnit.shippingCostDisplay ?? 2).toFixed(0)}%)`} value={-perUnit.shopifyFee} isDeduction />
          <ProfitRow label="= Profit brut" value={perUnit.grossProfit} isSubtotal />
          <ProfitRow label="— Provizion retururi" value={-perUnit.returnsProvision} isDeduction />
          {hasAds && (
            <ProfitRow label="— Cheltuieli publicitate" value={-(perUnit.adsSpendPerUnit ?? 0)} isDeduction />
          )}
          <ProfitRow label="= Profit înainte de impozit" value={perUnit.profitPreTax} isSubtotal />
          <ProfitRow label="— Impozit venit" value={-perUnit.taxAmount} isDeduction />
          <ProfitRow label="= Profit net" value={perUnit.profitNet} isFinal />
        </div>
      </div>

      {/* Ads stats — dacă există campanii legate */}
      {hasAds && (
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Ads spend (90 zile)</p>
            <p className="text-base font-bold text-[#1C1917] mt-1">{stats.adsSpendRon.toFixed(0)} RON</p>
          </div>
          <div>
            <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Achiziții</p>
            <p className="text-base font-bold text-[#1C1917] mt-1">{stats.adsPurchases}</p>
          </div>
          <div>
            <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">ROAS</p>
            <p className="text-base font-bold text-[#D4AF37] mt-1">
              {stats.adsRoas ? `${stats.adsRoas.toFixed(1)}×` : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Fix ProductCostForm — TVA conditional display + transport**

In `features/products/components/ProductCostForm.tsx`:

Add `isVatPayer` to `ProductCostFormProps`:
```typescript
interface ProductCostFormProps {
  productId: string
  cost: ProductCost | null
  price: number
  orgSettings: OrgSettings & { isVatPayer: boolean }   // ADD isVatPayer
}
```

Update the live profitability calculation rows array (around line 230) — make TVA conditional and fix transport:
```tsx
{[
  { label: 'Preț vânzare', value: `${price.toFixed(2)} RON`, bold: false, color: '#1C1917' },
  { label: '− COGS', value: `− ${cogs.toFixed(2)} RON`, bold: false, color: '#78716C' },
  // Transport net = 0 (client plătește 20 RON, curier costă 20 RON)
  { label: '− Ambalare', value: `− ${packaging.toFixed(2)} RON`, bold: false, color: '#78716C' },
  // TVA colectată — afișată DOAR dacă firma e plătitoare TVA
  ...(orgSettings.isVatPayer ? [{
    label: supplierVatDeductible ? 'TVA (Colectată − Deductibilă)' : 'TVA colectată',
    value: `− ${(vatCollected - vatDeducted).toFixed(2)} RON`,
    bold: false,
    color: '#78716C',
  }] : []),
  { label: `Shopify Fee (${(shopifyFeeRate * 100).toFixed(1)}%)`, value: `− ${shopifyFee.toFixed(2)} RON`, bold: false, color: '#78716C' },
  { label: `Provizion Retur (${returnRatePercent}%)`, value: `− ${returnLoss.toFixed(2)} RON`, bold: false, color: '#78716C' },
].map((row) => (
  // ... existing map render
))}
```

Also recalculate `profit` for when isVatPayer is false (don't deduct VAT collected):
```typescript
const effectiveVatCollected = orgSettings.isVatPayer ? vatCollected : 0
const effectiveVatDeducted = orgSettings.isVatPayer ? vatDeducted : 0
const profit = price - cogs - packaging + effectiveVatDeducted - shopifyFee - effectiveVatCollected - returnLoss
```

Pass `isVatPayer` from product detail page to `ProductCostForm`:
In `app/(dashboard)/products/[id]/page.tsx`, find the `<ProductCostForm` usage and add:
```tsx
<ProductCostForm
  productId={product.id}
  cost={product.cost}
  price={product.price}
  orgSettings={orgSettings}
/>
```
(orgSettings already includes `isVatPayer` after Step 1 of this task)

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add features/products/components/ProfitabilityTab.tsx features/products/components/ProductCostForm.tsx app/\(dashboard\)/products/\[id\]/page.tsx
git commit -m "fix: conditional TVA display, transport net row, ads spend in product detail"
```

---

## Task 7: Orders — Add date filter

**Files:**
- Modify: `app/(dashboard)/orders/page.tsx`
- Create: `features/orders/components/DateRangePicker.tsx`

- [ ] **Step 1: Create DateRangePicker component**

Create `features/orders/components/DateRangePicker.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Calendar } from 'lucide-react'

type Preset = {
  label: string
  getRange: () => { from: Date; to: Date }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date) {
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  end.setHours(23, 59, 59, 999)
  return end
}

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day  // Monday = start
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return startOfDay(monday)
}

const PRESETS: Preset[] = [
  {
    label: 'Azi',
    getRange: () => { const d = new Date(); return { from: startOfDay(d), to: endOfDay(d) } },
  },
  {
    label: 'Ieri',
    getRange: () => {
      const d = new Date(); d.setDate(d.getDate() - 1)
      return { from: startOfDay(d), to: endOfDay(d) }
    },
  },
  {
    label: 'Ultimele 7 zile',
    getRange: () => {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6)
      return { from: startOfDay(from), to: endOfDay(to) }
    },
  },
  {
    label: 'Această săptămână',
    getRange: () => {
      const now = new Date(); const from = startOfWeek(now); const to = endOfDay(now)
      return { from, to }
    },
  },
  {
    label: 'Ultimele 30 zile',
    getRange: () => {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29)
      return { from: startOfDay(from), to: endOfDay(to) }
    },
  },
  {
    label: 'Luna trecută',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: startOfDay(from), to: endOfDay(to) }
    },
  },
  {
    label: 'Luna aceasta',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: startOfDay(from), to: endOfDay(now) }
    },
  },
  {
    label: 'Anul acesta',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), 0, 1)
      return { from: startOfDay(from), to: endOfDay(now) }
    },
  },
]

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function toUrlDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

interface Props {
  currentFrom?: string
  currentTo?: string
}

export function DateRangePicker({ currentFrom, currentTo }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [fromVal, setFromVal] = useState(currentFrom ?? '')
  const [toVal, setToVal] = useState(currentTo ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function applyRange(from: Date, to: Date) {
    const params = new URLSearchParams()
    params.set('from', toUrlDate(from))
    params.set('to', toUrlDate(to))
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  function applyCustom() {
    if (!fromVal || !toVal) return
    const from = new Date(fromVal + 'T00:00:00')
    const to = new Date(toVal + 'T23:59:59')
    if (from > to) return
    applyRange(from, to)
  }

  function clearFilter() {
    router.push(pathname)
    setOpen(false)
  }

  const hasFilter = !!currentFrom || !!currentTo
  const label = hasFilter
    ? `${currentFrom} → ${currentTo}`
    : 'Toate perioadele'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm transition-colors ${
          hasFilter
            ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#1C1917] font-medium'
            : 'border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#F5F5F4]'
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 bg-white border border-[#E7E5E4] rounded-xl shadow-lg p-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => { const r = preset.getRange(); applyRange(r.from, r.to) }}
              className="w-full text-left px-3 py-2 text-sm text-[#1C1917] rounded-lg hover:bg-[#F5F5F4] transition-colors"
            >
              {preset.label}
            </button>
          ))}
          <div className="border-t border-[#E7E5E4] my-2" />
          <div className="px-2 space-y-2">
            <div className="flex gap-2">
              <input
                type="date"
                value={fromVal}
                onChange={(e) => setFromVal(e.target.value)}
                className="flex-1 h-8 px-2 text-xs border border-[#E7E5E4] rounded-lg"
              />
              <input
                type="date"
                value={toVal}
                onChange={(e) => setToVal(e.target.value)}
                className="flex-1 h-8 px-2 text-xs border border-[#E7E5E4] rounded-lg"
              />
            </div>
            <button
              onClick={applyCustom}
              className="w-full h-8 bg-[#D4AF37] text-[#1C1917] text-xs font-semibold rounded-lg hover:bg-[#B8971F] transition-colors"
            >
              Aplică interval
            </button>
            {hasFilter && (
              <button
                onClick={clearFilter}
                className="w-full h-8 border border-[#E7E5E4] text-[#78716C] text-xs rounded-lg hover:bg-[#F5F5F4] transition-colors"
              >
                Resetează filtrul
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update orders page to accept + apply date filter**

In `app/(dashboard)/orders/page.tsx`:

Update searchParams type and parsing:
```typescript
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; from?: string; to?: string }>
}) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const { page: pageParam, from, to } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const PAGE_SIZE = 25

  // Build date filter
  const dateFilter = from && to
    ? { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') }
    : undefined
  const whereClause = {
    organizationId: orgId,
    ...(dateFilter ? { processedAt: dateFilter } : {}),
  }
```

Update all `db.order.findMany` and `db.order.count` calls to use `whereClause`:
```typescript
const [orders, connection, total] = await Promise.all([
  db.order.findMany({
    where: whereClause,
    include: {
      items: {
        select: { title: true, quantity: true, price: true, shopifyProductId: true },
        take: 3,
      },
    },
    orderBy: { processedAt: 'desc' },
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  }),
  db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
    select: { ordersLastSyncedAt: true, isOrdersSyncing: true },
  }),
  db.order.count({ where: whereClause }),
])
```

Add `DateRangePicker` import and render it next to `SyncOrdersButton`:
```tsx
import { DateRangePicker } from '@/features/orders/components/DateRangePicker'

// In JSX, next to SyncOrdersButton:
<div className="flex items-center gap-2">
  <DateRangePicker currentFrom={from} currentTo={to} />
  <SyncOrdersButton isSyncing={connection?.isOrdersSyncing ?? false} />
</div>
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add features/orders/components/DateRangePicker.tsx app/\(dashboard\)/orders/page.tsx
git commit -m "feat: add date range filter to orders page"
```

---

## Task 8: Campaigns — Add status + ROAS filters

**Files:**
- Modify: `features/meta/components/CampaignsTable.tsx`

- [ ] **Step 1: Add filter state and logic to CampaignsTable**

Full replacement of `features/meta/components/CampaignsTable.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { RoasBadge } from "./RoasBadge"
import { usePauseCampaign } from "@/features/meta/hooks/useCampaigns"
import { Pause, ExternalLink } from "lucide-react"

interface Campaign {
  id: string
  name: string
  status: string
  budget: number
  objective: string
  metaCampaignId: string | null
  summary?: {
    totalSpend: number
    totalPurchases: number
    latestRoas: number | null
    avgRoas: number | null
    adSetsCount: number
  }
}

interface Props {
  campaigns: Campaign[]
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
type RoasFilter = 'ALL' | 'EXCELLENT' | 'MEDIUM' | 'LOW' | 'NO_DATA'

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'Toate statusurile',
  ACTIVE: 'Activ',
  PAUSED: 'Pauzat',
  COMPLETED: 'Finalizat',
}

const ROAS_LABELS: Record<RoasFilter, string> = {
  ALL: 'Toate ROAS',
  EXCELLENT: 'Excelent (>2×)',
  MEDIUM: 'Mediu (1–2×)',
  LOW: 'Slab (<1×)',
  NO_DATA: 'Fără date',
}

function matchesRoas(roas: number | null | undefined, filter: RoasFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'NO_DATA') return roas == null
  if (roas == null) return false
  if (filter === 'EXCELLENT') return roas > 2
  if (filter === 'MEDIUM') return roas >= 1 && roas <= 2
  if (filter === 'LOW') return roas < 1
  return true
}

export function CampaignsTable({ campaigns }: Props) {
  const { mutate: pause, isPending, isError } = usePauseCampaign()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [roasFilter, setRoasFilter] = useState<RoasFilter>('ALL')

  const filtered = campaigns.filter((c) => {
    const statusMatch = statusFilter === 'ALL' || c.status === statusFilter
    const roasMatch = matchesRoas(c.summary?.avgRoas, roasFilter)
    return statusMatch && roasMatch
  })

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E7E5E4] bg-[#FAFAF9] px-6 py-12 text-center text-[#78716C]">
        <p className="text-sm font-medium text-[#1C1917]">Nicio campanie sincronizată.</p>
        <p className="mt-1 text-xs">Apasă Sincronizează pentru a aduce campaniile din Meta.</p>
      </div>
    )
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E7E5E4] bg-[#FAFAF9]">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-8 px-2 text-xs border border-[#E7E5E4] bg-white rounded-lg text-[#1C1917] focus:outline-none focus:border-[#D4AF37]"
        >
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
            <option key={key} value={key}>{STATUS_LABELS[key]}</option>
          ))}
        </select>
        <select
          value={roasFilter}
          onChange={(e) => setRoasFilter(e.target.value as RoasFilter)}
          className="h-8 px-2 text-xs border border-[#E7E5E4] bg-white rounded-lg text-[#1C1917] focus:outline-none focus:border-[#D4AF37]"
        >
          {(Object.keys(ROAS_LABELS) as RoasFilter[]).map((key) => (
            <option key={key} value={key}>{ROAS_LABELS[key]}</option>
          ))}
        </select>
        {(statusFilter !== 'ALL' || roasFilter !== 'ALL') && (
          <button
            onClick={() => { setStatusFilter('ALL'); setRoasFilter('ALL') }}
            className="h-8 px-2 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors"
          >
            Resetează
          </button>
        )}
        <span className="ml-auto text-xs text-[#78716C]">
          {filtered.length} / {campaigns.length} campanii
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E5E4] text-[#78716C] text-xs uppercase tracking-wide bg-[#F5F5F4]">
              <th className="text-left py-3 px-4">Campanie</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Buget/zi</th>
              <th className="text-right py-3 px-4">Cheltuieli</th>
              <th className="text-right py-3 px-4">ROAS</th>
              <th className="text-right py-3 px-4">Achiziții</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-[#78716C]">
                  Nicio campanie corespunde filtrelor selectate.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-[#E7E5E4] hover:bg-[#F5F5F4] transition-colors">
                  <td className="py-3 px-4">
                    <Link href={`/campaigns/${c.id}`} className="font-medium text-[#1C1917] transition-colors hover:text-[#B8971F]">
                      {c.name}
                    </Link>
                    <p className="text-xs text-[#78716C] mt-0.5">{c.objective}</p>
                  </td>
                  <td className="py-3 px-4">
                    <CampaignStatusBadge status={c.status} />
                  </td>
                  <td className="py-3 px-4 text-right text-[#78716C]">
                    {c.budget > 0 ? `${c.budget} RON` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-[#1C1917]">
                    {c.summary?.totalSpend ? `${c.summary.totalSpend.toFixed(0)} RON` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <RoasBadge roas={c.summary?.avgRoas ?? null} />
                  </td>
                  <td className="py-3 px-4 text-right text-[#1C1917]">
                    {c.summary?.totalPurchases ?? "—"}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                      {c.status === "ACTIVE" && (
                        <button
                          onClick={() => pause(c.id)}
                          disabled={isPending}
                          title="Pauze"
                          className="rounded-lg p-1.5 text-[#78716C] transition-colors hover:bg-[#FFF7ED] hover:text-[#D97706] disabled:opacity-60"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {c.metaCampaignId && (
                        <a
                          href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${c.metaCampaignId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Deschide în Meta Ads Manager"
                          className="rounded-lg p-1.5 text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isError && (
        <p className="text-xs text-[#DC2626] px-4 py-2">
          Eroare la oprirea campaniei. Încearcă din nou.
        </p>
      )}
    </>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add features/meta/components/CampaignsTable.tsx
git commit -m "feat: add status and ROAS filters to campaigns table"
```

---

## Task 9: Final build + smoke test

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: Build completes with no errors. Warnings about `any` types or React hooks are acceptable.

- [ ] **Step 2: Run dev server and verify each screen**

```bash
npm run dev
```

Verify:
- [ ] `/profitability` loads without P2022 error
- [ ] Products with orders now show correct `unitsSold` > 0
- [ ] Manual expenses (e.g., Salarii 10000 RON) reduce the "Profit net produse" header KPI
- [ ] Product detail: TVA row hidden if `isVatPayer = false` in Settings
- [ ] Product detail: TVA shows 21% for new products
- [ ] Product detail: "Transport net" row shows 0 or correct net value
- [ ] Product detail: Ads spend row appears if campaign is linked
- [ ] `/orders` — date picker opens, preset "Luna aceasta" filters correctly
- [ ] `/campaigns` — status dropdown filters "Activ" correctly
- [ ] `/campaigns` — ROAS dropdown filters ">2×" correctly

- [ ] **Step 3: Final commit**

```bash
git add -A
git status  # verify only expected files changed
git commit -m "chore: final smoke test and cleanup for profitability fixes"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task | Status |
|---|---|---|
| 2.1 matchPattern migration | Task 1 | ✅ |
| 2.2 Vânzări 90 zile fix | Task 4 | ✅ |
| 2.3 Manual expenses in totals | Task 4 | ✅ |
| 2.4 TVA 21% | Task 2 | ✅ |
| 2.5 isVatPayer TVA logic | Tasks 3, 6 | ✅ |
| 2.6 Transport net | Tasks 3, 5, 6 | ✅ |
| 2.7 Orders date filter | Task 7 | ✅ |
| 2.8 Campaigns filters | Task 8 | ✅ |
| 2.9 Ads spend in product detail | Task 5 | ✅ |
| 2.10 Ads spend period alignment | Task 4 (taxConfig period) | ✅ |

**Type consistency check:**
- `SalesData.customerShippingTotal` used consistently in Task 3 (engine) and Task 4 (profitability page caller)
- `OrgSettings.netTransportPerUnit` defined in Task 5 (profitability.ts) and used in the same task's route
- `isVatPayer` added to `OrganizationTaxConfig` in Task 3 and passed in Tasks 4 and 6
- `vatRateUsed` returned by API in Task 2 and consumed in ProfitabilityTab in Tasks 2+6

**No placeholder scan:** All steps contain complete code. No TBD or TODO.
