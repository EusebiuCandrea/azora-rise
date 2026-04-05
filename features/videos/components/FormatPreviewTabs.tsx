'use client'

import { useState } from 'react'
import { Player } from '@remotion/player'
import { FormatVideo as FormatVideoComponent, FormatVideoProps, OutputFormat } from '@/src/remotion/FormatVideo'
import { Copy, Check, Download, Loader2, ChevronDown, ChevronUp, CheckCircle2, Circle, XCircle } from 'lucide-react'

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

type RenderState = 'idle' | 'rendering' | 'done' | 'error'

interface FormatPreviewTabsProps {
  videoUrl: string
  durationInFrames: number
  filename: string
  assetId: string
  existingRenders?: Record<string, string>
}

export function FormatPreviewTabs({
  videoUrl,
  durationInFrames,
  filename,
  assetId,
  existingRenders = {},
}: FormatPreviewTabsProps) {
  const [activePreview, setActivePreview] = useState<OutputFormat>('9x16')
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
  const [showCli, setShowCli] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  const activeFormat = FORMATS.find((f) => f.id === activePreview)!
  const baseName = filename.replace(/\.[^.]+$/, '')

  const playerHeight = 400
  const playerWidth = Math.round(playerHeight * (activeFormat.width / activeFormat.height))

  const inputProps: FormatVideoProps = { videoUrl, outputFormat: activePreview, durationInFrames }

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
      const res = await fetch(`/api/render/${assetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputFormat: fmt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Eroare la render')
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
    // Sequential for video (heavy FFmpeg) to avoid Railway OOM
    for (const f of toRender) {
      await renderFormat(f.id)
    }
  }

  const cliCommand =
    `npx remotion render src/remotion/index.tsx FormatVideo-${activePreview} ` +
    `out/${baseName}-${activePreview}.mp4 ` +
    `--props '${JSON.stringify(inputProps)}'`

  async function handleCopy() {
    await navigator.clipboard.writeText(cliCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyAll() {
    const commands = FORMATS.filter((f) => selected.has(f.id))
      .map((f) => {
        const props: FormatVideoProps = { videoUrl, outputFormat: f.id, durationInFrames }
        return `npx remotion render src/remotion/index.tsx FormatVideo-${f.id} out/${baseName}-${f.id}.mp4 --props '${JSON.stringify(props)}'`
      })
      .join('\n')
    await navigator.clipboard.writeText(commands)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
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
          <div
            className="rounded-xl overflow-hidden border border-[#E7E5E4] shadow-sm bg-black"
            style={{ width: playerWidth, height: playerHeight }}
          >
            <Player
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              component={FormatVideoComponent as any}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              compositionWidth={activeFormat.width}
              compositionHeight={activeFormat.height}
              fps={30}
              style={{ width: playerWidth, height: playerHeight }}
              controls
              loop
            />
          </div>
        </div>
      </div>

      {/* Format selection cards */}
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

                {/* Aspect ratio thumbnail */}
                <div className="flex justify-center mb-2">
                  <div
                    className="rounded bg-black flex items-center justify-center"
                    style={{ width: f.previewW, height: f.previewH }}
                  >
                    <svg viewBox="0 0 10 10" style={{ width: f.previewW * 0.5, height: f.previewH * 0.5, opacity: 0.4 }}>
                      <polygon points="2,1 8,5 2,9" fill="white" />
                    </svg>
                  </div>
                </div>

                <p className="text-xs font-bold text-[#1C1917]">{f.label}</p>
                <p className="text-[10px] text-[#78716C]">{f.sublabel}</p>
                <p className="text-[10px] text-[#A8A29E] font-mono mt-0.5">{f.width}×{f.height}</p>

                {state === 'done' && url && (
                  <div className="mt-2 flex gap-1">
                    <a
                      href={url}
                      download={`${baseName}-${f.id}.mp4`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-1 h-6 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold rounded-lg transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Descarcă
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenderStates((s) => ({ ...s, [f.id]: 'idle' })); setDownloadUrls((d) => ({ ...d, [f.id]: '' })) }}
                      className="px-1.5 h-6 text-[9px] text-[#78716C] hover:text-[#1C1917] border border-[#E7E5E4] rounded-lg transition-colors"
                      title="Regenerează"
                    >
                      ↺
                    </button>
                  </div>
                )}
                {err && <p className="text-[9px] text-red-500 mt-1 truncate">{err}</p>}
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
              <><Loader2 className="w-4 h-4 animate-spin" /> Se procesează...</>
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
                download={`${baseName}-${f.id}.mp4`}
                className="flex items-center gap-1.5 px-3 h-10 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                {f.label}
              </a>
            ))}
          </div>
        )}

        {allSelectedDone && (
          <p className="text-[11px] text-green-700 font-medium">✓ Toate formatele selectate sunt gata</p>
        )}
      </div>

      {!allSelectedDone && (
        <p className="text-[11px] text-[#78716C]">Procesarea durează 30–90s per format · se generează secvențial · fișierele sunt disponibile 1h</p>
      )}

      {/* CLI section — collapsed */}
      <div className="border border-[#E7E5E4] rounded-xl overflow-hidden">
        <button
          onClick={() => setShowCli((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#78716C] hover:bg-[#FAFAF9] transition-colors"
        >
          <span>Comenzi CLI (dezvoltator)</span>
          {showCli ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showCli && (
          <div className="px-4 pb-4 space-y-3 border-t border-[#E7E5E4]">
            <p className="text-[11px] text-[#78716C] pt-3">Comandă pentru formatul activ ({activePreview}):</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 block bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg px-3 py-2 text-[10px] text-[#1C1917] font-mono break-all">
                {cliCommand}
              </code>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 h-8 bg-[#1C1917] text-white text-[10px] font-semibold rounded-lg transition-colors flex-shrink-0 mt-0.5"
              >
                {copied ? <><Check className="w-3 h-3" /> Copiat</> : <><Copy className="w-3 h-3" /> Copiază</>}
              </button>
            </div>
            <button onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 h-8 bg-[#1C1917] text-white text-[10px] font-semibold rounded-lg transition-colors">
              {copiedAll
                ? <><Check className="w-3 h-3" /> Copiat</>
                : <><Copy className="w-3 h-3" /> Copiază {selected.size} formate</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
