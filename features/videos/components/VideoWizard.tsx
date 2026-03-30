'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Product, VideoAsset } from '@prisma/client'
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepProduct } from './wizard/StepProduct'
import { StepTemplate } from './wizard/StepTemplate'
import { StepConfigure } from './wizard/StepConfigure'
import { StepReview } from './wizard/StepReview'

const STEPS = ['Produs', 'Template', 'Configurare', 'Lansare'] as const
type Step = 0 | 1 | 2 | 3

export type WizardTemplate = 'ProductShowcase' | 'BeforeAfter' | 'Slideshow'
export type WizardFormat = '9x16' | '4x5' | '1x1' | '16x9'

export interface WizardState {
  productId: string
  productName: string
  template: WizardTemplate | null
  formats: WizardFormat[]
  clips: string[]      // r2:// keys
  images: string[]     // r2:// keys
  beforeClip: string
  afterClip: string
  voiceoverUrl: string
  subtitles: Array<{ from: number; to: number; line1: string; line2: string }>
  price: string
  tagline: string
}

const INITIAL_STATE: WizardState = {
  productId: '',
  productName: '',
  template: null,
  formats: ['9x16', '4x5', '1x1', '16x9'],
  clips: [],
  images: [],
  beforeClip: '',
  afterClip: '',
  voiceoverUrl: '',
  subtitles: [],
  price: '',
  tagline: '',
}

interface VideoWizardProps {
  products: Product[]
  assets: VideoAsset[]
}

export function VideoWizard({ products, assets }: VideoWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [state, setState] = useState<WizardState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }))
  }

  function canAdvance(): boolean {
    if (step === 0) return !!state.productId
    if (step === 1) return !!state.template
    if (step === 2) {
      if (state.template === 'ProductShowcase') return state.clips.length >= 1
      if (state.template === 'BeforeAfter') return !!state.beforeClip && !!state.afterClip
      if (state.template === 'Slideshow') return state.images.length >= 3
      return false
    }
    return true
  }

  async function handleSubmit() {
    if (!state.template || !state.productId) return
    setSubmitting(true)
    setError(null)

    const params: Record<string, unknown> = {
      productName: state.productName,
      price: state.price,
      subtitles: state.subtitles,
    }

    if (state.template === 'ProductShowcase') {
      params.clips = state.clips
      params.tagline = state.tagline
    } else if (state.template === 'BeforeAfter') {
      params.beforeClip = state.beforeClip
      params.afterClip = state.afterClip
    } else if (state.template === 'Slideshow') {
      params.images = state.images
      if (state.voiceoverUrl) params.music = state.voiceoverUrl
    }

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: state.productId,
          template: state.template,
          formats: state.formats,
          params,
        }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json()
        throw new Error(msg ?? 'Eroare la pornirea render-ului')
      }

      const { videoId } = await res.json()
      router.push(`/videos/${videoId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscută')
      setSubmitting(false)
    }
  }

  const STEP_LABELS = ['1 Produs', '2 Template', '3 Configurare', '4 Preview & Export']

  return (
    <div className="space-y-6">
      <nav className="w-full rounded-2xl border border-[#E7E5E4] bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center w-full">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-colors flex-shrink-0',
                  i < step
                    ? 'border-[#D4AF37] bg-[#D4AF37] text-[#1C1917]'
                    : i === step
                    ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#B8971F]'
                    : 'border-[#E7E5E4] bg-[#F5F5F4] text-[#78716C]'
                )}
              >
                {i < step ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : i + 1}
              </div>
              <span
                className={cn(
                  'text-sm hidden sm:inline',
                  i === step ? 'text-[#1C1917] font-semibold' : 'text-[#78716C]'
                )}
              >
                {label.replace(/^\d /, '')}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="flex-1 mx-3 h-px bg-[#E7E5E4]" />
            )}
          </div>
        ))}
        </div>
      </nav>

      {/* Step content */}
      <div className="rounded-xl border border-[#E7E5E4] bg-white shadow-sm p-6">
        {step === 0 && <StepProduct products={products} state={state} update={update} />}
        {step === 1 && <StepTemplate state={state} update={update} />}
        {step === 2 && <StepConfigure assets={assets} state={state} update={update} />}
        {step === 3 && <StepReview state={state} />}
      </div>

      {error && (
        <p className="text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => (s - 1) as Step)}
          disabled={step === 0 || submitting}
          className="flex items-center gap-1.5 px-4 h-10 border border-[#E7E5E4] bg-white rounded-lg text-sm text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F5F4] transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Înapoi
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 px-4 h-10 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors disabled:opacity-40"
          >
            Continuă
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-1.5 px-4 h-10 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Se lansează...
              </>
            ) : (
              'Salvează configurația'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
