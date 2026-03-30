'use client'

import { useQuery } from '@tanstack/react-query'

interface Props {
  productId: string
  price: number
  hasCost: boolean
}

function ProfitRow({
  label,
  value,
  isDeduction,
  isSubtotal,
  isFinal,
}: {
  label: string
  value: number
  isDeduction?: boolean
  isSubtotal?: boolean
  isFinal?: boolean
}) {
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

export function ProfitabilityTab({ productId, price, hasCost }: Props) {
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
          <ProfitRow label="— TVA colectată (19%)" value={-perUnit.breakdowns.vatCollected} isDeduction />
          <ProfitRow label="= Venit net (fără TVA)" value={perUnit.revenueNet} isSubtotal />
          <ProfitRow label="— COGS net" value={-perUnit.cogsNet} isDeduction />
          <ProfitRow label="— Transport" value={-(perUnit.shippingCostDisplay ?? 0)} isDeduction />
          <ProfitRow label="— Ambalaj" value={-(perUnit.packagingCostDisplay ?? 0)} isDeduction />
          <ProfitRow label="— Taxă Shopify (2%)" value={-perUnit.shopifyFee} isDeduction />
          <ProfitRow label="= Profit brut" value={perUnit.grossProfit} isSubtotal />
          <ProfitRow label="— Provizion retururi" value={-perUnit.returnsProvision} isDeduction />
          <ProfitRow label="= Profit înainte de impozit" value={perUnit.profitPreTax} isSubtotal />
          <ProfitRow label="— Impozit venit" value={-perUnit.taxAmount} isDeduction />
          <ProfitRow label="= Profit net" value={perUnit.profitNet} isFinal />
        </div>
      </div>
    </div>
  )
}
