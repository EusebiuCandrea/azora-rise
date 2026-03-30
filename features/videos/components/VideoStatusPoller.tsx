'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle, Clock, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type RenderStatus = 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED'

interface VideoData {
  id: string
  status: RenderStatus
  template: string
  formats: string[]
  outputUrls: Record<string, string> | null
  createdAt: string
  product: { title: string; imageUrl: string | null }
}

const FORMAT_LABELS: Record<string, string> = {
  '9x16': 'Reels / TikTok',
  '4x5': 'Feed Meta',
  '1x1': 'Pătrat',
  '16x9': 'Landscape',
}

const STATUS_CONFIG: Record<RenderStatus, { icon: React.ElementType; label: string; color: string }> = {
  PENDING: { icon: Clock, label: 'În așteptare', color: 'text-muted-foreground' },
  RENDERING: { icon: Loader2, label: 'Se randează...', color: 'text-primary' },
  DONE: { icon: CheckCircle2, label: 'Finalizat', color: 'text-green-500' },
  FAILED: { icon: XCircle, label: 'Eșuat', color: 'text-destructive' },
}

function nextInterval(attempt: number): number {
  return Math.min(3000 * Math.pow(2, attempt), 30000)
}

export function VideoStatusPoller({ videoId, initialData }: { videoId: string; initialData: VideoData }) {
  const [data, setData] = useState<VideoData>(initialData)
  const [attempt, setAttempt] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const poll = useCallback(async (): Promise<RenderStatus> => {
    try {
      const res = await fetch(`/api/videos/${videoId}`, { cache: 'no-store' })
      if (res.ok) {
        const updated = await res.json()
        setData(updated)
        return updated.status as RenderStatus
      }
    } catch {
      // ignore network errors, keep polling
    }
    return data.status
  }, [videoId, data.status])

  useEffect(() => {
    if (data.status === 'DONE' || data.status === 'FAILED') return

    const startTime = Date.now()
    const MAX_DURATION = 10 * 60 * 1000

    let timeoutId: ReturnType<typeof setTimeout>
    const elapsedTimer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    const schedule = (att: number) => {
      if (Date.now() - startTime > MAX_DURATION) return
      timeoutId = setTimeout(async () => {
        const status = await poll()
        if (status !== 'DONE' && status !== 'FAILED') {
          setAttempt(att + 1)
          schedule(att + 1)
        }
      }, nextInterval(att))
    }

    schedule(attempt)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(elapsedTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.status])

  const { icon: Icon, label, color } = STATUS_CONFIG[data.status]
  const isRendering = data.status === 'RENDERING' || data.status === 'PENDING'

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${color} ${data.status === 'RENDERING' ? 'animate-spin' : ''}`} />
        <div>
          <p className={`text-lg font-semibold ${color}`}>{label}</p>
          {isRendering && elapsed > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {Math.floor(elapsed / 60)}m {elapsed % 60}s trecut · se actualizează automat
            </p>
          )}
        </div>
      </div>

      {/* Indeterminate progress bar for rendering states */}
      {isRendering && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-[slide_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      )}

      {/* Product info */}
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
        {data.product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.product.imageUrl} alt={data.product.title} className="h-12 w-12 rounded object-cover" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">{data.product.title}</p>
          <p className="text-xs text-muted-foreground">{data.template}</p>
        </div>
      </div>

      {/* Output downloads */}
      {data.status === 'DONE' && data.outputUrls && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Descarcă formatele</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(data.outputUrls).map(([format, url]) => (
              <a
                key={format}
                href={`/api/assets/download?key=${encodeURIComponent(url)}`}
                download
                className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-3 hover:border-primary/40 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{FORMAT_LABELS[format] ?? format}</p>
                  <Badge variant="secondary" className="text-xs mt-0.5">{format}</Badge>
                </div>
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Failed state */}
      {data.status === 'FAILED' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive font-medium">Render-ul a eșuat.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Verifică că resursele uploadate sunt accesibile și încearcă din nou.
          </p>
          <Button size="sm" variant="outline" className="mt-3">
            <a href="/videos/new">Crează reclamă nouă</a>
          </Button>
        </div>
      )}
    </div>
  )
}
