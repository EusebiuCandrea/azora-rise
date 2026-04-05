import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LibrarySidebar } from '@/features/videos/components/LibrarySidebar'
import { AssetUploaderSection } from '@/features/videos/components/AssetUploaderSection'
import { Image as ImageIcon, HardDrive, Upload, LayoutTemplate } from 'lucide-react'

function AssetCardShell({ asset }: { asset: any }) {
  const isVideo = asset.assetType === 'VIDEO'
  const isAudio = asset.assetType === 'AUDIO'
  const isImage = asset.assetType === 'IMAGE'

  const sizeDisplay = asset.sizeBytes
    ? asset.sizeBytes > 1048576
      ? `${(asset.sizeBytes / 1048576).toFixed(1)} MB`
      : `${(asset.sizeBytes / 1024).toFixed(0)} KB`
    : '—'

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
      {isVideo && (
        <div className="relative aspect-video flex items-center justify-center bg-[radial-gradient(circle_at_top,#FFF8DB_0%,#FAFAF9_60%,#F5F5F4_100%)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E7E5E4]">
            <svg className="ml-0.5 w-4 h-4 text-[#B8971F]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      {isImage && (
        <div className="aspect-video bg-[#F5F5F4] flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-[#E7E5E4]" strokeWidth={1} />
        </div>
      )}
      {isAudio && (
        <div className="aspect-video bg-[#FFF7ED] flex flex-col items-center justify-center gap-2">
          <span className="text-2xl">🎵</span>
          <div className="flex items-end gap-0.5 h-8">
            {[6, 12, 8, 16, 10, 14, 7, 11, 9, 15].map((h, i) => (
              <div key={i} className="w-1.5 rounded-sm bg-[#D4AF37]" style={{ height: h * 2, opacity: 0.7 }} />
            ))}
          </div>
        </div>
      )}
      {!isVideo && !isImage && !isAudio && (
        <div className="aspect-video bg-[#F5F5F4] flex items-center justify-center">
          <HardDrive className="w-8 h-8 text-[#E7E5E4]" strokeWidth={1} />
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-[#1C1917] truncate">{asset.filename}</p>
        <p className="text-xs text-[#78716C] mt-0.5">{sizeDisplay}</p>
        {isVideo && (
          <Link
            href={`/videos/library/formats/${asset.id}`}
            className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#78716C] hover:text-[#D4AF37] transition-colors"
          >
            <LayoutTemplate className="w-3 h-3" strokeWidth={1.5} />
            Generează formate
          </Link>
        )}
      </div>
    </div>
  )
}

export default async function VideoLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; ad?: string; unassigned?: string }>
}) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const { product: productFilter, ad: adFilter, unassigned } = await searchParams

  // Sidebar data: all products with their ads and asset counts
  const products = await db.product.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      price: true,
      videoAds: {
        select: {
          id: true,
          name: true,
          _count: { select: { assets: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { title: 'asc' },
  })

  // Unassigned count
  const unassignedCount = await db.videoAsset.count({
    where: { organizationId: orgId, adId: null },
  })

  // Total count
  const totalCount = await db.videoAsset.count({
    where: { organizationId: orgId },
  })

  // Assets for main content area
  const assetWhere: any = { organizationId: orgId }
  if (adFilter) {
    assetWhere.adId = adFilter
  } else if (productFilter) {
    assetWhere.ad = { productId: productFilter }
  } else if (unassigned) {
    assetWhere.adId = null
  }

  const assets = await db.videoAsset.findMany({
    where: assetWhere,
    orderBy: { createdAt: 'desc' },
  })

  const videos = assets.filter((a) => a.assetType === 'VIDEO')
  const images = assets.filter((a) => a.assetType === 'IMAGE')
  const audios = assets.filter((a) => a.assetType === 'AUDIO')

  // Heading for content area
  let heading = 'Toate fișierele'
  if (adFilter) {
    const ad = products.flatMap((p) => p.videoAds).find((a) => a.id === adFilter)
    if (ad) heading = ad.name
  } else if (productFilter) {
    const product = products.find((p) => p.id === productFilter)
    if (product) heading = product.title
  } else if (unassigned) {
    heading = 'Neasignate'
  }

  const pickableProducts = products.map((p) => ({
    id: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.price?.toString() ?? null,
  }))

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-bold text-[#1C1917]">Biblioteca</h1>
        <p className="mt-1 text-sm text-[#78716C]">Organizează clipuri, imagini și audio pentru toate reclamele create în Rise.</p>
      </div>

      {/* 2-column layout */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <LibrarySidebar
          products={products}
          totalCount={totalCount}
          unassignedCount={unassignedCount}
          activeProductId={productFilter}
          activeAdId={adFilter}
          activeUnassigned={!!unassigned}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Content header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1C1917]">{heading}</h2>
            <AssetUploaderSection products={pickableProducts} />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-[#E7E5E4]">
            {[
              { label: 'Toate', count: assets.length, active: true },
              { label: 'Clipuri video', count: videos.length },
              { label: 'Imagini', count: images.length },
              { label: 'Audio', count: audios.length },
            ].map((tab) => (
              <button
                key={tab.label}
                className={`pb-3 text-sm flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
                  tab.active
                    ? 'font-semibold text-[#1C1917] border-[#D4AF37]'
                    : 'text-[#78716C] border-transparent hover:text-[#1C1917]'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    tab.active ? 'bg-[#D4AF37] text-[#1C1917]' : 'bg-[#F5F5F4] text-[#78716C]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Asset grid or empty state */}
          {assets.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {assets.map((asset) => (
                <AssetCardShell key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFFBEB] flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-bold text-[#1C1917]">Nicio înregistrare</p>
              <p className="text-sm text-[#78716C] mt-1 max-w-xs">
                Încarcă primul fișier folosind butonul din dreapta sus.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
