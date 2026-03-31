import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { OrdersTable } from '@/features/orders/components/OrdersTable'
import { SyncOrdersButton } from '@/features/orders/components/SyncOrdersButton'
import { DateRangePicker } from '@/features/orders/components/DateRangePicker'
import Link from 'next/link'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; from?: string; to?: string }>
}) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const { page: pageParam, from, to } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const PAGE_SIZE = 25

  const dateFilter = from && to
    ? { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') }
    : undefined
  const whereClause = {
    organizationId: orgId,
    ...(dateFilter ? { processedAt: dateFilter } : {}),
  }

  const [orders, connection, total] = await Promise.all([
    db.order.findMany({
      where: whereClause,
      include: {
        items: {
          select: {
            title: true,
            quantity: true,
            price: true,
            shopifyProductId: true,
          },
          take: 3,
        },
      },
      orderBy: { processedAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.shopifyConnection.findUnique({
      where: { organizationId: orgId },
      select: { ordersLastSyncedAt: true, isOrdersSyncing: true },
    }),
    db.order.count({ where: whereClause }),
  ])

  const paidStatuses = new Set(['paid', 'partially_refunded'])
  const paidOrders = orders.filter((order) => paidStatuses.has(order.financialStatus))
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.totalPrice, 0)
  const potentialRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0)
  const unpaidPotential = potentialRevenue - paidRevenue
  const currency = orders[0]?.currency ?? 'RON'

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  function formatAmount(value: number) {
    return `${new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)} ${currency}`
  }

  return (
    <div className="max-w-[1200px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Comenzi</h1>
          <p className="text-sm text-[#78716C] mt-0.5">
            {total} comenzi sincronizate
            {connection?.ordersLastSyncedAt && (
              <> · Ultima sincronizare: {new Intl.DateTimeFormat('ro', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              }).format(new Date(connection.ordersLastSyncedAt))}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker currentFrom={from} currentTo={to} />
          <SyncOrdersButton isSyncing={connection?.isOrdersSyncing ?? false} />
        </div>
      </div>

      {orders.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#E7E5E4] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#78716C]">Total comenzi plătite</p>
            <p className="mt-2 text-[28px] font-bold leading-none text-[#16A34A]">{formatAmount(paidRevenue)}</p>
            <p className="mt-2 text-xs text-[#78716C]">{paidOrders.length} comenzi încasate sau parțial rambursate</p>
          </div>

          <div className="rounded-xl border border-[#E7E5E4] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#78716C]">Total dacă toate erau plătite</p>
            <p className="mt-2 text-[28px] font-bold leading-none text-[#1C1917]">{formatAmount(potentialRevenue)}</p>
            <p className="mt-2 text-xs text-[#78716C]">Valoarea cumulată a tuturor comenzilor sincronizate</p>
          </div>

          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#A16207]">Diferență neîncasată</p>
            <p className="mt-2 text-[28px] font-bold leading-none text-[#B45309]">{formatAmount(unpaidPotential)}</p>
            <p className="mt-2 text-xs text-[#92690A]">Comenzi încă neplătite, anulate sau rămase în așteptare</p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-12 text-center">
          <p className="text-[#78716C] text-sm">Nu există comenzi sincronizate.</p>
          <p className="text-[#78716C] text-xs mt-1">
            Apasă „Sincronizează comenzi" pentru a prelua comenzile din Shopify.
          </p>
        </div>
      ) : (
        <>
          <OrdersTable orders={orders} />
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E7E5E4] bg-[#FAFAF9] rounded-b-xl text-xs text-[#78716C]">
              <span>Afișate {orders.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)} din {total} comenzi</span>
              <div className="flex items-center gap-1">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="px-3 h-7 flex items-center border border-[#E7E5E4] bg-white rounded-lg hover:bg-[#F5F5F4] transition-colors">
                    ←
                  </Link>
                )}
                <span className="px-3 h-7 flex items-center bg-[#D4AF37] text-[#1C1917] font-semibold rounded-lg">{page}</span>
                {page * PAGE_SIZE < total && (
                  <Link href={pageHref(page + 1)} className="px-3 h-7 flex items-center border border-[#E7E5E4] bg-white rounded-lg hover:bg-[#F5F5F4] transition-colors">
                    →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
