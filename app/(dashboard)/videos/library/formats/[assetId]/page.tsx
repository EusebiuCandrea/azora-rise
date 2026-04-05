import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { getPresignedDownloadUrl } from '@/lib/r2'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { FormatPreviewTabs } from '@/features/videos/components/FormatPreviewTabs'

const FPS = 30
const DEFAULT_DURATION_SECONDS = 30

export default async function FormatGeneratorPage({
  params,
}: {
  params: Promise<{ assetId: string }>
}) {
  const { assetId } = await params

  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const asset = await db.videoAsset.findFirst({
    where: { id: assetId, organizationId: orgId, assetType: 'VIDEO' },
    select: {
      id: true,
      filename: true,
      r2Key: true,
      durationSeconds: true,
      ad: {
        select: {
          name: true,
          product: { select: { title: true } },
        },
      },
    },
  })
  if (!asset) notFound()

  const videoUrl = await getPresignedDownloadUrl(asset.r2Key)
  const durationInFrames = Math.round((asset.durationSeconds ?? DEFAULT_DURATION_SECONDS) * FPS)

  const breadcrumb = asset.ad
    ? `${asset.ad.product.title} / ${asset.ad.name}`
    : 'Neasignat'

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <div>
        <Link
          href="/videos/library"
          className="flex items-center gap-1 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Înapoi la bibliotecă
        </Link>
        <h1 className="text-[22px] font-bold text-[#1C1917]">Generează formate</h1>
        <p className="mt-1 text-sm text-[#78716C]">
          <span className="font-medium text-[#1C1917]">{asset.filename}</span>
          {' · '}
          <span>{breadcrumb}</span>
        </p>
      </div>

      <FormatPreviewTabs
        videoUrl={videoUrl}
        durationInFrames={durationInFrames}
        filename={asset.filename}
        assetR2Key={asset.r2Key}
      />
    </div>
  )
}
