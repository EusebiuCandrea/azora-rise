'use client'

import { useState } from 'react'
import { VideoAsset } from '@prisma/client'
import { WizardState, WizardFormat } from '../VideoWizard'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Film, Image as ImageIcon, Music, ExternalLink, Loader2, Captions } from 'lucide-react'
import { CaptionEditor } from './CaptionEditor'

interface Props {
  assets: VideoAsset[]
  state: WizardState
  update: (partial: Partial<WizardState>) => void
}

function AssetPicker({
  label,
  assets,
  filter,
  selected,
  multi,
  onSelect,
}: {
  label: string
  assets: VideoAsset[]
  filter: 'VIDEO' | 'IMAGE' | 'AUDIO'
  selected: string | string[]
  multi?: boolean
  onSelect: (key: string) => void
}) {
  const filtered = assets.filter((a) => a.assetType === filter)

  const isSelected = (key: string) =>
    Array.isArray(selected) ? selected.includes(key) : selected === key

  const selectedIndex = (key: string) =>
    Array.isArray(selected) ? (selected as string[]).indexOf(key) + 1 : 0

  const TypeIcon = filter === 'VIDEO' ? Film : filter === 'IMAGE' ? ImageIcon : Music

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#1C1917]">{label}</label>
      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 p-3 border border-dashed border-[#E7E5E4] rounded-lg bg-[#FAFAF9]">
          <TypeIcon className="w-4 h-4 text-[#C4C0BA] flex-shrink-0" strokeWidth={1.5} />
          <p className="text-xs text-[#78716C]">
            Niciun fișier {filter.toLowerCase()} în bibliotecă.{' '}
            <a href="/videos/library" className="text-[#D4AF37] hover:underline inline-flex items-center gap-0.5" target="_blank">
              Încarcă din Bibliotecă <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((asset) => {
            const sel = isSelected(asset.r2Key)
            const idx = multi ? selectedIndex(asset.r2Key) : 0
            return (
              <button
                key={asset.id}
                onClick={() => onSelect(asset.r2Key)}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                  sel
                    ? 'border-[#D4AF37] bg-[#FFFBEB]'
                    : 'border-[#E7E5E4] bg-white hover:border-[#D4AF37]/40 hover:bg-[#FAFAF9]'
                )}
              >
                {sel ? (
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37] flex-shrink-0" strokeWidth={1.5} />
                ) : (
                  <Circle className="w-4 h-4 text-[#C4C0BA] flex-shrink-0" strokeWidth={1.5} />
                )}
                <span className="truncate text-[#1C1917] font-medium">{asset.filename}</span>
                {multi && sel && (
                  <span className="absolute right-1.5 top-1.5 w-4 h-4 rounded-full bg-[#D4AF37] text-[#1C1917] text-[9px] font-bold flex items-center justify-center">
                    {idx}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const FORMAT_OPTIONS: Array<{ value: WizardFormat; label: string; desc: string }> = [
  { value: '9x16', label: '9:16', desc: 'TikTok / Reels / Shorts' },
  { value: '4x5',  label: '4:5',  desc: 'Feed Facebook/Instagram' },
  { value: '1x1',  label: '1:1',  desc: 'Feed pătrat' },
  { value: '16x9', label: '16:9', desc: 'YouTube / Desktop' },
]

function CaptionVideoSection({ assets, state, update }: Props) {
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)

  const videos = assets.filter((a) => a.assetType === 'VIDEO')

  async function handleTranscribe(assetId: string) {
    setTranscribing(true)
    setTranscribeError(null)
    update({ captionAssetId: assetId, captionWords: [] })

    try {
      const res = await fetch('/api/videos/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Eroare la transcriere')
      update({ captionWords: data.words })
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Eroare necunoscută')
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Video picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#1C1917]">Video sursă</label>
        {videos.length === 0 ? (
          <div className="flex items-center gap-2 p-3 border border-dashed border-[#E7E5E4] rounded-lg bg-[#FAFAF9]">
            <Film className="w-4 h-4 text-[#C4C0BA] flex-shrink-0" strokeWidth={1.5} />
            <p className="text-xs text-[#78716C]">
              Niciun video în bibliotecă.{' '}
              <a href="/videos/library" className="text-[#D4AF37] hover:underline inline-flex items-center gap-0.5" target="_blank">
                Încarcă <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {videos.map((asset) => {
              const sel = state.captionAssetId === asset.id
              return (
                <button
                  key={asset.id}
                  onClick={() => !transcribing && handleTranscribe(asset.id)}
                  disabled={transcribing}
                  className={cn(
                    'relative flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                    sel
                      ? 'border-[#7C3AED] bg-[#F5F3FF]'
                      : 'border-[#E7E5E4] bg-white hover:border-[#7C3AED]/40 hover:bg-[#FAFAF9]',
                    transcribing && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {sel ? (
                    <CheckCircle2 className="w-4 h-4 text-[#7C3AED] flex-shrink-0" strokeWidth={1.5} />
                  ) : (
                    <Circle className="w-4 h-4 text-[#C4C0BA] flex-shrink-0" strokeWidth={1.5} />
                  )}
                  <span className="truncate text-[#1C1917] font-medium">{asset.filename}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Transcribing state */}
      {transcribing && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg">
          <Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin flex-shrink-0" />
          <p className="text-sm text-[#5B21B6]">Se extrage vocea din video cu AI...</p>
        </div>
      )}

      {transcribeError && (
        <p className="text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] px-3 py-2 rounded-lg">
          {transcribeError}
        </p>
      )}

      {/* Caption editor */}
      {state.captionWords.length > 0 && !transcribing && (
        <CaptionEditor
          words={state.captionWords}
          onChange={(words) => update({ captionWords: words })}
        />
      )}

      {/* Output format */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#1C1917]">Format output</label>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => update({ captionFormat: value })}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                state.captionFormat === value
                  ? 'border-[#7C3AED] bg-[#F5F3FF] text-[#5B21B6]'
                  : 'border-[#E7E5E4] bg-white text-[#78716C] hover:border-[#7C3AED]/40'
              )}
            >
              <span className="font-semibold">{label}</span>
              <span className="ml-1.5 font-normal text-[#78716C]">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StepConfigure({ assets, state, update }: Props) {
  function toggleClip(key: string) {
    const clips = state.clips.includes(key)
      ? state.clips.filter((c) => c !== key)
      : [...state.clips, key]
    update({ clips })
  }

  function toggleImage(key: string) {
    const images = state.images.includes(key)
      ? state.images.filter((i) => i !== key)
      : [...state.images, key]
    update({ images })
  }

  // CaptionVideo has its own dedicated configure section
  if (state.template === 'CaptionVideo') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#1C1917]">Configurează Caption Video</h2>
          <p className="text-sm text-[#78716C] mt-1">
            Selectează video-ul, extrage vocea automat cu AI și editează subtitrarea.
          </p>
        </div>
        <CaptionVideoSection assets={assets} state={state} update={update} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#1C1917]">Configurează video-ul</h2>
        <p className="text-sm text-[#78716C] mt-1">Adaugă resursele și textul pentru reclamă.</p>
      </div>

      {/* Common fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#1C1917]">Preț (RON)</label>
          <input
            type="text"
            placeholder="ex: 299 RON"
            value={state.price}
            onChange={(e) => update({ price: e.target.value })}
            className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
          />
        </div>
        {state.template === 'ProductShowcase' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#1C1917]">Tagline CTA</label>
            <input
              type="text"
              placeholder="ex: Comandă acum pe Azora.ro!"
              value={state.tagline}
              onChange={(e) => update({ tagline: e.target.value })}
              className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Template-specific asset pickers */}
      {state.template === 'ProductShowcase' && (
        <div className="space-y-4">
          <AssetPicker
            label="Clipuri video (selectează în ordinea dorită)"
            assets={assets}
            filter="VIDEO"
            selected={state.clips}
            multi
            onSelect={toggleClip}
          />
          <AssetPicker
            label="Voiceover (opțional)"
            assets={assets}
            filter="AUDIO"
            selected={state.voiceoverUrl}
            onSelect={(key) => update({ voiceoverUrl: key })}
          />
        </div>
      )}

      {state.template === 'BeforeAfter' && (
        <div className="space-y-4">
          <AssetPicker
            label="Clip ÎNAINTE"
            assets={assets}
            filter="VIDEO"
            selected={state.beforeClip}
            onSelect={(key) => update({ beforeClip: key })}
          />
          <AssetPicker
            label="Clip DUPĂ"
            assets={assets}
            filter="VIDEO"
            selected={state.afterClip}
            onSelect={(key) => update({ afterClip: key })}
          />
        </div>
      )}

      {state.template === 'Slideshow' && (
        <div className="space-y-4">
          <AssetPicker
            label="Imagini (min 3, max 10)"
            assets={assets}
            filter="IMAGE"
            selected={state.images}
            multi
            onSelect={toggleImage}
          />
          <AssetPicker
            label="Muzică de fundal (opțional)"
            assets={assets}
            filter="AUDIO"
            selected={state.voiceoverUrl}
            onSelect={(key) => update({ voiceoverUrl: key })}
          />
        </div>
      )}

      {/* Hook Generator placeholder */}
      <div className="flex items-center gap-3 border border-dashed border-[#E7E5E4] rounded-lg bg-[#FAFAF9] px-4 py-3">
        <span className="text-base">✨</span>
        <div>
          <p className="text-sm font-medium text-[#1C1917]">
            Hook Generator AI
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F5F5F4] text-[#78716C] border border-[#E7E5E4]">
              Sub-project 5
            </span>
          </p>
          <p className="text-xs text-[#78716C] mt-0.5">
            Va genera automat subtitluri și voiceover din descrierea produsului.
          </p>
        </div>
      </div>
    </div>
  )
}
