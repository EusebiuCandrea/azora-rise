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
}

export interface SalesData {
  unitsSold: number
  grossRevenue: number          // suma prețurilor cu TVA
  totalDiscounts: number
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

  grossProfit: number           // netRevenue - cogsNet
  operatingProfit: number       // grossProfit - shipping - packaging - shopifyFee - returnProvision

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
 * 2. vatCollected = netRevenue × vatRate / (1 + vatRate)
 * 3. cogsNet = unitsSold × cogs × (1 - vatRate if deductible)
 * 4. grossProfit = netRevenue - cogsNet
 * 5. returnProvision = returnsEstimate × cogs × 0.5
 * 6. operatingProfit = grossProfit - shipping - packaging - shopifyFee - returnProvision
 * 7. profitAfterAds = operatingProfit - adsSpendRon
 * 8. incomeTax: MICRO_1/3 = netRevenue × rate; PROFIT_16 = max(0, profitAfterAds) × 0.16
 * 9. netProfit = profitAfterAds - incomeTax
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

  // 2. TVA colectat
  const vatCollected = netRevenue * cost.vatRate / (1 + cost.vatRate)
  const revenueExVat = netRevenue / (1 + cost.vatRate)

  // 3. Costuri directe
  const totalCogs = sales.unitsSold * cost.cogs
  const totalShipping = sales.unitsSold * cost.shippingCost
  const totalPackaging = sales.unitsSold * cost.packagingCost
  const totalShopifyFee = netRevenue * tax.shopifyFeeRate
  const vatDeductibleAmount = cost.supplierVatDeductible ? totalCogs * cost.vatRate : 0
  const cogsNet = totalCogs - vatDeductibleAmount

  // 4. Gross profit
  const grossProfit = netRevenue - cogsNet

  // 5. Return provision (50% din costul mărfii returnate — pierdere parțială)
  const returnProvision = returnsEstimate * cost.cogs * 0.5

  // 6. Operating profit
  const operatingProfit = grossProfit - totalShipping - totalPackaging - totalShopifyFee - returnProvision

  // 7. Profit after ads
  const adsSpendRon = ads.spendRon > 0 ? ads.spendRon : ads.spendEur * tax.eurToRon
  const profitAfterAds = operatingProfit - adsSpendRon

  // 8. Income tax
  // CRITIC: microimpozit se calculează pe REVENUE, nu pe profit!
  let incomeTax = 0
  if (tax.incomeTaxType === 'MICRO_1') {
    incomeTax = netRevenue * 0.01
  } else if (tax.incomeTaxType === 'MICRO_3') {
    incomeTax = netRevenue * 0.03
  } else {
    incomeTax = Math.max(0, profitAfterAds) * 0.16
  }

  // 9. Net profit
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
    - cost.cogs * (1 - (cost.supplierVatDeductible ? cost.vatRate : 0))
    - cost.shippingCost
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
  }
}
