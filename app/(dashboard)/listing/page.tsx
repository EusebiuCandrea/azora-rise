'use client'

import { useState } from 'react'
import { Sparkles, ArrowLeft, CheckCircle2, Loader2, XCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type State = 'idle' | 'generating' | 'error'

const STEPS = [
  { label: 'Date extrase din sursă', sub: 'alibaba.com · Dispozitiv 5 in 1...' },
  { label: 'Se generează listing-ul cu Claude AI', sub: null },
  { label: 'Listing pregătit pentru review', sub: null },
]

export default function ListingPage() {
  const [url, setUrl] = useState('')
  const [price, setPrice] = useState('')
  const [state, setState] = useState<State>('idle')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!url) return
    setState('generating')
    setCurrentStep(0)
    setProgress(0)

    // Simulate generation steps
    setTimeout(() => { setCurrentStep(1); setProgress(40) }, 1500)
    setTimeout(() => { setCurrentStep(2); setProgress(75) }, 3500)
    setTimeout(() => { setProgress(100) }, 4500)
    // For demo, show error after 5s (replace with real API call)
    // setTimeout(() => setState('error'), 5500)
  }

  function handleCancel() {
    setState('idle')
    setProgress(0)
    setCurrentStep(0)
  }

  const CHIP_EXAMPLES = ['alibaba.com', 'aliexpress.com', '1688.com']

  return (
    <div className="max-w-[1100px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/products" className="flex items-center gap-1.5 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Produse
        </Link>
        <span className="text-[#E7E5E4]">/</span>
        <span className="text-sm text-[#1C1917] font-medium">Listing nou cu AI</span>
      </div>

      {/* Centered card */}
      <div className="max-w-[680px] mx-auto">
        <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-[#E7E5E4]">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" strokeWidth={1.5} />
              <h1 className="text-lg font-bold text-[#1C1917]">Generează listing din URL</h1>
            </div>
            <p className="text-sm text-[#78716C]">
              Pasează un link de pe Alibaba, AliExpress sau orice marketplace.
              Rise extrage datele automat și creează listing-ul în stilul AZORA.
            </p>
          </div>

          <div className="px-8 py-7">
            {state === 'idle' && (
              <form onSubmit={handleGenerate} className="space-y-5">
                {/* URL input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1C1917]">URL produs sursă</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.alibaba.com/product/..."
                    className="w-full h-12 px-4 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
                    required
                  />
                  <div className="flex items-center gap-2">
                    {CHIP_EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setUrl(`https://www.${ex}/product/example`)}
                        className="px-2.5 py-1 rounded-full text-xs border border-[#E7E5E4] text-[#78716C] hover:border-[#D4AF37] hover:text-[#1C1917] transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1C1917]">Preț vânzare (RON)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="189"
                      className="w-48 h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                    <span className="flex items-center h-10 px-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg text-sm text-[#78716C] font-medium">
                      RON
                    </span>
                  </div>
                </div>

                {/* CTA button */}
                <button
                  type="submit"
                  disabled={!url}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={2} />
                  Generează listing
                </button>
              </form>
            )}

            {state === 'generating' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-[#1C1917] mb-5">Se generează listing-ul...</h2>

                  {/* Steps */}
                  <div className="space-y-4">
                    {STEPS.map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        {i < currentStep ? (
                          <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        ) : i === currentStep ? (
                          <Loader2 className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5 animate-spin" strokeWidth={1.5} />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-[#E7E5E4] flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${i <= currentStep ? 'text-[#1C1917]' : 'text-[#78716C]'}`}>
                            {s.label}
                          </p>
                          {i < currentStep && s.sub && (
                            <p className="text-xs text-[#78716C] mt-0.5">{s.sub}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-6">
                    <div className="h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D4AF37] rounded-full transition-all duration-700"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCancel}
                  className="text-sm text-[#78716C] hover:text-[#1C1917] transition-colors"
                >
                  Anulează
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-4">
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm font-semibold text-[#DC2626]">Nu am putut extrage datele de la acest URL.</p>
                      <p className="text-xs text-[#78716C] mt-1">
                        Firecrawl și Jina AI nu au putut accesa pagina. Verifică dacă URL-ul este public și accesibil.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setState('idle')}
                    className="px-4 h-9 border border-[#DC2626] text-[#DC2626] bg-white rounded-lg text-sm hover:bg-[#FEF2F2] transition-colors"
                  >
                    Încearcă din nou
                  </button>
                  <button
                    onClick={() => { setState('idle'); setUrl('') }}
                    className="text-sm text-[#78716C] hover:text-[#1C1917] transition-colors"
                  >
                    Schimbă URL-ul
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Draft-uri recente */}
        <div className="mt-6 bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E5E4]">
            <h2 className="text-sm font-semibold text-[#1C1917]">Draft-uri recente</h2>
          </div>
          {/* Empty state */}
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-[#78716C]">Niciun listing generat</p>
            <button className="mt-3 text-sm text-[#D4AF37] hover:underline">
              Generează primul listing AI →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
