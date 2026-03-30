import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Video, Plus, Library } from 'lucide-react'

export default async function VideosPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const videos = await db.productVideo.findMany({
    where: { product: { organizationId: orgId } },
    include: { product: { select: { title: true, imageUrl: true } } },
    orderBy: { createdAt: 'desc' },
  })

  function statusBadge(status: string) {
    if (status === 'DONE') return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">Finalizat</span>
    if (status === 'RENDERING') return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FFF7ED] text-[#D97706]">Se randează</span>
    if (status === 'FAILED') return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF2F2] text-[#DC2626]">Eroare</span>
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F4] text-[#78716C]">Pending</span>
  }

  const formatLabels: Record<string, string> = {
    '9x16': '9:16', '4x5': '4:5', '1x1': '1:1', '16x9': '16:9'
  }

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Video-uri</h1>
          <p className="mt-1 text-sm text-[#78716C]">Configurează, urmărește și refolosește toate materialele video într-un singur loc.</p>
        </div>
        <Link
          href="/videos/new"
          className="flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Creare video nou
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#E7E5E4]">
        <button className="pb-3 text-sm font-semibold text-[#1C1917] border-b-2 border-[#D4AF37] -mb-px">
          Video-uri salvate
        </button>
        <Link
          href="/videos/library"
          className="ml-6 pb-3 text-sm text-[#78716C] hover:text-[#1C1917] border-b-2 border-transparent -mb-px transition-colors flex items-center gap-1.5"
        >
          <Library className="w-3.5 h-3.5" strokeWidth={1.5} />
          Biblioteca
        </Link>
      </div>

      {videos.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-[#F5F5F4] flex items-center justify-center mb-4">
            <Video className="w-7 h-7 text-[#78716C]" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-bold text-[#1C1917]">Niciun video configurat</p>
          <p className="text-sm text-[#78716C] mt-1 max-w-xs">
            Creează primul video pentru un produs Shopify
          </p>
          <Link
            href="/videos/new"
            className="mt-5 flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Creare video nou
          </Link>
        </div>
      ) : (
        /* Video grid */
        <div className="grid grid-cols-2 gap-4">
          {videos.map((video) => {
            const formats = (video.formats as string[]) ?? []
            const relativeTime = new Intl.RelativeTimeFormat('ro', { numeric: 'auto' }).format(
              -Math.round((Date.now() - video.createdAt.getTime()) / 86400000),
              'days'
            )

            return (
              <div key={video.id} className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-5">
                {/* Product info */}
                <div className="flex items-center gap-3 mb-4">
                  {video.product.imageUrl ? (
                    <img src={video.product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-[#E7E5E4] flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1C1917] truncate">{video.product.title}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] bg-[#F5F5F4] text-[#78716C]">
                      {video.template}
                    </span>
                  </div>
                </div>

                {/* Format chips */}
                <div className="flex items-center gap-1.5 mb-4">
                  {formats.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded text-[11px] font-medium border border-[#E7E5E4] text-[#78716C]"
                    >
                      {formatLabels[f] ?? f}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#78716C]">{relativeTime}</span>
                  <div className="flex items-center gap-2">
                    {statusBadge(video.status)}
                    <Link
                      href={`/videos/${video.id}`}
                      className="text-xs text-[#78716C] hover:text-[#1C1917] px-2.5 py-1 border border-[#E7E5E4] rounded-lg hover:bg-[#F5F5F4] transition-colors"
                    >
                      Editează
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
