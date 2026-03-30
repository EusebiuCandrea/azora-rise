'use client'

// Screen 6 — Draft Editor (mock — functionality in Sub-project 4)
// When Sub-project 4 ships, this page fetches the real ProductDraft from DB.

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, RefreshCw, ExternalLink } from 'lucide-react'

const MOCK_DRAFT = {
  title: 'Dispozitiv 5 in 1 Modelare Corporala – EMS, RF, Infrarosu, Vibratii',
  price: '189',
  compareAtPrice: '279',
  tags: ['beauty', 'ems', 'rf', 'wellness'],
  description: `💎 Corpul tau merita cel mai bun tratament

Descopera solutia 5-in-1 pentru modelarea corporala profesionala acum si acasa!

⚡ TEHNOLOGIE 5-IN-1 – EMS, Radiofrecventa, Infrarosu, Vibratii, Fototerapie
✅ REZULTATE DEMONSTRATE
Saptamana 2-4: Reducerea vizibila a celulitei
Luna 2: Contur definit, piele mai ferma
Luna 3: Rezultate similare cu tratamentele profesionale

📋 CUM SE FOLOSESTE
1. Aplica gel conductiv pe zona dorita
2. Porneste dispozitivul si selecteaza intensitatea
3. Aplica circular 15-20 minute per zona
4. Foloseste de 3-4 ori pe saptamana`,
  sourceUrl: 'alibaba.com/product/dispozitiv-5-in-1-modelare',
  status: 'PENDING',
}

export default function DraftEditorPage() {
  const [draft, setDraft] = useState(MOCK_DRAFT)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopyDescription() {
    navigator.clipboard.writeText(draft.description)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePublish() {
    setPublishing(true)
    // Simulate publish delay
    setTimeout(() => setPublishing(false), 2000)
  }

  return (
    <div className="max-w-[1100px]">
      {/* Header bar */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/listing"
          className="flex items-center gap-1.5 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Produse
        </Link>
        <h1 className="text-[18px] font-bold text-[#1C1917]">Listing Draft</h1>

        {/* Status badge */}
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#92690A] border border-[#FDE68A] uppercase tracking-wide">
          În așteptare review
        </span>

        {/* Publish CTA */}
        <div className="ml-auto">
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 px-5 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
          >
            {publishing ? 'Se publică...' : 'Publică în Shopify'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-5" style={{ gridTemplateColumns: '58% 1fr' }}>
        {/* LEFT — Editor */}
        <div className="space-y-5">
          {/* Title */}
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-5">
            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Titlu</p>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full text-[18px] font-semibold text-[#1C1917] border-0 border-b border-transparent hover:border-[#E7E5E4] focus:border-[#D4AF37] focus:outline-none bg-transparent pb-1 transition-colors"
            />
            <p className="text-right text-xs text-[#78716C] mt-1">{draft.title.length}/120</p>
          </div>

          {/* Price + Tags */}
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-5">
            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-3">Prețuri + Tags</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-[#78716C]">Preț vânzare</label>
                <div className="relative">
                  <input
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                    className="w-full h-9 px-3 pr-10 border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] bg-white"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#78716C]">RON</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#78716C]">Preț comparat</label>
                <div className="relative">
                  <input
                    value={draft.compareAtPrice}
                    onChange={(e) => setDraft({ ...draft, compareAtPrice: e.target.value })}
                    className="w-full h-9 px-3 pr-10 border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] bg-white"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#78716C]">RON</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#78716C]">Tags</label>
                <div className="flex flex-wrap gap-1 p-1.5 border border-[#E7E5E4] rounded-lg min-h-[36px]">
                  {draft.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 border border-[#D4AF37] rounded-full text-[11px] text-[#92690A]">
                      {tag}
                      <button onClick={() => setDraft({ ...draft, tags: draft.tags.filter(t => t !== tag) })} className="text-[#78716C] hover:text-[#DC2626] ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Descriere produs</p>
              <div className="flex items-center gap-2">
                <button className="text-xs text-[#78716C] hover:text-[#1C1917] flex items-center gap-1 transition-colors">
                  <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                  Regenerează
                </button>
                <button
                  onClick={handleCopyDescription}
                  className="text-xs text-[#78716C] hover:text-[#1C1917] flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3 h-3" strokeWidth={1.5} />
                  {copied ? 'Copiat!' : 'Copiere'}
                </button>
              </div>
            </div>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="w-full min-h-[400px] border border-[#E7E5E4] rounded-lg p-3 text-sm text-[#1C1917] font-mono focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 resize-y"
            />
          </div>

          {/* Source */}
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm px-5 py-3">
            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Sursă</p>
            <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
              <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
              <span className="font-mono">{draft.sourceUrl}</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Preview & Status */}
        <div className="space-y-4 w-72">
          {/* Shopify preview */}
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E7E5E4]">
              <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Previzualizare Shopify</p>
            </div>
            <div className="p-4">
              <div className="aspect-square bg-[#F5F5F4] rounded-lg mb-3 flex items-center justify-center">
                <span className="text-[#78716C] text-xs">Imagine produs</span>
              </div>
              <p className="text-sm font-semibold text-[#1C1917] leading-snug mb-1">{draft.title.slice(0, 60)}{draft.title.length > 60 ? '...' : ''}</p>
              <p className="text-base font-bold text-[#1C1917] mb-3">{draft.price} RON</p>
              <button className="w-full h-9 bg-[#E7E5E4] text-[#78716C] rounded-lg text-sm font-medium cursor-not-allowed">
                Adaugă în coș
              </button>
              <p className="text-xs text-[#78716C] mt-3 line-clamp-3">{draft.description.slice(0, 120)}...</p>
              <button className="text-xs text-[#78716C] hover:underline mt-1">Citește mai mult</button>
            </div>
          </div>

          {/* Publish status */}
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Status publicare</p>
            <div className="space-y-1.5 text-xs text-[#78716C]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                Status: În așteptare review
              </div>
              <p>Creat: acum 5 minute</p>
            </div>
            <hr className="border-[#E7E5E4]" />
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
            >
              {publishing ? 'Se publică...' : 'Publică în Shopify'}
            </button>
            <p className="text-[10px] text-[#78716C] text-center">
              Produsul va fi creat ca draft în Shopify Admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
