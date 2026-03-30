'use client'

import { useState } from 'react'
import { WizardState } from '../VideoWizard'
import { Copy, Check, Info, Monitor } from 'lucide-react'

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

export function StepReview({ state }: Props) {
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
