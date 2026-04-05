'use client'

import { useState } from 'react'
import { Package, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PickableProduct {
  id: string
  title: string
  imageUrl: string | null
  price: string | null
}

interface ProductPickerProps {
  products: PickableProduct[]
  selectedId: string | null
  onSelect: (product: PickableProduct) => void
}

export function ProductPicker({ products, selectedId, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState('')

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Caută produs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
        />
      </div>

      <div className="border border-[#E7E5E4] rounded-xl overflow-hidden bg-white max-h-[340px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#78716C]">Niciun produs găsit.</div>
        ) : (
          filtered.map((product) => {
            const active = selectedId === product.id
            return (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#E7E5E4] last:border-0 transition-colors border-l-[3px]',
                  active ? 'bg-[#FFFBEB] border-l-[#D4AF37]' : 'hover:bg-[#FAFAF9] border-l-transparent'
                )}
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.title} className="w-10 h-10 rounded-lg object-cover border border-[#E7E5E4] flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-[#C4C0BA]" strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1917] truncate">{product.title}</p>
                  {product.price && <p className="text-xs text-[#78716C] mt-0.5">{product.price} RON</p>}
                </div>
                {active && (
                  <div className="w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#1C1917]" strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
