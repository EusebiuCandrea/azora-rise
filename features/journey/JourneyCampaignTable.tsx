import { cn } from '@/lib/utils'
import type { CampaignBreakdownItem } from './types'

function pct(n: number, dec = 1) { return `${(n * 100).toFixed(dec)}%` }
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
function fmtSpend(n: number): string {
  return n > 0 ? `${n.toFixed(0)} RON` : '—'
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activ',
  PAUSED: 'Pausat',
  COMPLETED: 'Finalizat',
  DRAFT: 'Draft',
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
  DRAFT: 'bg-blue-100 text-blue-600',
}

interface Props { campaigns?: CampaignBreakdownItem[] }

export function JourneyCampaignTable({ campaigns }: Props) {
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E7E5E4]">
          <h4 className="text-xl font-semibold text-[#1C1917]">Performanță Campanii</h4>
        </div>
        <p className="px-6 py-8 text-center text-sm text-[#78716C]">
          Nicio campanie cu date în perioada selectată
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#E7E5E4]">
        <h4 className="text-xl font-semibold text-[#1C1917]">Performanță Campanii</h4>
        <p className="text-sm text-[#78716C] mt-1">Doar campaniile active · Impresii și click-uri din Meta Ads · Vizite și comenzi din tracking site</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F5F5F4] text-[#78716C] font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-6 py-4">Campanie</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Impresii</th>
              <th className="px-6 py-4">Click-uri</th>
              <th className="px-6 py-4">CTR</th>
              <th className="px-6 py-4">Cheltuieli</th>
              <th className="px-6 py-4">Vizite</th>
              <th className="px-6 py-4">Comenzi</th>
              <th className="px-6 py-4">Conversie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E5E4]">
            {campaigns.map((c) => (
              <tr key={c.campaignId} className="hover:bg-[#FAFAF9] transition-colors">
                <td className="px-6 py-4 font-medium text-[#1C1917] max-w-[220px]">
                  <span className="block truncate" title={c.name}>{c.name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', STATUS_STYLE[c.status] ?? STATUS_STYLE.DRAFT)}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[#78716C]">{fmtNum(c.impressions)}</td>
                <td className="px-6 py-4 text-[#78716C]">{fmtNum(c.clicks)}</td>
                <td className="px-6 py-4 text-[#78716C]">{c.impressions > 0 ? pct(c.ctr) : '—'}</td>
                <td className="px-6 py-4 text-[#78716C]">{fmtSpend(c.spend)}</td>
                <td className="px-6 py-4 text-[#78716C]">{c.sessions > 0 ? c.sessions : '—'}</td>
                <td className="px-6 py-4 text-[#78716C]">{c.orders > 0 ? c.orders : '—'}</td>
                <td className={cn('px-6 py-4 font-semibold', c.conversionRate > 0.02 ? 'text-green-600' : c.conversionRate > 0 ? 'text-orange-500' : 'text-[#78716C]')}>
                  {c.sessions > 0 ? pct(c.conversionRate) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
