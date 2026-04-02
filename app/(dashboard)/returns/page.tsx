import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { ReturnsTable } from '@/features/returns/components/ReturnsTable'
import { AddReturnButton } from '@/features/returns/components/ReturnsPageClient'
import { ReturnsFilters } from '@/features/returns/components/ReturnsFilters'
import Link from 'next/link'
import type { ReturnStatus, ReturnType } from '@prisma/client'
import type { ReturnRecord } from '@/features/returns/types'

const PAGE_SIZE = 25

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; returnType?: string }>
}) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const { page: pageParam, status, returnType } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))

  const where = {
    organizationId: orgId,
    ...(status ? { status: status as ReturnStatus } : {}),
    ...(returnType ? { returnType: returnType as ReturnType } : {}),
  }

  const [returns, total, stats] = await Promise.all([
    db.return.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.return.count({ where }),
    Promise.all([
      db.return.count({ where: { organizationId: orgId } }),
      db.return.count({ where: { organizationId: orgId, status: 'NEW' } }),
      db.return.count({ where: { organizationId: orgId, status: 'RECEIVED' } }),
      db.return.count({ where: { organizationId: orgId, status: 'COMPLETED' } }),
    ]),
  ])

  const [totalCount, newCount, receivedCount, completedCount] = stats

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (returnType) params.set('returnType', returnType)
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  const statCards = [
    { label: 'Total Retururi', value: totalCount, accent: '#D4AF37', sub: 'toate retururile' },
    { label: 'Noi', value: newCount, accent: '#3B82F6', sub: 'necesită acțiune' },
    { label: 'În Recepționare', value: receivedCount, accent: '#F59E0B', sub: 'verificare în depozit' },
    { label: 'Finalizate', value: completedCount, accent: '#16A34A', sub: 'închise cu succes' },
  ]

  return (
    <div className="max-w-[1200px] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Retururi</h1>
          <p className="text-sm text-[#78716C] mt-0.5">
            Monitorizarea și gestionarea solicitărilor de retur ale clienților
          </p>
        </div>
        <AddReturnButton />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="relative bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm overflow-hidden"
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ background: card.accent }}
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-[#78716C] pl-2">
              {card.label}
            </p>
            <p className="mt-2 text-[32px] font-bold leading-none text-[#1C1917] pl-2">
              {card.value.toLocaleString('ro')}
            </p>
            <p className="mt-1 text-xs text-[#78716C] pl-2">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl px-4 py-3">
        <ReturnsFilters currentStatus={status} currentType={returnType} />
      </div>

      {/* Table */}
      <ReturnsTable returns={returns as ReturnRecord[]} />

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E7E5E4] bg-[#FAFAF9] rounded-b-xl text-xs text-[#78716C]">
          <span>
            Afișate {returns.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, total)} din {total} retururi
          </span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="px-3 h-7 flex items-center border border-[#E7E5E4] bg-white rounded-lg hover:bg-[#F5F5F4] transition-colors"
              >
                ←
              </Link>
            )}
            <span className="px-3 h-7 flex items-center bg-[#D4AF37] text-[#1C1917] font-semibold rounded-lg">
              {page}
            </span>
            {page * PAGE_SIZE < total && (
              <Link
                href={pageHref(page + 1)}
                className="px-3 h-7 flex items-center border border-[#E7E5E4] bg-white rounded-lg hover:bg-[#F5F5F4] transition-colors"
              >
                →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
