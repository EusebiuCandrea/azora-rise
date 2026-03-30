import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { VideoWizard } from '@/features/videos/components/VideoWizard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewVideoPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const [products, assets] = await Promise.all([
    db.product.findMany({
      where: { organizationId: orgId },
      orderBy: { title: 'asc' },
    }),
    db.videoAsset.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="max-w-[900px]">
      {/* Page header */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/videos"
          className="flex items-center gap-1.5 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </Link>
        <h1 className="text-[22px] font-bold text-[#1C1917]">Creare video nou</h1>
      </div>

      <VideoWizard products={products} assets={assets} />
    </div>
  )
}
