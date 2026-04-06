"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Link2, X, ChevronDown } from "lucide-react"

interface Product {
  id: string
  title: string
  imageUrl: string | null
}

interface Props {
  campaignId: string
  linkedProduct: Product | null
  products: Product[]
}

export function CampaignProductLink({ campaignId, linkedProduct, products }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function link(productId: string) {
    setLoading(true)
    setOpen(false)
    await fetch(`/api/meta/campaigns/${campaignId}/product-mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    })
    setLoading(false)
    router.refresh()
  }

  async function unlink() {
    if (!linkedProduct) return
    setLoading(true)
    await fetch(`/api/meta/campaigns/${campaignId}/product-mapping`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: linkedProduct.id }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="relative">
      {linkedProduct ? (
        <div className="flex items-center gap-2 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg px-3 py-2">
          {linkedProduct.imageUrl && (
            <img src={linkedProduct.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
          )}
          <span className="text-sm text-[#1C1917] font-medium line-clamp-1 flex-1">{linkedProduct.title}</span>
          <button
            onClick={unlink}
            disabled={loading}
            className="text-[#78716C] hover:text-[#DC2626] transition-colors flex-shrink-0"
            title="Elimină legătura"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-[#78716C] border border-dashed border-[#D4D4D0] rounded-lg px-3 py-2 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors w-full"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Asociază produs</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E7E5E4] rounded-xl shadow-lg w-72 max-h-64 overflow-y-auto">
              {products.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[#78716C]">Fără produse disponibile</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => link(p.id)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-[#F5F5F4] text-left transition-colors"
                  >
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                    )}
                    <span className="text-sm text-[#1C1917] line-clamp-2">{p.title}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
