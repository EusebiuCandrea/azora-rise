'use client'

import Link from 'next/link'
import { ReturnStatusBadge } from './ReturnStatusBadge'
import type { ReturnRecord } from '../types'

interface Props {
  returns: ReturnRecord[]
}

export function ReturnsTable({ returns }: Props) {
  if (returns.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-12 text-center">
        <p className="text-[#78716C] text-sm">Nu există retururi înregistrate.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E7E5E4] bg-[#FAFAF9]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Nr. retur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Produs</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Tip</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E5E4]">
            {returns.map((r) => (
              <tr key={r.id} className="hover:bg-[#FAFAF9] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#1C1917]">#{r.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-[#78716C]">
                  {new Date(r.createdAt).toLocaleDateString('ro', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-sm text-[#1C1917]">
                  <div>{r.customerName}</div>
                  {r.customerEmail && <div className="text-xs text-[#78716C]">{r.customerEmail}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-[#1C1917] max-w-[160px]">
                  <div className="truncate">{r.productTitle}</div>
                  {r.variantTitle && <div className="text-xs text-[#78716C] truncate">{r.variantTitle}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-[#78716C]">
                  {r.returnType === 'REFUND' ? 'Ramburs' : 'Schimb'}
                </td>
                <td className="px-4 py-3">
                  <ReturnStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/returns/${r.id}`}
                    className="text-sm text-[#D4AF37] hover:underline font-medium"
                  >
                    Vezi detalii
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
