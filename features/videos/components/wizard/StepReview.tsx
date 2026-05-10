'use client'

import { useState, useEffect, useRef } from 'react'
import { WizardState } from '../VideoWizard'
import { Copy, Check, Info, Monitor, Captions, CheckCircle2, Play, Pause, RotateCcw } from 'lucide-react'
import { groupWordsIntoLines } from '@/lib/captions'
import type { CaptionWord } from '@/lib/captions'

const FORMAT_LABELS: Record<string, { label: string; suffix: string; desc: string }> = {
  '9x16': { label: '9:16', suffix: '9x16', desc: 'Reels, TikTok, Stories' },
  '4x5':  { label: '4:5',  suffix: '4x5',  desc: 'Feed Facebook/Instagram' },
  '1x1':  { label: '1:1',  suffix: '1x1',  desc: 'Feed pătrat' },
  '16x9': { label: '16:9', suffix: '16x9', desc: 'YouTube, desktop' },
}

const TEMPLATE_COMP: Record<string, string> = {
  ProductShowcase: 'ProductShowcase',
  BeforeAfter:     'BeforeAfter',
  Slideshow:       'Slideshow',
}

interface Props {
  state: WizardState
  onEditCaptions?: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 border border-[#E7E5E4] bg-white rounded-lg text-xs text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917] transition-colors flex-shrink-0"
    >
      {copied ? (
        <><Check className="w-3 h-3 text-[#16A34A]" strokeWidth={2} /> Copiat</>
      ) : (
        <><Copy className="w-3 h-3" strokeWidth={1.5} /> Copiază</>
      )}
    </button>
  )
}

function buildRenderCmd(template: string, formatKey: string, productName: string): string {
  const comp = TEMPLATE_COMP[template] ?? template
  const fmt = FORMAT_LABELS[formatKey]?.suffix ?? formatKey
  const slug = productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'produs'
  const outFile = `out/${slug}-${fmt}.mp4`
  const props = JSON.stringify({ productName, template, format: fmt })
  return `npx remotion render ${comp}-${fmt} ${outFile} \\\n  --props='${props}'`
}

function CaptionPreview({ words, format, assetId, offset, onOffsetChange }: {
  words: CaptionWord[]
  format: string
  assetId: string
  offset: number
  onOffsetChange: (v: number) => void
}) {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(words[words.length - 1]?.end ?? 0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const lines = groupWordsIntoLines(words)

  // Use requestAnimationFrame for 60fps sync instead of timeupdate (~4fps)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onMeta = () => setDuration(video.duration || duration)
    video.addEventListener('loadedmetadata', onMeta)

    function tick() {
      setCurrentTime(video!.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }

    const onPlay = () => { rafRef.current = requestAnimationFrame(tick) }
    const onPause = () => cancelAnimationFrame(rafRef.current)

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onPause)

    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onPause)
      cancelAnimationFrame(rafRef.current)
    }
  }, [duration])

  const isPortrait = format !== '16x9'
  // Apply offset: negative offset = captions appear earlier (voice is ahead)
  const t = currentTime - offset
  const activeLine = lines.find(l => t >= l.start && t <= l.end + 0.05)
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play() : v.pause()
  }

  function reset() {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = 0
  }

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-xl bg-black mx-auto"
        style={{
          aspectRatio: format === '9x16' ? '9/16' : format === '4x5' ? '4/5' : format === '1x1' ? '1/1' : '16/9',
          maxHeight: isPortrait ? 360 : 200,
          maxWidth: isPortrait ? 202 : '100%',
        }}
      >
        {/* Actual video */}
        <video
          ref={videoRef}
          src={`/api/download?assetId=${assetId}`}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          preload="metadata"
        />

        {/* Caption overlay */}
        <div
          className="absolute left-0 right-0 flex justify-center px-2 pointer-events-none"
          style={{ top: `${format === '16x9' ? 84 : 62}%` }}
        >
          {activeLine && (
            <div
              className="flex flex-wrap justify-center gap-x-1 gap-y-0.5"
              style={{ background: 'rgba(0,0,0,0.55)', padding: '3px 6px', borderRadius: 3 }}
            >
              {activeLine.words.map((w, i) => {
                const isActive = t >= w.start && t <= w.end
                return (
                  <span
                    key={i}
                    className="font-black uppercase leading-tight"
                    style={{
                      fontSize: isActive ? 'clamp(10px, 3.5vw, 18px)' : 'clamp(9px, 3vw, 16px)',
                      color: '#fff',
                      background: isActive ? '#7C3AED' : 'transparent',
                      padding: isActive ? '2px 5px' : '1px 2px',
                      borderRadius: 3,
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.08s ease-out',
                      display: 'inline-block',
                    }}
                  >
                    {w.word}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="flex items-center gap-1.5 px-3 h-8 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Play className="w-3 h-3 ml-0.5" strokeWidth={2} />
          Play
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 h-8 border border-[#E7E5E4] bg-white text-xs text-[#78716C] hover:bg-[#F5F5F4] rounded-lg transition-colors"
        >
          <RotateCcw className="w-3 h-3" strokeWidth={2} />
        </button>
        <div className="flex-1 h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
          <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-xs font-mono text-[#78716C] flex-shrink-0">{duration.toFixed(1)}s</span>
      </div>

      {/* Offset control */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#F5F5F4]">
        <span className="text-xs text-[#78716C] flex-shrink-0">Sincronizare text:</span>
        <button
          onClick={() => onOffsetChange(+(offset - 0.1).toFixed(1))}
          className="w-6 h-6 rounded border border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#F5F5F4] text-xs font-bold flex items-center justify-center"
        >−</button>
        <span className={`text-xs font-mono w-14 text-center font-semibold ${offset !== 0 ? 'text-[#7C3AED]' : 'text-[#78716C]'}`}>
          {offset > 0 ? '+' : ''}{offset.toFixed(1)}s
        </span>
        <button
          onClick={() => onOffsetChange(+(offset + 0.1).toFixed(1))}
          className="w-6 h-6 rounded border border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#F5F5F4] text-xs font-bold flex items-center justify-center"
        >+</button>
        <span className="text-xs text-[#78716C]">{offset < 0 ? '← text mai devreme' : offset > 0 ? '→ text mai târziu' : '— sincronizat'}</span>
      </div>
    </div>
  )
}

function CaptionVideoReview({ state, onEditCaptions, onOffsetChange }: Props & { onOffsetChange?: (v: number) => void }) {
  const FORMAT_LABELS_SIMPLE: Record<string, string> = {
    '9x16': '9:16 (TikTok / Reels / Shorts)',
    '4x5':  '4:5 (Feed Facebook/Instagram)',
    '1x1':  '1:1 (Feed pătrat)',
    '16x9': '16:9 (YouTube / Desktop)',
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#1C1917]">Preview & Export</h2>
        <p className="text-sm text-[#78716C] mt-1">
          Verifică cum arată subtitrarea, apoi apasă „Randează și descarcă".
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
        {/* LEFT — video preview with caption overlay */}
        <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Preview</p>
            {onEditCaptions && (
              <button
                onClick={onEditCaptions}
                className="flex items-center gap-1 text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors"
              >
                <Captions className="w-3 h-3" strokeWidth={2} />
                Editează subtitrare
              </button>
            )}
          </div>
          <CaptionPreview
            words={state.captionWords}
            format={state.captionFormat}
            assetId={state.captionAssetId}
            offset={state.captionOffset}
            onOffsetChange={onOffsetChange ?? (() => {})}
          />
        </div>

        {/* RIGHT — summary + info */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E7E5E4] flex items-center gap-2">
              <Captions className="w-4 h-4 text-[#7C3AED]" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold text-[#1C1917]">Configurare</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-xs text-[#78716C]">Format output</p>
                  <p className="text-sm font-medium text-[#1C1917]">
                    {FORMAT_LABELS_SIMPLE[state.captionFormat] ?? state.captionFormat}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-xs text-[#78716C]">Cuvinte transcrise</p>
                  <p className="text-sm font-medium text-[#1C1917]">{state.captionWords.length} cuvinte</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-xs text-[#78716C]">Stil</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-white bg-[#7C3AED] px-1.5 py-0.5 rounded">Cuvânt</span>
                    <span className="text-xs font-bold text-[#1C1917]">activ mov</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg px-4 py-3">
            <Info className="w-4 h-4 text-[#7C3AED] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-xs text-[#5B21B6]">
              Render-ul durează 30–120 secunde în funcție de lungimea video-ului.
              Video-ul va fi descărcat automat și salvat în Bibliotecă.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StepReview({ state, onEditCaptions, onOffsetChange }: Props & { onOffsetChange?: (v: number) => void }) {
  if (state.template === 'CaptionVideo') return <CaptionVideoReview state={state} onEditCaptions={onEditCaptions} onOffsetChange={onOffsetChange} />

  const [activeFormat, setActiveFormat] = useState<string>(state.formats[0] ?? '9x16')
  const selectedFormats = state.formats.filter((f) => FORMAT_LABELS[f])

  return (
    <div className="grid grid-cols-[44%_1fr] gap-6">

      {/* LEFT — Preview */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1C1917]">Preview & Exportare</h2>
          <p className="text-sm text-[#78716C] mt-1">
            Selectează formatul, copiază comanda și rulează render-ul din terminal.
          </p>
        </div>

        {/* Format tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#F5F5F4] rounded-lg w-fit">
          {selectedFormats.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFormat(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeFormat === f
                  ? 'bg-[#D4AF37] text-[#1C1917] shadow-sm'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              {FORMAT_LABELS[f]?.label ?? f}
            </button>
          ))}
        </div>

        {/* Player container */}
        <div className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white shadow-sm">
          <div
            className="flex items-center justify-center bg-[radial-gradient(circle_at_top,#FFF8DB_0%,#FAFAF9_58%,#F5F5F4_100%)]"
            style={{
              aspectRatio: activeFormat === '9x16' ? '9/16'
                : activeFormat === '4x5'  ? '4/5'
                : activeFormat === '1x1'  ? '1/1'
                : '16/9',
              maxHeight: 340,
            }}
          >
            <div className="text-center space-y-2 px-6">
              <Monitor className="w-8 h-8 text-[#B8971F] mx-auto" strokeWidth={1} />
              <p className="text-[#78716C] text-xs">
                Preview disponibil după render
              </p>
              {state.productName && (
                <p className="text-[#1C1917] text-xs font-medium truncate max-w-[160px] mx-auto">
                  {state.productName}
                </p>
              )}
            </div>
          </div>
          {/* Controls bar */}
          <div className="bg-white border-t border-[#E7E5E4] px-4 py-2.5 flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#F5F5F4] border border-[#E7E5E4] flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-[#78716C] ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="flex-1 h-1.5 bg-[#F5F5F4] rounded-full relative">
              <div className="w-0 h-full bg-[#D4AF37] rounded-full" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#D4AF37] border-2 border-white shadow" />
            </div>
            <span className="text-[11px] font-mono text-[#78716C] flex-shrink-0">0:00 / --:--</span>
          </div>
        </div>

        {/* Format info */}
        <p className="text-xs text-[#78716C]">
          Format activ: <span className="font-medium text-[#1C1917]">
            {FORMAT_LABELS[activeFormat]?.label}
          </span> — {FORMAT_LABELS[activeFormat]?.desc}
        </p>
      </div>

      {/* RIGHT — Render commands */}
      <div className="space-y-4">
        <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E5E4]">
            <h3 className="text-sm font-semibold text-[#1C1917]">Comenzi render</h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Rulează din folderul <code className="font-mono bg-[#F5F5F4] px-1 rounded">azora-ads/</code> pe Mac
            </p>
          </div>

          <div className="p-5 space-y-5">
            {/* Info box */}
            <div className="flex items-start gap-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3.5 py-3">
              <Info className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-[#92690A]">
                Asigură-te că ai Node.js și dependențele instalate:{' '}
                <code className="font-mono bg-[#FDE68A]/50 px-1 rounded">cd azora-ads && npm install</code>
              </p>
            </div>

            {/* One code block per selected format */}
            {selectedFormats.map((f) => {
              const cmd = buildRenderCmd(state.template ?? 'ProductShowcase', f, state.productName)
              return (
                <div key={f}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">
                      Format {FORMAT_LABELS[f]?.label}
                    </span>
                    <CopyButton text={cmd} />
                  </div>
                  <pre className="bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg p-3 text-[11px] font-mono text-[#1C1917] overflow-x-auto whitespace-pre leading-relaxed">
                    {cmd}
                  </pre>
                </div>
              )
            })}

            <div className="pt-1 border-t border-[#E7E5E4]">
              <p className="text-xs text-[#78716C] text-center">
                Configurația va fi salvată în Rise și poate fi accesată oricând.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
