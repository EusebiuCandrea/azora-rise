// lib/profitability-engine.ts
// Single source of truth pentru calculul profitabilității

export interface ProductCostConfig {
  cogs: number                  // cost achiziție per unitate, RON fără TVA
  supplierVatDeductible: boolean // furnizor cu factură TVA?
  shippingCost: number          // cost transport per unitate
  packagingCost: number         // cost ambalaj per unitate
  vatRate: number               // TVA colectat (0.19 = 19%)
  returnRate: number            // rata returnărilor (ex: 0.08 = 8%)
}

export interface OrganizationTaxConfig {
  incomeTaxType: 'MICRO_1' | 'MICRO_3' | 'PROFIT_16'
  shopifyFeeRate: number        // ex: 0.02 = 2%
  eurToRon: number              // cursul de schimb aplicabil
  isVatPayer: boolean
  targetProfitMarginPct: number  // ex: 0.20 = 20% profit target
}

export interface SalesData {
  unitsSold: number
  grossRevenue: number          // suma prețurilor cu TVA
  totalDiscounts: number
  customerShippingTotal: number   // total shipping paid by customers (sum of order.totalShipping)
}

export interface AdsData {
  spendEur: number              // cheltuieli Meta în EUR
  spendRon: number              // convertit cu eurToRon (0 dacă folosim spendEur)
  purchases: number             // conversii raportate de Meta
}

export interface ProductProfitabilityResult {
  unitsSold: number
  grossRevenue: number

  estimatedReturns: number      // unitsSold × returnRate
  returnedRevenue: number       // estimatedReturns × avgSellingPrice
  netRevenue: number            // grossRevenue - returnedRevenue

  vatCollected: number          // netRevenue × vatRate / (1 + vatRate)
  revenueExVat: number          // netRevenue / (1 + vatRate)

  totalCogs: number             // unitsSold × cogs
  totalShipping: number         // unitsSold × shippingCost
  totalPackaging: number        // unitsSold × packagingCost
  totalShopifyFee: number       // netRevenue × shopifyFeeRate
  vatDeductibleAmount: number   // totalCogs × vatRate (dacă deductibil)

  returnProvision: number       // returnsEstimate × cogs × 0.5
  netTransport: number           // customerShipping - courierCost (can be +/0/-)

  grossProfit: number           // revenueExVat - cogsNet + netTransport - packaging - shopifyFee
  operatingProfit: number       // grossProfit - returnProvision

  adsSpendRon: number
  profitAfterAds: number        // operatingProfit - adsSpendRon

  incomeTax: number
  netProfit: number             // profitAfterAds - incomeTax

  grossMarginPct: number
  operatingMarginPct: number
  netMarginPct: number

  // Marginal Ratio (Blueprint Spreadsheet)
  productMarginalRatio: number | null  // avgSellingPrice / cogs — validare produs ≥ 2.5
  marginalRatio: number | null         // grossRevenue / (totalCogs + adsSpendRon)

  // Break-Even KPIs (Blueprint Sheet 3)
  cppBe: number | null       // (avgPriceExVat*(1-shopifyFeeRate)) - cogs
  roasBe: number | null      // avgSellingPrice / cppBe
  halfBeCpp: number | null   // cppBe / 2

  // Target KPIs cu profit margin
  cppTarget: number | null    // cppBe - avgSellingPrice*targetProfitMarginPct
  roasTarget: number | null   // avgSellingPrice / cppTarget
  cpatcTarget: number | null  // cppTarget * (0.025/0.06)
  cpulcTarget: number | null  // cppTarget * 0.025
  cpicTarget: number | null   // cppTarget * (0.025/0.045)

  roas: number | null           // netRevenue / adsSpendRon
  costPerPurchase: number | null // adsSpendRon / purchases

  breakEvenUnits: number
  maxSustainableAdsBudget: number
}

/**
 * Calculează profitabilitatea unui produs.
 *
 * FORMULA:
 * 1. netRevenue = grossRevenue - (unitsSold × returnRate × avgPrice)
 * 2. vatCollected = netRevenue × vatRate / (1 + vatRate) — DOAR dacă isVatPayer
 * 3. cogsNet = unitsSold × cogs × (1 - vatRate if deductible and isVatPayer)
 * 4. netTransport = customerShippingTotal - (unitsSold × shippingCost)
 * 5. grossProfit = revenueExVat - cogsNet + netTransport - packaging - shopifyFee
 * 6. returnProvision = returnsEstimate × cogs × 0.5
 * 7. operatingProfit = grossProfit - returnProvision
 * 8. profitAfterAds = operatingProfit - adsSpendRon
 * 9. incomeTax: MICRO_1/3 = netRevenue × rate; PROFIT_16 = max(0, profitAfterAds) × 0.16
 * 10. netProfit = profitAfterAds - incomeTax
 */
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
  // customerShippingTotal = suma totalShipping din comenzi pentru acest produs
  // Dacă livrarea e gratuită pentru client, customerShippingTotal = 0 → netTransport = -courier
  const netTransport = sales.customerShippingTotal - totalCourierCost

  // 5. Gross profit — transport net (nu courier cost)
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

  // Marje — both numerator and denominator use VAT-exclusive values for consistency
  const grossMarginPct = revenueExVat > 0 ? (grossProfit / revenueExVat) * 100 : 0
  const operatingMarginPct = revenueExVat > 0 ? (operatingProfit / revenueExVat) * 100 : 0
  const netMarginPct = revenueExVat > 0 ? (netProfit / revenueExVat) * 100 : 0

  // ── Marginal Ratio ──────────────────────────────────────────────────────────
  const productMarginalRatio = cost.cogs > 0 ? avgSellingPrice / cost.cogs : null
  const marginalRatioDenominator = sales.unitsSold * cost.cogs + adsSpendRon
  const marginalRatio = marginalRatioDenominator > 0
    ? sales.grossRevenue / marginalRatioDenominator
    : null

  // ── Break-Even KPIs (Blueprint Sheet 3: L11, L12, J6) ───────────────────────
  // Blueprint C7 = "Average COGS incl. Shipping Cost" → include all variable costs per unit
  const avgPriceExVat = tax.isVatPayer ? avgSellingPrice / (1 + cost.vatRate) : avgSellingPrice
  const cppBeCalc = avgPriceExVat * (1 - tax.shopifyFeeRate) - (cost.cogs + cost.shippingCost + cost.packagingCost)
  const cppBe = cppBeCalc > 0 ? cppBeCalc : null
  const roasBe = cppBe !== null && cppBe > 0 ? avgSellingPrice / cppBe : null
  const halfBeCpp = cppBe !== null ? cppBe / 2 : null

  // ── Target KPIs cu profit margin (Blueprint Sheet 3: U5-U9) ──────────────────
  // Funnel baseline rates (Blueprint Supreme Ecom KPI Sheet, Sheet 3 inputs):
  // purchase 2.5%, add-to-cart 6%, reached-checkout 4.5%
  const BLUEPRINT_PURCHASE_RATE = 0.025  // 2.5% din vizitatori cumpără
  const BLUEPRINT_ATC_RATE = 0.06        // 6% din vizitatori adaugă în coș
  const BLUEPRINT_CHECKOUT_RATE = 0.045  // 4.5% din vizitatori ajung la checkout

  const cppTargetCalc = cppBe !== null
    ? cppBe - avgSellingPrice * tax.targetProfitMarginPct
    : null
  const cppTarget = cppTargetCalc !== null && cppTargetCalc > 0 ? cppTargetCalc : null
  const roasTarget = cppTarget !== null && cppTarget > 0 ? avgSellingPrice / cppTarget : null
  const cpatcTarget = cppTarget !== null ? cppTarget * (BLUEPRINT_PURCHASE_RATE / BLUEPRINT_ATC_RATE) : null
  const cpulcTarget = cppTarget !== null ? cppTarget * BLUEPRINT_PURCHASE_RATE : null
  const cpicTarget = cppTarget !== null ? cppTarget * (BLUEPRINT_PURCHASE_RATE / BLUEPRINT_CHECKOUT_RATE) : null

  // Ads efficiency
  const roas = adsSpendRon > 0 ? netRevenue / adsSpendRon : null
  const costPerPurchase = ads.purchases > 0 ? adsSpendRon / ads.purchases : null

  // Break-even
  // netTransportPerUnit: per-unit share of net transport (customerShipping - courierCost)
  const netTransportPerUnit = sales.unitsSold > 0 ? netTransport / sales.unitsSold : 0
  const profitPerUnit = avgSellingPrice * (1 - cost.returnRate)
    - cost.cogs * (1 - (tax.isVatPayer && cost.supplierVatDeductible ? effectiveVatRate : 0))
    + netTransportPerUnit
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
  }
}
