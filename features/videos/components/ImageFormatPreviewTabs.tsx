'use client'

import { useState } from 'react'
import { Download, Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react'

type OutputFormat = '9x16' | '4x5' | '1x1' | '16x9'
type RenderState = 'idle' | 'rendering' | 'done' | 'error'

interface FormatConfig {
  id: OutputFormat
  label: string
  sublabel: string
  width: number
  height: number
  previewW: number
  previewH: number
}

const FORMATS: FormatConfig[] = [
  { id: '9x16',  label: '9:16',  sublabel: 'Stories / Reels', width: 1080, height: 1920, previewW: 36, previewH: 64 },
  { id: '4x5',   label: '4:5',   sublabel: 'Feed',             width: 1080, height: 1350, previewW: 40, previewH: 50 },
  { id: '1x1',   label: '1:1',   sublabel: 'Pătrat',           width: 1080, height: 1080, previewW: 48, previewH: 48 },
  { id: '16x9',  label: '16:9',  sublabel: 'Landscape',        width: 1920, height: 1080, previewW: 64, previewH: 36 },
]

interface ImageFormatPreviewTabsProps {
  imageUrl: string
  filename: string
  assetId: string
  existingRenders?: Record<string, string>
}

export function ImageFormatPreviewTabs({
  imageUrl,
  filename,
  assetId,
  existingRenders = {},
}: ImageFormatPreviewTabsProps) {
  const [activePreview, setActivePreview] = useState<OutputFormat>('4x5')
  const [selected, setSelected] = useState<Set<OutputFormat>>(
    new Set(['9x16', '4x5', '1x1', '16x9'])
  )
  const [renderStates, setRenderStates] = useState<Record<OutputFormat, RenderState>>({
    '9x16': existingRenders['9x16'] ? 'done' : 'idle',
    '4x5':  existingRenders['4x5']  ? 'done' : 'idle',
    '1x1':  existingRenders['1x1']  ? 'done' : 'idle',
    '16x9': existingRenders['16x9'] ? 'done' : 'idle',
  })
  const [downloadUrls, setDownloadUrls] = useState<Record<OutputFormat, string>>({
    '9x16': existingRenders['9x16'] ?? '',
    '4x5':  existingRenders['4x5']  ?? '',
    '1x1':  existingRenders['1x1']  ?? '',
    '16x9': existingRenders['16x9'] ?? '',
  })
  const [errors, setErrors] = useState<Record<OutputFormat, string>>({
    '9x16': '', '4x5': '', '1x1': '', '16x9': '',
  })

  const activeFormat = FORMATS.find((f) => f.id === activePreview)!
  const baseName = filename.replace(/\.[^.]+$/, '')

  const previewHeight = 360
  const previewWidth = Math.round(previewHeight * (activeFormat.width / activeFormat.height))

  function toggleFormat(id: OutputFormat) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  async function renderFormat(fmt: OutputFormat): Promise<void> {
    setRenderStates((s) => ({ ...s, [fmt]: 'rendering' }))
    setErrors((e) => ({ ...e, [fmt]: '' }))
    try {
      const res = await fetch(`/api/render-image/${assetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputFormat: fmt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Eroare')
      setDownloadUrls((d) => ({ ...d, [fmt]: data.downloadUrl }))
      setRenderStates((s) => ({ ...s, [fmt]: 'done' }))
    } catch (err) {
      setErrors((e) => ({ ...e, [fmt]: err instanceof Error ? err.message : 'Eroare' }))
      setRenderStates((s) => ({ ...s, [fmt]: 'error' }))
    }
  }

  async function handleGenerateSelected() {
    const toRender = FORMATS.filter(
      (f) => selected.has(f.id) && renderStates[f.id] !== 'done'
    )
    await Promise.all(toRender.map((f) => renderFormat(f.id)))
  }

  const selectedFormats = FORMATS.filter((f) => selected.has(f.id))
  const doneSelected = selectedFormats.filter((f) => renderStates[f.id] === 'done')
  const renderingAny = FORMATS.some((f) => renderStates[f.id] === 'rendering')
  const allSelectedDone = selectedFormats.every((f) => renderStates[f.id] === 'done')
  const anySelectedNeedsRender = selectedFormats.some((f) => renderStates[f.id] !== 'done')

  return (
    <div className="space-y-6">
      {/* Preview section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] bg-[#F5F5F4] px-2 py-0.5 rounded">
            Previzualizare
          </span>
          <span className="text-[11px] text-[#78716C]">format activ: <span className="font-semibold text-[#1C1917]">{activePreview}</span></span>
        </div>

        {/* Format tabs for preview */}
        <div className="flex items-center gap-1 border-b border-[#E7E5E4]">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActivePreview(f.id)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activePreview === f.id
                  ? 'font-semibold text-[#1C1917] border-[#D4AF37]'
                  : 'text-[#78716C] border-transparent hover:text-[#1C1917]'
              }`}
            >
              {f.label} <span className="hidden sm:inline text-[#A8A29E]">— {f.sublabel}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          {/* Blur background + sharp centered image — mirrors Sharp output */}
          <div
            className="rounded-xl overflow-hidden border border-[#E7E5E4] shadow-sm relative"
            style={{ width: previewWidth, height: previewHeight }}
          >
            {/* Blurred, darkened background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                filter: 'blur(12px) brightness(0.65)',
                transform: 'scale(1.05)',
              }}
            />
            {/* Sharp centered image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={filename}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
        <p className="text-center text-[11px] text-[#78716C]">
          Previzualizare · fundal blur + imagine centrată la {activeFormat.width}×{activeFormat.height}px
        </p>
      </div>

      {/* Format selection */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#1C1917]">Selectează formatele</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FORMATS.map((f) => {
            const isSelected = selected.has(f.id)
            const state = renderStates[f.id]
            const url = downloadUrls[f.id]
            const err = errors[f.id]

            return (
              <div
                key={f.id}
                onClick={() => toggleFormat(f.id)}
                className={`relative cursor-pointer rounded-xl border-2 p-3 transition-all select-none ${
                  isSelected
                    ? state === 'done'
                      ? 'border-green-500 bg-green-50'
                      : state === 'error'
                      ? 'border-red-300 bg-red-50'
                      : 'border-[#D4AF37] bg-[#FFFBEB]'
                    : 'border-[#E7E5E4] bg-white opacity-60'
                }`}
              >
                {/* Selection indicator */}
                <div className="absolute top-2 right-2">
                  {isSelected ? (
                    state === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : state === 'rendering' ? (
                      <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />
                    ) : state === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                    )
                  ) : (
                    <Circle className="w-4 h-4 text-[#D4AF37]" />
                  )}
                </div>

                {/* Aspect ratio preview box — blur bg + sharp centered */}
                <div className="flex justify-center mb-2">
                  <div
                    className="rounded overflow-hidden relative"
                    style={{ width: f.previewW, height: f.previewH }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(4px) brightness(0.65)', transform: 'scale(1.05)' }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                </div>

                <p className="text-xs font-bold text-[#1C1917]">{f.label}</p>
                <p className="text-[10px] text-[#78716C]">{f.sublabel}</p>
                <p className="text-[10px] text-[#A8A29E] font-mono mt-0.5">{f.width}×{f.height}</p>

                {state === 'done' && url && (
                  <div className="mt-2 flex gap-1">
                    <a
                      href={url}
                      download={`${baseName}-${f.id}.jpg`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-1 h-6 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold rounded-lg transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Descarcă
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenderStates((s) => ({ ...s, [f.id]: 'idle' })); setDownloadUrls((d) => ({ ...d, [f.id]: '' })) }}
                      className="px-1.5 h-6 text-[9px] text-[#78716C] hover:text-[#1C1917] border border-[#E7E5E4] rounded-lg transition-colors"
                      title="Re-renderează"
                    >
                      ↺
                    </button>
                  </div>
                )}
                {err && (
                  <p className="text-[9px] text-red-500 mt-1 truncate">{err}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {anySelectedNeedsRender && (
          <button
            onClick={handleGenerateSelected}
            disabled={renderingAny}
            className={`flex items-center gap-2 px-5 h-10 text-sm font-semibold rounded-xl transition-colors ${
              renderingAny
                ? 'bg-[#F5F5F4] text-[#78716C] cursor-not-allowed'
                : 'bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917]'
            }`}
          >
            {renderingAny ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Procesează...</>
            ) : (
              <>Generează {selectedFormats.filter((f) => renderStates[f.id] !== 'done').length} format{selectedFormats.filter((f) => renderStates[f.id] !== 'done').length !== 1 ? 'e' : ''}</>
            )}
          </button>
        )}

        {doneSelected.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {doneSelected.map((f) => (
              <a
                key={f.id}
                href={downloadUrls[f.id]}
                download={`${baseName}-${f.id}.jpg`}
                className="flex items-center gap-1.5 px-3 h-10 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                {f.label}
              </a>
            ))}
          </div>
        )}

        {allSelectedDone && (
          <p className="text-[11px] text-green-700 font-medium">
            ✓ Toate formatele selectate sunt gata
          </p>
        )}
      </div>

      {!allSelectedDone && (
        <p className="text-[11px] text-[#78716C]">Procesarea durează ~2s per format · fișierele sunt disponibile 1h</p>
      )}
    </div>
  )
}
