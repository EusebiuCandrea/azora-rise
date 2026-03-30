import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { AssetUploaderSection } from '@/features/videos/components/AssetUploaderSection'
import { Upload, Film, Image as ImageIcon, Music, HardDrive } from 'lucide-react'
import Link from 'next/link'

function AssetCardShell({ asset }: { asset: any }) {
  const isVideo = asset.assetType === 'VIDEO'
  const isAudio = asset.assetType === 'AUDIO'
  const isImage = asset.assetType === 'IMAGE'

  const sizeDisplay = asset.sizeBytes
    ? asset.sizeBytes > 1048576
      ? `${(asset.sizeBytes / 1048576).toFixed(1)} MB`
      : `${(asset.sizeBytes / 1024).toFixed(0)} KB`
    : '—'

  const ext = isVideo ? 'MP4' : isAudio ? 'MP3' : isImage ? 'JPG' : 'FILE'

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden group">
      {/* Preview area */}
      {isVideo && (
        <div className="relative aspect-video flex items-center justify-center bg-[radial-gradient(circle_at_top,#FFF8DB_0%,#FAFAF9_60%,#F5F5F4_100%)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E7E5E4]">
            <svg className="ml-0.5 w-4 h-4 text-[#B8971F]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="absolute bottom-2 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[#78716C] border border-[#E7E5E4]">
            —:--
          </span>
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
          {/* Waveform bars */}
          <div className="flex items-end gap-0.5 h-8">
            {[6, 12, 8, 16, 10, 14, 7, 11, 9, 15, 8, 13].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-sm bg-[#D4AF37]"
                style={{
                  height: h * 2,
                  animation: `bounce ${0.8 + i * 0.1}s infinite alternate`,
                  opacity: 0.7 + i * 0.02,
                }}
              />
            ))}
          </div>
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-[#D4AF37]/20 text-[#92690A] text-[10px] rounded font-medium">
            —:--
          </span>
        </div>
      )}
      {!isVideo && !isImage && !isAudio && (
        <div className="aspect-video bg-[#F5F5F4] flex items-center justify-center">
          <HardDrive className="w-8 h-8 text-[#E7E5E4]" strokeWidth={1} />
        </div>
      )}

      {/* Card body */}
      <div className="p-3">
        <p className="text-sm font-medium text-[#1C1917] truncate">{asset.filename}</p>
        <p className="text-xs text-[#78716C] mt-0.5">{sizeDisplay} · {ext}</p>
        {asset.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {asset.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] border border-[#D4AF37] text-[#92690A]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default async function VideoLibraryPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const assets = await db.videoAsset.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  })

  const videos = assets.filter(a => a.assetType === 'VIDEO')
  const images = assets.filter(a => a.assetType === 'IMAGE')
  const audios = assets.filter(a => a.assetType === 'AUDIO')
  const totalSizeMB = assets.reduce((acc, a) => acc + ((a.sizeBytes as number) ?? 0) / 1048576, 0)

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Biblioteca</h1>
          <p className="mt-1 text-sm text-[#78716C]">Organizează clipuri, imagini și audio pentru toate reclamele create în Rise.</p>
        </div>
        <label className="flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors cursor-pointer">
          <Upload className="w-3.5 h-3.5" strokeWidth={2} />
          Încarcă fișiere
        </label>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#E7E5E4] pb-0">
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

      {/* Stats row */}
      {assets.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-[#78716C]">
          <span>{videos.length} clipuri</span>
          <span>·</span>
          <span>{images.length} imagini</span>
          <span>·</span>
          <span>{audios.length} fișiere audio</span>
          <span>·</span>
          <span>{totalSizeMB.toFixed(1)} GB utilizați</span>
        </div>
      )}

      {/* Upload section */}
      <AssetUploaderSection />

      {/* Asset grid */}
      {assets.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {assets.map((asset) => (
            <AssetCardShell key={asset.id} asset={asset} />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-[#FFFBEB] flex items-center justify-center mb-4">
            <Upload className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-bold text-[#1C1917]">Nicio înregistrare</p>
          <p className="text-sm text-[#78716C] mt-1 max-w-xs">
            Încarcă primul clip pentru a crea video-uri de reclamă
          </p>
          <label className="mt-5 flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" strokeWidth={2} />
            Încarcă fișiere
          </label>
        </div>
      )}
    </div>
  )
}
