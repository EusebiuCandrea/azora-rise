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
  }
}
