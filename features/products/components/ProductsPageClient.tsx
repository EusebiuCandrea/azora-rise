'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Product, ProductCost } from '@prisma/client'
import { ProductListWithRoas } from './ProductListWithRoas'
import { computeMargin } from './ProductListWithRoas'

interface Props {
  products: (Product & { cost: ProductCost | null })[]
}

interface ProfitabilityData {
  avgRoas: number | null
}

const PAGE_SIZE = 10

export function ProductsPageClient({ products }: Props) {
  const [tab, setTab] = useState<'all' | 'drafts'>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)

  const { data: profitData } = useQuery<ProfitabilityData>({
    queryKey: ['profitability-summary'],
    queryFn: () => fetch('/api/analytics/profitability').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  const actualRoas = profitData?.avgRoas ?? null

  const draftCount = useMemo(
    () => products.filter((p) => p.status !== 'active').length,
    [products]
  )

  const filteredProducts = useMemo(() => {
    let list = products
    if (tab === 'drafts') list = list.filter((p) => p.status !== 'active')
    if (statusFilter === 'active') list = list.filter((p) => p.status === 'active')
    if (statusFilter === 'inactive') list = list.filter((p) => p.status !== 'active')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.handle?.toLowerCase().includes(q) ?? false)
      )
    }
    return list
  }, [products, tab, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  function handleSearch(v: string) { setSearch(v); setPage(1) }
  function handleStatus(v: 'all' | 'active' | 'inactive') { setStatusFilter(v); setPage(1) }
  function handleTab(v: 'all' | 'drafts') { setTab(v); setPage(1) }

  const avgMargin = useMemo(() => {
    const withCost = products.filter((p) => p.cost && p.cost.cogs > 0)
    if (withCost.length === 0) return null
    const sum = withCost.reduce((acc, p) => acc + computeMargin(p.price, p.cost!), 0)
    return (sum / withCost.length) * 100
  }, [products])

  const pageNums = useMemo(() => {
    const max = Math.min(totalPages, 5)
    const start = Math.max(1, Math.min(safePage - 2, totalPages - max + 1))
    return Array.from({ length: max }, (_, i) => start + i)
  }, [totalPages, safePage])

  return (
    <>
      {/* Tab bar + filters */}
      <div className="flex items-center border-b border-[#E7E5E4]">
        <div className="flex items-center gap-6">
          <button
            onClick={() => handleTab('all')}
            className={`pb-3 text-sm -mb-px transition-colors ${
              tab === 'all'
                ? 'font-semibold text-[#1C1917] border-b-2 border-[#D4AF37]'
                : 'text-[#78716C] hover:text-[#1C1917]'
            }`}
          >
            Toate produsele
          </button>
          <button
            onClick={() => handleTab('drafts')}
            className={`pb-3 text-sm -mb-px transition-colors flex items-center gap-1.5 ${
              tab === 'drafts'
                ? 'font-semibold text-[#1C1917] border-b-2 border-[#D4AF37]'
                : 'text-[#78716C] hover:text-[#1C1917]'
            }`}
          >
            Draft-uri
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F5F5F4] text-[#78716C]">
              {draftCount}
            </span>
          </button>
        </div>

        <div className="ml-auto pb-3 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Caută produs..."
            className="h-8 px-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg text-xs text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 w-44"
          />
          <select
            value={statusFilter}
            onChange={(e) => handleStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="h-8 px-3 border border-[#E7E5E4] bg-white rounded-lg text-xs text-[#78716C] hover:bg-[#F5F5F4] transition-colors cursor-pointer focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="all">Status ▾</option>
            <option value="active">Activ</option>
            <option value="inactive">Inactiv</option>
          </select>
          <button
            disabled
            title="Disponibil în curând"
            className="h-8 px-3 border border-[#E7E5E4] bg-white rounded-lg text-xs text-[#78716C] opacity-50 cursor-not-allowed"
          >
            Categorie ▾
          </button>
        </div>
      </div>

      {/* Product table */}
      <ProductListWithRoas products={paginatedProducts} actualRoas={actualRoas} />

      {/* Pagination footer */}
      {filteredProducts.length > 0 && (
        <div className="flex items-center gap-1 text-sm text-[#78716C]">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2.5 py-1 hover:bg-[#F5F5F4] rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ←
          </button>
          {pageNums.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-2.5 py-1 rounded-lg text-xs ${
                n === safePage
                  ? 'bg-[#D4AF37] text-[#1C1917] font-semibold'
                  : 'hover:bg-[#F5F5F4] cursor-pointer'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2.5 py-1 hover:bg-[#F5F5F4] rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            →
          </button>
          <span className="ml-auto text-xs text-[#78716C]">
            {filteredProducts.length} produse în total
          </span>
        </div>
      )}

      {/* Summary chips */}
      {products.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 shadow-sm">
            <p className="text-xs text-[#78716C] mb-1">Marjă medie</p>
            <p className="text-xl font-bold text-[#1C1917]">
              {avgMargin !== null ? `${avgMargin.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 shadow-sm">
            <p className="text-xs text-[#78716C] mb-1">Produse active</p>
            <p className="text-xl font-bold text-[#1C1917]">
              {products.filter((p) => p.status === 'active').length}
            </p>
          </div>
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4">
            <p className="text-xs text-[#D97706] font-medium mb-1">⚠ Alertă costuri</p>
            <p className="text-sm text-[#92690A]">
              {products.filter((p) => !p.cost).length} produse necesită atenție
            </p>
          </div>
        </div>
      )}
    </>
  )
}
