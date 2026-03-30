'use client'

import { VideoAsset } from '@prisma/client'
import { FileVideo, Image, Music, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const ASSET_ICONS = {
  VIDEO: FileVideo,
  IMAGE: Image,
  AUDIO: Music,
} as const

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function AssetCard({ asset }: { asset: VideoAsset }) {
  const [copied, setCopied] = useState(false)
  const Icon = ASSET_ICONS[asset.assetType as keyof typeof ASSET_ICONS] ?? FileVideo

  async function copyUrl() {
    await navigator.clipboard.writeText(asset.r2Key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-colors">
      {/* Preview area */}
      <div className="relative h-40 bg-muted flex items-center justify-center overflow-hidden">
        {asset.assetType === 'IMAGE' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets/preview?key=${encodeURIComponent(asset.r2Key)}`}
            alt={asset.filename}
            className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : asset.assetType === 'VIDEO' ? (
          <video
            src={`/api/assets/preview?key=${encodeURIComponent(asset.r2Key)}`}
            className="h-full w-full object-cover"
            preload="metadata"
            muted
            playsInline
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
            onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none' }}
          />
        ) : (
          <Icon className="h-12 w-12 text-muted-foreground/50" />
        )}
        <Badge
          className="absolute top-2 left-2 text-xs"
          variant="secondary"
        >
          {asset.assetType}
        </Badge>
      </div>

      <CardContent className="p-3">
        <p className="text-sm font-medium truncate text-foreground" title={asset.filename}>
          {asset.filename}
        </p>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{asset.sizeBytes ? formatBytes(asset.sizeBytes) : '—'}</span>
          <span>{formatDate(asset.createdAt)}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-7 w-full text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={copyUrl}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiat!' : 'Copiază cheie R2'}
        </Button>
      </CardContent>
    </Card>
  )
}
