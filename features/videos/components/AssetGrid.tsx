'use client'

import { VideoAsset } from '@prisma/client'
import { AssetCard } from './AssetCard'
import { FolderOpen } from 'lucide-react'

interface AssetGridProps {
  assets: VideoAsset[]
}

export function AssetGrid({ assets }: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Nicio resursă uploadată încă</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Folosește zona de upload de mai sus pentru a adăuga clipuri, imagini sau audio.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  )
}
