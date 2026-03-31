// rise/lib/profitability.ts

export type IncomeTaxType = 'MICRO_1' | 'MICRO_3' | 'PROFIT_16'

export interface ProductCostInput {
  cogs: number
  supplierVatDeductible: boolean
  vatRate: number       // 0.19 în România
  returnRate: number    // 0.05 = 5%
}

export interface OrgSettings {
  shopifyFeeRate: number   // 0.02 = 2%
  incomeTaxType: IncomeTaxType
  shippingCost: number      // courier cost (what seller pays)
  packagingCost: number     // din Organization.packagingCostDefault
  isVatPayer: boolean       // firmă plătitoare de TVA
  netTransportPerUnit?: number  // override: customerShipping - courierCost per unit
}

export interface ProfitabilityResult {
  revenueBrut: number           // prețul de vânzare cu TVA
  revenueNet: number            // fără TVA colectată
  cogsNet: number               // COGS după deducere TVA furnizor (dacă aplicabil)
  shopifyFee: number            // taxa Shopify
  netTransport: number          // transport net per unitate (customerShipping - courierCost)
  grossProfit: number           // profit brut înainte de provizion retururi
  returnsProvision: number      // provizion retururi
  profitPreTax: number          // profit înainte de impozit
  taxAmount: number             // impozit calculat
  profitNet: number             // profit net final
  profitMargin: number          // % din prețul de vânzare
  breakdowns: {
    vatCollected: number        // TVA colectată la vânzare (informativ)
    vatDeducted: number         // TVA dedusă din COGS (informativ)
    effectiveTaxRate: number    // rata efectivă de impozitare pe vânzare
  }
}

/**
 * Calculează profitabilitatea netă per unitate vândută.
 *
 * @param price    - prețul de vânzare cu TVA (RON)
 * @param cost     - configurația de costuri a produsului
 * @param orgSettings - setările organizației (taxe, tarif Shopify)
 */
export function calculateProductProfitability(
  price: number,
  cost: ProductCostInput,
  orgSettings: OrgSettings
): ProfitabilityResult {
  const { returnRate } = cost
  const { shopifyFeeRate, incomeTaxType } = orgSettings

  // 1. Revenue — dacă firma nu e plătitoare TVA, nu se deduce TVA colectată
  const revenueBrut = price
  const effectiveVatRate = orgSettings.isVatPayer ? cost.vatRate : 0
  const revenueNet = price / (1 + effectiveVatRate)
  const vatCollected = revenueBrut - revenueNet

  // 2. COGS net — TVA furnizor deductibil DOAR dacă firma e plătitoare TVA
  const cogsNet = (orgSettings.isVatPayer && cost.supplierVatDeductible)
    ? cost.cogs / (1 + effectiveVatRate)
    : cost.cogs
  const vatDeducted = cogsNet < cost.cogs ? cost.cogs - cogsNet : 0

  // 3. Taxa Shopify — aplicată pe prețul brut
  const shopifyFee = price * shopifyFeeRate

  // 4. Transport net — pozitiv dacă clientul plătește mai mult decât costul curier, negativ altfel
  const netTransport = orgSettings.netTransportPerUnit !== undefined
    ? orgSettings.netTransportPerUnit
    : -orgSettings.shippingCost

  // 5. Profit brut — transport net și packaging vin din org settings
  const grossProfit = revenueNet - cogsNet + netTransport - orgSettings.packagingCost - shopifyFee

  // 6. Provizion retururi
  const returnsProvision = grossProfit * returnRate

  // 7. Profit înainte de impozit
  const profitPreTax = grossProfit - returnsProvision

  // 8. Impozit
  const taxAmount = calculateTax(incomeTaxType, revenueBrut, profitPreTax)

  // 9. Profit net
  const profitNet = profitPreTax - taxAmount

  // 10. Marjă
  const profitMargin = (profitNet / revenueBrut) * 100

  // 11. Rata efectivă de impozitare
  const effectiveTaxRate = revenueBrut > 0 ? (taxAmount / revenueBrut) * 100 : 0

  return {
    revenueBrut,
    revenueNet,
    cogsNet,
    shopifyFee,
    netTransport,
    grossProfit,
    returnsProvision,
    profitPreTax,
    taxAmount,
    profitNet,
    profitMargin,
    breakdowns: {
      vatCollected,
      vatDeducted,
      effectiveTaxRate,
    },
  }
}

function calculateTax(
  type: IncomeTaxType,
  revenueBrut: number,
  profitPreTax: number
): number {
  switch (type) {
    case 'MICRO_1':
      return revenueBrut * 0.01
    case 'MICRO_3':
      return revenueBrut * 0.03
    case 'PROFIT_16':
      return Math.max(0, profitPreTax * 0.16)
    default:
      return 0
  }
}

/**
 * Calculează profitabilitatea agregată pentru un set de comenzi.
 */
export interface OrderProfitabilityInput {
  quantity: number
  unitPrice: number
  cost: ProductCostInput
}

export function calculateOrderProfitability(
  items: OrderProfitabilityInput[],
  orgSettings: OrgSettings
): { totalRevenue: number; totalProfit: number; avgMargin: number } {
  let totalRevenue = 0
  let totalProfit = 0

  for (const item of items) {
    const result = calculateProductProfitability(item.unitPrice, item.cost, orgSettings)
    totalRevenue += result.revenueBrut * item.quantity
    totalProfit += result.profitNet * item.quantity
  }

  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return { totalRevenue, totalProfit, avgMargin }
}

/**
 * Formatează un rezultat de profitabilitate pentru display în UI.
 */
export function formatProfitability(result: ProfitabilityResult, currency = 'RON') {
  const fmt = (n: number) => `${n.toFixed(2)} ${currency}`
  const pct = (n: number) => `${n.toFixed(1)}%`

  return {
    revenueBrut: fmt(result.revenueBrut),
    revenueNet: fmt(result.revenueNet),
    cogsNet: fmt(result.cogsNet),
    shopifyFee: fmt(result.shopifyFee),
    grossProfit: fmt(result.grossProfit),
    returnsProvision: fmt(result.returnsProvision),
    profitPreTax: fmt(result.profitPreTax),
    taxAmount: fmt(result.taxAmount),
    profitNet: fmt(result.profitNet),
    profitMargin: pct(result.profitMargin),
  }
}
