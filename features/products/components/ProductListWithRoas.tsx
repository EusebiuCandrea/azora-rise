import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import type { Product, ProductCost } from '@prisma/client'

interface Props {
  products: (Product & { cost: ProductCost | null })[]
  actualRoas: number | null
}

export function computeMargin(price: number, cost: ProductCost) {
  const totalCost = cost.cogs
  const vatDeducted = cost.supplierVatDeductible ? totalCost * cost.vatRate : 0
  const shopifyFee = price * 0.02
  const vatCollected = price * cost.vatRate / (1 + cost.vatRate)
  const returnLoss = cost.cogs * cost.returnRate * 0.5
  const profit = price - totalCost + vatDeducted - shopifyFee - vatCollected - returnLoss
  return profit / price
}

function marginBadge(price: number, cost: ProductCost | null) {
  if (!cost || cost.cogs === 0) return <span className="text-sm text-[#78716C]">—</span>
  const m = computeMargin(price, cost) * 100
  if (m >= 40) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">{m.toFixed(1)}%</span>
  if (m >= 20) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FFF7ED] text-[#D97706]">{m.toFixed(1)}%</span>
  return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF2F2] text-[#DC2626]">{m.toFixed(1)}%</span>
}

function requiredRoasBadge(price: number, cost: ProductCost | null, actualRoas: number | null) {
  if (!cost || cost.cogs === 0) {
    return (
      <div>
        <span className="text-sm text-[#C4C0BA]">—</span>
        <p className="text-[10px] text-[#C4C0BA] mt-0.5">fără costuri</p>
      </div>
    )
  }

  const marginPct = computeMargin(price, cost)
  if (marginPct <= 0) {
    return (
      <div>
        <span className="text-sm font-semibold text-[#DC2626]">∞</span>
        <p className="text-[10px] text-[#DC2626] mt-0.5">marjă negativă</p>
      </div>
    )
  }

  const required = 1 / marginPct

  // Color: compare required vs actual store ROAS
  let color = '#78716C' // gray — no actual data
  let statusText = 'fără date ads'
  if (actualRoas != null) {
    if (actualRoas > required + 0.3) {
      color = '#15803D'       // green — profitable
      statusText = 'profitabil'
    } else if (actualRoas >= required - 0.5) {
      color = '#D97706'       // orange — borderline
      statusText = 'la limită'
    } else {
      color = '#DC2626'       // red — unprofitable
      statusText = 'neprofitabil'
    }
  }

  return (
    <div>
      <span className="text-sm font-semibold" style={{ color }}>{required.toFixed(1)}×</span>
      <p className="text-[10px] mt-0.5" style={{ color: color === '#78716C' ? '#C4C0BA' : color }}>
        {statusText}
      </p>
    </div>
  )
}

export function ProductListWithRoas({ products, actualRoas }: Props) {
  if (products.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F5F5F4] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#78716C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#1C1917]">Nu există produse sincronizate</p>
          <p className="text-sm text-[#78716C] mt-1">Conectează Shopify-ul în Setări pentru a importa produsele.</p>
          <Link
            href="/settings"
            className="mt-4 px-4 py-2 bg-[#D4AF37] text-[#1C1917] text-sm font-semibold rounded-lg hover:bg-[#B8971F] transition-colors"
          >
            Mergi la Setări
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F5F5F4] border-b border-[#E7E5E4]">
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">Produs</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">Preț</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">Cost configurat</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">Marjă</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">
              ROAS necesar
              <span className="ml-1 text-[9px] font-normal normal-case text-[#C4C0BA]" title="ROAS minim pentru ca reclama să fie profitabilă pentru acest produs">?</span>
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="border-b border-[#E7E5E4] last:border-0 hover:bg-[#FAFAF9] transition-colors"
              style={{ height: 56 }}
            >
              {/* Product */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-10 h-10 rounded-lg border border-[#E7E5E4] object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1C1917] truncate max-w-[220px]">{product.title}</p>
                    <p className="text-xs text-[#78716C] truncate">/{product.handle}</p>
                  </div>
                </div>
              </td>

              {/* Price */}
              <td className="px-4 py-3 text-sm text-[#1C1917]">{product.price.toFixed(0)} RON</td>

              {/* Cost configured */}
              <td className="px-4 py-3">
                {product.cost ? (
                  <span className="flex items-center gap-1.5 text-sm text-[#16A34A]">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Configurat
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-[#78716C]">
                    <Minus className="w-3.5 h-3.5" strokeWidth={2} />
                    —
                  </span>
                )}
              </td>

              {/* Margin */}
              <td className="px-4 py-3">{marginBadge(product.price, product.cost)}</td>

              {/* Required ROAS */}
              <td className="px-4 py-3">
                {requiredRoasBadge(product.price, product.cost, actualRoas)}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                {product.status === 'active' ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">Activ</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F4] text-[#78716C]">Inactiv</span>
                )}
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <Link
                  href={`/products/${product.id}`}
                  className="inline-flex items-center whitespace-nowrap rounded-lg border border-[#E7E5E4] px-2.5 py-1 text-xs text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917]"
                >
                  Editează costuri
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  )
}
