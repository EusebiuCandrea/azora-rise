import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { ProductBreakdownItem } from './types'

function pct(n: number) { return `${(n * 100).toFixed(1)}%` }

interface Props { products?: ProductBreakdownItem[] }

export function JourneyProductTable({ products }: Props) {
  const rows = products && products.length > 0 ? products : null

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#E7E5E4]">
        <h4 className="text-xl font-semibold text-[#1C1917]">Performanță per Produs</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F5F5F4] text-[#78716C] font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-6 py-4">Produs</th>
              <th className="px-6 py-4">Vizite</th>
              <th className="px-6 py-4">Scroll%</th>
              <th className="px-6 py-4">Start Form%</th>
              <th className="px-6 py-4">Submit%</th>
              <th className="px-6 py-4">Comenzi</th>
              <th className="px-6 py-4">Abandon%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E5E4]">
            {rows ? rows.map((row) => (
              <tr key={row.productId} className="hover:bg-[#FAFAF9] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {row.imageUrl ? (
                      <Image
                        src={row.imageUrl}
                        alt={row.productName}
                        width={36}
                        height={36}
                        className="rounded-lg object-cover flex-shrink-0 border border-[#E7E5E4]"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] flex-shrink-0" />
                    )}
                    <span className="font-medium text-[#1C1917] max-w-[180px] truncate" title={row.productName}>
                      {row.productName}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[#78716C]">{row.visits.toLocaleString()}</td>
                <td className="px-6 py-4 text-[#78716C]">{pct(row.scrollToForm / Math.max(row.visits, 1))}</td>
                <td className="px-6 py-4 text-[#78716C]">{pct(row.formStarts / Math.max(row.scrollToForm, 1))}</td>
                <td className="px-6 py-4 text-[#78716C]">{pct(row.formSubmits / Math.max(row.formStarts, 1))}</td>
                <td className="px-6 py-4 text-[#78716C]">{row.orders}</td>
                <td className={cn('px-6 py-4 font-semibold', row.abandonRate > 0.6 ? 'text-red-500' : 'text-green-600')}>
                  {pct(row.abandonRate)}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-[#78716C] text-sm">
                  Nicio date disponibile — instalează tracking pe azora-shop
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
