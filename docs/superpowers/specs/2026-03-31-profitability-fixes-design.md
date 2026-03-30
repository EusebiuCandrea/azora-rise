# Rise — Profitability Fixes & Enhancements Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** 12 fixes across profitability engine, TVA logic, UI filters, and order data

---

## 1. Context

The profitability screen is broken in production due to a missing DB column. Additionally, TVA calculations need updating for the Romanian rate change effective January 1, 2026 (19% → 21%), transport logic is incorrect, manual expenses don't affect totals, and several UI improvements are needed.

---

## 2. Changes

### 2.1 Fix: matchPattern DB migration (CRITICAL — production broken)

**Problem:** `MetaProductMapping.matchPattern` exists in Prisma schema as `String?` but the column was never migrated to the production database. Every query that touches `MetaProductMapping` throws `P2022`.

**Fix:** Create a Prisma migration that adds `matchPattern TEXT` (nullable) to the `MetaProductMapping` table. Deploy immediately.

**Files:** `prisma/migrations/` (new migration)

---

### 2.2 Fix: Vânzări 90 zile = 0 buc

**Problem:** `/api/products/[id]/profitability` queries `OrderItem` filtered by `productId` (internal DB ID). When Shopify sync runs, if a product wasn't yet imported at order time, `productId` is `null` on the `OrderItem`. Result: 0 sales shown even though orders exist.

**Fix:** Extend the query to also match `OrderItem.shopifyProductId` against `Product.shopifyId` when `productId` is null. Use a union approach:

```typescript
// current (broken for unlinked items):
where: { productId: product.id }

// fixed:
where: {
  OR: [
    { productId: product.id },
    { shopifyProductId: product.shopifyId, productId: null }
  ]
}
```

Also backfill `productId` on existing unlinked `OrderItem` records for this org.

**Files:** `app/api/products/[id]/profitability/route.ts`

---

### 2.3 Fix: Cheltuieli manuale nu afectează totaluri profitabilitate

**Problem:** The profitability page header shows `PROFIT NET PRODUSE` and `MARJĂ MEDIE` but does not subtract `manualExpensesTotal` from net profit. Manual expenses are displayed below but isolated.

**Fix:** After summing product net profits, subtract total manual expenses for the **current calendar month** (same as what ExpensesPanel displays — `year: now.year, month: now.month`):

```typescript
const adjustedNetProfit = productNetProfitSum - manualExpensesTotal
const adjustedMargin = netRevenue > 0 ? adjustedNetProfit / netRevenue : 0
```

Display in the header KPIs. Add a note under "PROFIT NET PRODUSE" if manual expenses are present: `"Include cheltuieli manuale: -X RON"`. Note: manual expenses are always for the current month, independent of the days-period selector.

**Files:** `app/(dashboard)/profitability/page.tsx`

---

### 2.4 TVA 21% — Rate update

**Romanian law change:** Standard TVA rate increased from 19% to 21% effective January 1, 2026.

**Changes:**
- `ProductCost.vatRate` default: `0.19` → `0.21` in Prisma schema
- All calculation functions already use `vatRate` from the product record, so existing products with 0.19 will continue to use 0.19 until updated
- Add a migration hint / admin notice: products with `vatRate = 0.19` should be reviewed and updated to 0.21
- Update seed data default

**Formula (unchanged, already correct):**
```
TVA extrasă din preț brut = pretBrut × vatRate / (1 + vatRate)
Preț net fără TVA         = pretBrut / (1 + vatRate)
```

**Files:** `prisma/schema.prisma`, `lib/profitability-engine.ts`, `lib/profitability.ts`

---

### 2.5 TVA logic: Plătitor vs. Neplătitor (`Organization.isVatPayer`)

**Current behavior:** TVA colectată is always calculated and displayed, regardless of `isVatPayer`.

**Correct behavior:**

| Scenario | TVA colectată | Venit net | COGS net |
|---|---|---|---|
| `isVatPayer = true` | `pretVanzare × vatRate / (1 + vatRate)` | `pretVanzare / (1 + vatRate)` | `cogs × (1 - vatRate)` if `supplierVatDeductible` |
| `isVatPayer = false` | **0 (hidden)** | `pretVanzare` (full amount) | `cogs` (TVA furnizor is non-deductible cost) |

**UI:** Hide the "TVA colectată" row entirely in product detail and profitability breakdown when `isVatPayer = false`. The organization `isVatPayer` setting is read-only in all calculation contexts — it is only editable in Settings.

**Files:**
- `lib/profitability-engine.ts` — pass `isVatPayer` to calculation
- `lib/profitability.ts` — same
- `app/(dashboard)/products/[id]/page.tsx` — hide TVA row in UI
- `features/profitability/` — hide TVA in profitability breakdown
- `app/(dashboard)/settings/` — only location where `isVatPayer` can be changed

---

### 2.6 Transport — net calculation

**Current behavior:** `shippingCostDefault` is always subtracted as a cost from product revenue, even though the customer pays for shipping separately.

**Correct behavior:** Transport contribution = customer shipping payment - courier cost.

```
netTransport = order.totalShipping - org.shippingCostDefault
```

- `order.totalShipping` = what the customer paid for shipping (stored in `Order.totalShipping`)
- `org.shippingCostDefault` = what the seller pays to the courier
- If `netTransport > 0`: shipping is profitable (customer paid more than courier cost)
- If `netTransport = 0`: shipping is neutral
- If `netTransport < 0`: shipping is subsidized (e.g., free shipping promotion)

**Per-unit approximation** (for per-unit breakdown in product detail):
- Average items per order ≈ `totalItemsInPeriod / ordersInPeriod`
- `netTransportPerUnit = netTransport / avgItemsPerOrder`

**UI label:** Split the current "– Transport & Ambalare" line into two separate lines:
- `"Transport net"` — shows `netTransport` value (can be 0, positive, or negative)
- `"– Ambalaj"` — shows `packagingCost` as a pure cost deduction (unchanged)

Packaging is always a seller cost (customers don't pay extra for packaging), so it is not netted.

**Files:** `lib/profitability-engine.ts`, `lib/profitability.ts`, product detail profitability UI

---

### 2.7 Orders — Date filter

**Current behavior:** Orders page shows all orders with no date filtering.

**New behavior:** Date picker in orders page header with:

**Preset options:**
- Azi
- Ieri
- Ultimele 7 zile
- Această săptămână (luni–duminică curentă)
- Ultimele 30 zile
- Luna trecută
- Luna aceasta
- Anul acesta

**Custom range:** Two date inputs (start, end) with calendar picker.

**Implementation:**
- URL params: `?from=2026-03-01&to=2026-03-31`
- `app/api/orders/route.ts`: add `from`/`to` query params → `processedAt: { gte: from, lte: to }`
- Client component with dropdown + calendar (reuse shadcn Popover + Calendar)
- Default: no filter (show all) — same as current behavior

**Files:** `app/(dashboard)/orders/page.tsx`, `app/api/orders/route.ts`, new `features/orders/components/DateFilter.tsx`

---

### 2.8 Campaigns — Status & ROAS filters

**Current behavior:** All campaigns shown, no filtering.

**New behavior:** Two filter dropdowns above the campaign table.

**Status filter:**
- Toate
- Activ (`ACTIVE`)
- Pauzat (`PAUSED`)
- Finalizat (`COMPLETED`)

**ROAS filter:**
- Toate
- Excelent (>2×)
- Mediu (1–2×)
- Slab (<1×)
- Fără date (no ROAS data)

**Implementation:** Client-side filtering (data already fetched). State via `useState`, no URL params needed.

**Files:** `app/(dashboard)/campaigns/page.tsx`

---

### 2.9 Marketing costs in Product Detail

**Current behavior:** Product detail profitability tab shows per-unit breakdown without ads costs.

**New behavior:** Include allocated ads spend in product detail profitability:

```typescript
adsSpendAllocated = sum(
  campaign.metrics (filtered by period).spend / campaign.metaMappings.length
  for each MetaProductMapping linked to this product
)
```

Display in the profitability breakdown:
```
= Profit brut
– Cheltuieli publicitate (ads)   -X.XX RON
= Profit înainte de impozit
```

If no campaign is linked to the product: row is hidden.

**Files:** `app/api/products/[id]/profitability/route.ts`, product detail profitability UI

---

### 2.10 Ads spend period alignment

**Current behavior:** "CHELTUIELI ADS — Total Meta Ads · 30 zile" is hardcoded to 30 days from today, independent of the period selector on profitability page.

**Fix:** Align ads spend period with the selected profitability period (30/60/90 days). The header KPI label should reflect the actual period: "Total Meta Ads · {days} zile".

**Files:** `app/(dashboard)/profitability/page.tsx`

---

## 3. Data model changes

| Change | Type | Migration needed |
|---|---|---|
| `MetaProductMapping.matchPattern` already in schema | Schema exists, DB missing | YES — add column |
| `ProductCost.vatRate` default 0.19 → 0.21 | Schema default change | YES — update default |
| No new models needed | — | — |

---

## 4. Out of scope

- Changing `isVatPayer` from anywhere other than Settings
- OSS/IOSS for cross-border EU sales
- e-Factura integration
- Backfilling historical snapshots with new TVA rate

---

## 5. Testing criteria

- [ ] Profitability page loads in production (matchPattern fix)
- [ ] Product with orders shows correct count in "Vânzări 90 zile"
- [ ] Manual expenses subtract from net profit in header
- [ ] Non-VAT payer org: "TVA colectată" row hidden everywhere
- [ ] Product with vatRate 0.21 calculates correctly
- [ ] Transport net = 0 when customer pays same as courier
- [ ] Orders date filter works for all presets and custom range
- [ ] Campaign status filter correctly shows/hides campaigns
- [ ] Campaign ROAS filter correctly categorizes
- [ ] Product detail shows ads spend if campaign linked, hidden if not
