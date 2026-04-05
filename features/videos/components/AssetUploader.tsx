'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UploadState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'uploading'; filename: string; progress: number }
  | { phase: 'done'; filename: string }
  | { phase: 'error'; message: string }

interface AssetUploaderProps {
  onUploaded: () => void
  adId?: string
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4']
const MAX_SIZE_MB = 500

export function AssetUploader({ onUploaded, adId }: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>({ phase: 'idle' })

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setState({ phase: 'dragging' })
  }

  function handleDragLeave() {
    setState({ phase: 'idle' })
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  async function uploadFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setState({ phase: 'error', message: 'Tip fișier neacceptat. Sunt permise: MP4, MOV, JPG, PNG, WEBP, MP3, M4A' })
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setState({ phase: 'error', message: `Fișierul depășește limita de ${MAX_SIZE_MB} MB` })
      return
    }

    setState({ phase: 'uploading', filename: file.name, progress: 0 })

    try {
      const res = await fetch('/api/assets/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          ...(adId ? { adId } : {}),
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Eroare la generarea URL-ului de upload')
      }

      const { uploadUrl } = await res.json()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setState({ phase: 'uploading', filename: file.name, progress: Math.round((e.loaded / e.total) * 100) })
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload eșuat (HTTP ${xhr.status})`))
        })
        xhr.addEventListener('error', () => reject(new Error('Eroare de rețea la upload')))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      setState({ phase: 'done', filename: file.name })
      onUploaded()
      setTimeout(() => setState({ phase: 'idle' }), 3000)
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Eroare necunoscută' })
    }
  }

  const isDragging = state.phase === 'dragging'

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
        isDragging ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="sr-only"
        onChange={handleChange}
      />

      {state.phase === 'idle' || state.phase === 'dragging' ? (
        <>
          <Upload className={cn('h-10 w-10 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm font-medium text-foreground">
            Trage fișierul aici sau{' '}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              selectează
            </button>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV, JPG, PNG, WEBP, MP3 · Max {MAX_SIZE_MB} MB
          </p>
        </>
      ) : state.phase === 'uploading' ? (
        <div className="w-full max-w-xs space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-foreground truncate">{state.filename}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state.progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{state.progress}%</p>
        </div>
      ) : state.phase === 'done' ? (
        <div className="space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="text-sm font-medium text-foreground">Upload reușit!</p>
          <p className="text-xs text-muted-foreground truncate">{state.filename}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">Upload eșuat</p>
          <p className="text-xs text-muted-foreground">{state.message}</p>
          <Button size="sm" variant="outline" onClick={() => setState({ phase: 'idle' })}>
            Încearcă din nou
          </Button>
        </div>
      )}
    </div>
  )
}
