'use client'

// Screen 16 — Empty / Loading / Error States (design reference, dev-only)
// Shows 4 micro-states as examples for consistent UI patterns across Rise.

import { useState } from 'react'
import { AlertCircle, CheckCircle2, X, Upload, CloudUpload, Loader2, RefreshCw } from 'lucide-react'

// ─── STATE A: Table Skeleton ────────────────────────────────────────────────

function SkeletonBar({ w = 'full', h = 3 }: { w?: string; h?: number }) {
  return (
    <div
      className={`w-${w} rounded-full skeleton`}
      style={{ height: h * 4 }}
    />
  )
}

function TableSkeleton() {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
      {/* Table header */}
      <div className="bg-[#F5F5F4] px-4 py-2.5 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4">
        {['Produs', 'Preț', 'Cost', 'Marjă', 'Status'].map((h) => (
          <span key={h} className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wide">{h}</span>
        ))}
      </div>
      {/* Skeleton rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="px-4 py-3.5 border-t border-[#E7E5E4] grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {/* Product cell: image + 2 bars */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg skeleton flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <SkeletonBar w="4/5" h={3} />
              <SkeletonBar w="1/2" h={2.5} />
            </div>
          </div>
          <SkeletonBar w="16" h={3} />
          <SkeletonBar w="12" h={3} />
          <SkeletonBar w="10" h={5} />
          <SkeletonBar w="14" h={3} />
        </div>
      ))}
    </div>
  )
}

// ─── STATE B: Empty Video Library ──────────────────────────────────────────

function EmptyLibrary() {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm">
      {/* Drop zone */}
      <div className="m-5 border-2 border-dashed border-[#E7E5E4] rounded-xl bg-white p-8 flex flex-col items-center text-center gap-2 hover:border-[#D4AF37] hover:bg-[#FFFBEB] transition-colors cursor-pointer group">
        <CloudUpload className="w-10 h-10 text-[#78716C] group-hover:text-[#D4AF37] transition-colors" strokeWidth={1.5} />
        <p className="text-sm font-bold text-[#1C1917]">Trage fișierele aici sau apasă pentru a selecta</p>
        <p className="text-xs text-[#78716C]">MP4, MOV, JPG, PNG, MP3 · Max 500 MB per fișier</p>
      </div>

      {/* Empty state centered */}
      <div className="py-16 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-[#FFFBEB] flex items-center justify-center">
          <Upload className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
        </div>
        <p className="text-lg font-bold text-[#1C1917]">Nicio înregistrare</p>
        <p className="text-sm text-[#78716C] max-w-xs">
          Încarcă primul clip pentru a crea video-uri de reclamă
        </p>
        <button className="mt-2 flex items-center gap-2 px-4 h-9 bg-[#292524] hover:bg-[#44403C] text-white text-sm font-medium rounded-lg transition-colors">
          <Upload className="w-3.5 h-3.5" strokeWidth={2} />
          Încarcă fișiere
        </button>
      </div>
    </div>
  )
}

// ─── STATE C: Sync Progress Banner ─────────────────────────────────────────

function SyncBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-6 py-2.5">
      <div className="flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin flex-shrink-0" strokeWidth={2} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#92690A]">
            Sincronizare în curs... 87 din 143 produse importate
          </p>
          <div className="mt-1.5 h-1 bg-[#FDE68A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4AF37] rounded-full transition-all duration-500"
              style={{ width: '61%' }}
            />
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-[#92690A] hover:text-[#78716C] transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// ─── STATE D: AI Generation Error ──────────────────────────────────────────

function AIGenerationError() {
  return (
    <div className="max-w-[680px] bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-7">
      <div className="space-y-4">
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-[#DC2626]">
                Nu am putut extrage datele de la acest URL.
              </p>
              <p className="text-xs text-[#78716C] mt-1">
                Firecrawl și Jina AI nu au putut accesa pagina. Verifică dacă URL-ul este public și accesibil.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-4 h-9 border border-[#DC2626] text-[#DC2626] bg-white rounded-lg text-sm hover:bg-[#FEF2F2] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            Încearcă din nou
          </button>
          <button className="text-sm text-[#78716C] hover:text-[#1C1917] transition-colors">
            Schimbă URL-ul
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast Notification Examples ───────────────────────────────────────────

function ToastExample({ type }: { type: 'success' | 'error' | 'info' }) {
  const config = {
    success: {
      bar: 'bg-[#16A34A]',
      icon: <CheckCircle2 className="w-4 h-4 text-[#16A34A]" strokeWidth={1.5} />,
      title: 'Produs salvat cu succes',
      sub: null,
    },
    error: {
      bar: 'bg-[#DC2626]',
      icon: <X className="w-4 h-4 text-[#DC2626]" strokeWidth={2} />,
      title: 'Eroare la salvare',
      sub: 'Conexiunea cu Shopify a eșuat.',
    },
    info: {
      bar: 'bg-[#D4AF37]',
      icon: <AlertCircle className="w-4 h-4 text-[#D4AF37]" strokeWidth={1.5} />,
      title: 'Sincronizare în curs',
      sub: 'Produsele se actualizează...',
    },
  }[type]

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-lg flex overflow-hidden w-72">
      <div className={`w-1 flex-shrink-0 ${config.bar}`} />
      <div className="flex-1 px-4 py-3 flex items-start gap-3">
        {config.icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1C1917]">{config.title}</p>
          {config.sub && <p className="text-xs text-[#78716C] mt-0.5">{config.sub}</p>}
        </div>
        <button className="text-[#78716C] hover:text-[#1C1917] transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StyleGuidePage() {
  const [showBanner, setShowBanner] = useState(true)

  return (
    <div className="min-h-screen bg-[#FAFAF9] p-8 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C1917]">Rise — State Catalog</h1>
        <p className="text-sm text-[#78716C] mt-1">
          Referință de design pentru stările goale, skeleton loading, bannere și erori. Dev-only.
        </p>
      </div>

      {/* STATE A — Table Skeleton */}
      <section className="space-y-4">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] uppercase tracking-wide mb-2">
            State A
          </span>
          <h2 className="text-base font-semibold text-[#1C1917]">Tabel în curs de încărcare</h2>
          <p className="text-sm text-[#78716C]">
            Afișat pe pagina Produse cât timp se fetch-uiesc datele din Prisma.
          </p>
        </div>
        <TableSkeleton />
      </section>

      {/* STATE B — Empty Library */}
      <section className="space-y-4">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] uppercase tracking-wide mb-2">
            State B
          </span>
          <h2 className="text-base font-semibold text-[#1C1917]">Bibliotecă video goală</h2>
          <p className="text-sm text-[#78716C]">
            Afișat pe pagina Bibliotecă când nu există fișiere încărcate.
          </p>
        </div>
        <EmptyLibrary />
      </section>

      {/* STATE C — Sync Banner */}
      <section className="space-y-4">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] uppercase tracking-wide mb-2">
            State C
          </span>
          <h2 className="text-base font-semibold text-[#1C1917]">Banner sincronizare Shopify</h2>
          <p className="text-sm text-[#78716C]">
            Apare în top-ul paginii Produse în timp ce sincronizarea rulează.
          </p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
          {showBanner ? (
            <SyncBanner onDismiss={() => setShowBanner(false)} />
          ) : (
            <div className="p-4 text-center">
              <button
                onClick={() => setShowBanner(true)}
                className="text-sm text-[#D4AF37] hover:underline"
              >
                Afișează bannerul din nou ↺
              </button>
            </div>
          )}
          <div className="p-5">
            <p className="text-sm text-[#78716C]">← conținut pagina Produse</p>
          </div>
        </div>
      </section>

      {/* STATE D — AI Error */}
      <section className="space-y-4">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] uppercase tracking-wide mb-2">
            State D
          </span>
          <h2 className="text-base font-semibold text-[#1C1917]">Eroare generare AI</h2>
          <p className="text-sm text-[#78716C]">
            Apare în generatorul de listing când URL-ul nu poate fi accesat.
          </p>
        </div>
        <AIGenerationError />
      </section>

      {/* Toast examples */}
      <section className="space-y-4">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F5F5F4] text-[#78716C] uppercase tracking-wide mb-2">
            Global
          </span>
          <h2 className="text-base font-semibold text-[#1C1917]">Notificări toast (bottom-right)</h2>
          <p className="text-sm text-[#78716C]">
            Apar în colțul dreapta-jos. Auto-dismiss după 4s pentru Success și Info.
          </p>
        </div>
        <div className="flex items-start gap-4 flex-wrap">
          <ToastExample type="success" />
          <ToastExample type="error" />
          <ToastExample type="info" />
        </div>
      </section>
    </div>
  )
}
