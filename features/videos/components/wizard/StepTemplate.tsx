'use client'

import { WizardState, WizardTemplate } from '../VideoWizard'
import { cn } from '@/lib/utils'
import { Film, SplitSquareHorizontal, Images, Bot, LayoutTemplate } from 'lucide-react'
import Link from 'next/link'

const TEMPLATES: Array<{ id: WizardTemplate; label: string; description: string; icon: React.ElementType; recommended?: boolean }> = [
  {
    id: 'ProductShowcase',
    label: 'Product Showcase',
    description: 'Video dinamic cu clipuri și subtitrări. Ideal pentru demonstrații de produs.',
    icon: Film,
    recommended: true,
  },
  {
    id: 'BeforeAfter',
    label: 'Before & After',
    description: 'Înainte și după. Ideal pentru beauty, wellness, fitness.',
    icon: SplitSquareHorizontal,
  },
  {
    id: 'Slideshow',
    label: 'Slideshow',
    description: 'Prezentare imagini cu muzică. Ideal pentru produse vizuale.',
    icon: Images,
  },
]

interface Props {
  state: WizardState
  update: (partial: Partial<WizardState>) => void
}

export function StepTemplate({ state, update }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#1C1917]">Alege template-ul</h2>
        <p className="text-sm text-[#78716C] mt-1">
          Selectează tipul de video care se potrivește cel mai bine produsului.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TEMPLATES.map(({ id, label, description, icon: Icon, recommended }) => {
          const active = state.template === id
          return (
            <button
              key={id}
              onClick={() => update({ template: id })}
              className={cn(
                'relative flex flex-col items-center gap-4 rounded-xl border p-6 text-center transition-all',
                active
                  ? 'border-2 border-[#D4AF37] bg-[#FFFBEB] shadow-md'
                  : 'border border-[#E7E5E4] bg-white hover:border-[#D4AF37]/40 hover:bg-[#FAFAF9] shadow-sm'
              )}
            >
              {recommended && (
                <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFFBEB] text-[#92690A] border border-[#FDE68A]">
                  Recomandat
                </span>
              )}
              {/* Preview mock */}
              <div className={cn(
                'w-full aspect-video rounded-lg border flex items-center justify-center',
                active ? 'border-[#FDE68A] bg-[linear-gradient(135deg,#FFF8DB_0%,#FFFDF4_100%)]' : 'border-[#E7E5E4] bg-[#FAFAF9]'
              )}>
                <Icon className={cn('w-8 h-8', active ? 'text-[#B8971F]' : 'text-[#C4C0BA]')} strokeWidth={1} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#1C1917]">{label}</p>
                <p className="text-xs text-[#78716C] leading-snug">{description}</p>
              </div>
              <div className={cn(
                'w-full h-9 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
                active
                  ? 'bg-[#D4AF37] text-[#1C1917]'
                  : 'border border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#F5F5F4]'
              )}>
                {active ? (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Selectat
                  </>
                ) : 'Selectează'}
              </div>
            </button>
          )
        })}

        {/* Redimensionare formate — link direct la bibliotecă */}
        <Link
          href="/videos/library"
          className="flex flex-col items-center gap-4 rounded-xl border border-[#E7E5E4] bg-white hover:border-[#D4AF37]/40 hover:bg-[#FAFAF9] shadow-sm p-6 text-center transition-all"
        >
          <div className="w-full aspect-video rounded-lg border border-[#E7E5E4] bg-[#FAFAF9] flex items-center justify-center">
            <LayoutTemplate className="w-8 h-8 text-[#C4C0BA]" strokeWidth={1} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#1C1917]">Redimensionare formate</p>
            <p className="text-xs text-[#78716C] leading-snug">Generează 9:16, 4:5, 1:1, 16:9 dintr-un video existent din bibliotecă.</p>
          </div>
          <div className="w-full h-9 rounded-lg text-sm font-medium border border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#F5F5F4] transition-colors flex items-center justify-center">
            Mergi la bibliotecă
          </div>
        </Link>

        {/* Hook Generator AI placeholder */}
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-[#E7E5E4] bg-[#FAFAF9] p-6 text-center opacity-60">
          <div className="w-full aspect-video rounded-lg bg-[#F5F5F4] flex items-center justify-center">
            <Bot className="w-8 h-8 text-[#C4C0BA]" strokeWidth={1} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-semibold text-[#78716C]">Hook Generator AI</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F5F5F4] text-[#78716C] border border-[#E7E5E4]">Sub-project 5</span>
            </div>
            <p className="text-xs text-[#78716C]">Disponibil în curând</p>
          </div>
        </div>
      </div>
    </div>
  )
}
