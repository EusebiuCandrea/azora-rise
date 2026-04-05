import Link from 'next/link'
import { Package, Video, FolderOpen, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarAd {
  id: string
  name: string
  _count: { assets: number }
}

export interface SidebarProduct {
  id: string
  title: string
  imageUrl: string | null
  videoAds: SidebarAd[]
}

interface LibrarySidebarProps {
  products: SidebarProduct[]
  totalCount: number
  unassignedCount: number
  activeProductId?: string
  activeAdId?: string
}

export function LibrarySidebar({
  products,
  totalCount,
  unassignedCount,
  activeProductId,
  activeAdId,
}: LibrarySidebarProps) {
  const productsWithAssets = products.filter(
    (p) => p.videoAds.some((ad) => ad._count.assets > 0)
  )

  return (
    <nav className="w-56 flex-shrink-0 space-y-0.5">
      {/* All */}
      <Link
        href="/videos/library"
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
          !activeProductId && !activeAdId
            ? 'bg-[#FFFBEB] text-[#1C1917] font-semibold'
            : 'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
        )}
      >
        <FolderOpen className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
        <span className="flex-1 truncate">Toate fișierele</span>
        {totalCount > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
            {totalCount}
          </span>
        )}
      </Link>

      {/* Products */}
      {productsWithAssets.map((product) => {
        const isProductActive = activeProductId === product.id && !activeAdId
        const isExpanded = activeProductId === product.id || product.videoAds.some(ad => ad.id === activeAdId)
        const productAssetCount = product.videoAds.reduce((acc, ad) => acc + ad._count.assets, 0)

        return (
          <div key={product.id}>
            <Link
              href={`/videos/library?product=${product.id}`}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isProductActive
                  ? 'bg-[#FFFBEB] text-[#1C1917] font-semibold'
                  : 'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
              )}
            >
              <Package className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 truncate">{product.title}</span>
              <div className="flex items-center gap-1">
                {productAssetCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
                    {productAssetCount}
                  </span>
                )}
                <ChevronDown className={cn('w-3 h-3 transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')} />
              </div>
            </Link>

            {/* Ads under product */}
            {isExpanded && product.videoAds.filter(ad => ad._count.assets > 0).map((ad) => {
              const isAdActive = activeAdId === ad.id
              return (
                <Link
                  key={ad.id}
                  href={`/videos/library?ad=${ad.id}`}
                  className={cn(
                    'flex items-center gap-2.5 pl-8 pr-3 py-1.5 rounded-lg text-sm transition-colors',
                    isAdActive
                      ? 'bg-[#FFFBEB] text-[#1C1917] font-semibold'
                      : 'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
                  )}
                >
                  <Video className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 truncate text-xs">{ad.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
                    {ad._count.assets}
                  </span>
                </Link>
              )
            })}
          </div>
        )
      })}

      {/* Unassigned */}
      {unassignedCount > 0 && (
        <Link
          href="/videos/library?unassigned=1"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
          )}
        >
          <FolderOpen className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          <span className="flex-1 truncate">Neasignate</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
            {unassignedCount}
          </span>
        </Link>
      )}
    </nav>
  )
}
