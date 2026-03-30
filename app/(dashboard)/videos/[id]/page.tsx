import { notFound } from 'next/navigation'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { VideoStatusPoller } from '@/features/videos/components/VideoStatusPoller'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function VideoStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const { id } = await params

  const video = await db.productVideo.findFirst({
    where: {
      id,
      product: { organizationId: orgId },
    },
    include: {
      product: { select: { title: true, imageUrl: true } },
    },
  })

  if (!video) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/videos/new"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Status render</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{video.id}</p>
        </div>
      </div>

      <VideoStatusPoller
        videoId={video.id}
        initialData={{
          id: video.id,
          status: video.status as 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED',
          template: video.template,
          formats: video.formats as string[],
          outputUrls: video.outputUrls as Record<string, string> | null,
          createdAt: video.createdAt.toISOString(),
          product: video.product,
        }}
      />
    </div>
  )
}
