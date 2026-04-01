# Parcurs Client UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the static UI for the `/journey` page — the full "Parcurs Client" dashboard tab with mock data, matching the approved HTML design.

**Architecture:** Pure UI implementation — Server Component page + 7 feature components under `features/journey/`, all with mock data. No backend wiring in this plan. Sidebar gets a new nav item under CAMPANII.

**Tech Stack:** Next.js 16 App Router, React, Tailwind CSS, lucide-react, shadcn/ui patterns.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `components/layout/Sidebar.tsx` | Modify | Add "Parcurs Client" nav item |
| `app/(dashboard)/journey/page.tsx` | Create | Page shell, composes all sections |
| `features/journey/JourneyAlertBanner.tsx` | Create | Red alert strip at top |
| `features/journey/JourneyFilters.tsx` | Create | Period selector + product dropdown + CTA button |
| `features/journey/JourneyFunnel.tsx` | Create | 6-step horizontal funnel cards |
| `features/journey/JourneyKPICards.tsx` | Create | 4 KPI metric cards |
| `features/journey/JourneyMetricsChart.tsx` | Create | Bar chart — conversion rate last 30 days |
| `features/journey/JourneyProductTable.tsx` | Create | Per-product breakdown table |
| `features/journey/JourneyAIPanel.tsx` | Create | Right-column AI analysis panel |

---

### Task 1: Add sidebar nav item

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] Add `RouteOff` import from lucide-react (use `Route` icon for journey)
- [ ] Add new nav section between CAMPANII and ANALIȚĂ:

```typescript
// In navSections array, after the CAMPANII section:
{
  label: 'PARCURS CLIENT',
  items: [{ href: '/journey', label: 'Parcurs Client', icon: Route }],
},
```

- [ ] Verify sidebar renders correctly (visual check at `/dashboard`)
- [ ] Commit: `git commit -m "feat: add Parcurs Client nav item to sidebar"`

---

### Task 2: JourneyAlertBanner component

**Files:**
- Create: `features/journey/JourneyAlertBanner.tsx`

- [ ] Create component:

```tsx
import { AlertTriangle } from 'lucide-react'

interface JourneyAlertBannerProps {
  message: string
}

export function JourneyAlertBanner({ message }: JourneyAlertBannerProps) {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={1.5} />
      <p className="text-sm text-red-800 font-medium">{message}</p>
    </div>
  )
}
```

---

### Task 3: JourneyFilters component

**Files:**
- Create: `features/journey/JourneyFilters.tsx`

- [ ] Create component:

```tsx
'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type Period = '7' | '30' | '90'

export function JourneyFilters() {
  const [period, setPeriod] = useState<Period>('30')

  return (
    <div className="flex items-center gap-3 bg-[#F5F5F4] p-2 rounded-xl flex-wrap">
      <div className="flex bg-white rounded-lg p-1 shadow-sm">
        {(['7', '30', '90'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-md transition-all',
              period === p
                ? 'bg-[#D4AF37] text-[#1C1917] font-semibold shadow-sm'
                : 'text-[#78716C] hover:text-[#1C1917] font-medium'
            )}
          >
            {p} zile
          </button>
        ))}
      </div>
      <select className="bg-white border border-[#E7E5E4] rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] min-w-[160px] px-3 py-2 text-[#1C1917]">
        <option>Toate Produsele</option>
        <option>Colecția Premium</option>
        <option>Accesorii</option>
      </select>
      <button className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#292524] text-white px-5 py-2 rounded-lg text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]">
        <Zap className="w-4 h-4" strokeWidth={2} />
        Analizează acum
      </button>
    </div>
  )
}
```

---

### Task 4: JourneyFunnel component

**Files:**
- Create: `features/journey/JourneyFunnel.tsx`

- [ ] Create component:

```tsx
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FunnelStep {
  label: string
  value: string
  rate?: string
  rateColor?: 'blue' | 'green' | 'orange' | 'red'
}

const steps: FunnelStep[] = [
  { label: 'Impresii', value: '1.2M' },
  { label: 'Clickuri', value: '45K', rate: '3.75%', rateColor: 'blue' },
  { label: 'Vizite', value: '12K', rate: '26.6%', rateColor: 'green' },
  { label: 'Formular', value: '4.2K', rate: '35.0%', rateColor: 'orange' },
  { label: 'Submit', value: '2.1K', rate: '50.0%', rateColor: 'red' },
  { label: 'Comenzi', value: '1.8K', rate: '85.7%', rateColor: 'green' },
]

const rateClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
}

export function JourneyFunnel() {
  return (
    <div className="grid grid-cols-6 gap-2">
      {steps.map((step, i) => (
        <div key={step.label} className="relative bg-white border border-[#E7E5E4] p-5 rounded-xl flex flex-col items-center text-center hover:bg-[#FAFAF9] transition-colors shadow-sm">
          {i > 0 && (
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 text-[#D0C5AF]/60">
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </div>
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] mb-3">
            {step.label}
          </span>
          <span className="text-2xl font-bold text-[#1C1917]">{step.value}</span>
          {step.rate && (
            <span className={cn('mt-2 text-[10px] font-bold px-2 py-0.5 rounded', rateClasses[step.rateColor ?? 'blue'])}>
              {step.rate}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
```

---

### Task 5: JourneyKPICards component

**Files:**
- Create: `features/journey/JourneyKPICards.tsx`

- [ ] Create component:

```tsx
import { BarChart2, HeartCrack, Timer } from 'lucide-react'

export function JourneyKPICards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Conversie Globală */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <div className="flex justify-between items-start">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">Conversie Globală</h3>
          <BarChart2 className="w-4 h-4 text-[#D4AF37]" strokeWidth={1.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#1C1917]">1.5%</span>
          <span className="text-xs font-bold text-green-600">+0.2%</span>
        </div>
        <p className="text-[10px] text-[#78716C]/70 italic">Benchmark RO: 1.2–2.5%</p>
      </div>

      {/* Abandon Formular */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <div className="flex justify-between items-start">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">Abandon Formular</h3>
          <HeartCrack className="w-4 h-4 text-red-500" strokeWidth={1.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#1C1917]">40.1%</span>
          <span className="text-xs font-bold text-red-500">+12.4%</span>
        </div>
        <p className="text-[10px] text-[#78716C]/70 italic">În creștere critică</p>
      </div>

      {/* Timp Mediu Submit */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <div className="flex justify-between items-start">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">Timp Mediu Submit</h3>
          <Timer className="w-4 h-4 text-[#78716C]" strokeWidth={1.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#1C1917]">4m 32s</span>
          <span className="text-xs font-bold text-red-500">vs 3m 50s</span>
        </div>
        <p className="text-[10px] text-[#78716C]/70 italic">Utilizatori ezitanți la checkout</p>
      </div>

      {/* COD vs Card Split */}
      <div className="bg-[#F5F5F4] p-6 rounded-xl flex flex-col gap-3 border border-[#E7E5E4]">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">COD vs Card Split</h3>
        <div className="flex flex-col gap-2 mt-auto">
          <div className="flex justify-between text-[10px] font-bold text-[#1C1917]">
            <span>RAMBURS 68%</span>
            <span>CARD 32%</span>
          </div>
          <div className="h-3 w-full bg-[#E7E5E4] rounded-full flex overflow-hidden">
            <div className="h-full bg-[#D4AF37]" style={{ width: '68%' }} />
            <div className="h-full bg-[#A78A00]" style={{ width: '32%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 6: JourneyMetricsChart component

**Files:**
- Create: `features/journey/JourneyMetricsChart.tsx`

- [ ] Create component:

```tsx
const bars = [40, 45, 42, 55, 38, 65, 30, 75, 50, 42, 58, 48, 35, 62, 45, 52, 40, 68, 55, 72, 48, 60, 38, 70, 55, 45, 62, 50, 68, 58]

export function JourneyMetricsChart() {
  const max = Math.max(...bars)

  return (
    <div className="bg-white border border-[#E7E5E4] p-8 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h4 className="text-xl font-semibold text-[#1C1917]">Evoluție Rată Conversie</h4>
        <span className="text-sm text-[#78716C]">Ultimele 30 zile</span>
      </div>
      <div className="h-48 flex items-end justify-between gap-0.5 px-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/50 transition-colors rounded-t-sm cursor-pointer"
            style={{ height: `${(h / max) * 100}%` }}
            title={`Ziua ${i + 1}: ${h}%`}
          />
        ))}
      </div>
    </div>
  )
}
```

---

### Task 7: JourneyProductTable component

**Files:**
- Create: `features/journey/JourneyProductTable.tsx`

- [ ] Create component:

```tsx
import { cn } from '@/lib/utils'

interface ProductRow {
  name: string
  visits: string
  scroll: string
  formStart: string
  submit: string
  orders: number
  abandon: string
  abandonHigh: boolean
}

const rows: ProductRow[] = [
  { name: 'Cămașă In Premium', visits: '4,230', scroll: '82%', formStart: '12%', submit: '6%', orders: 241, abandon: '50%', abandonHigh: true },
  { name: 'Pantaloni Chino', visits: '2,810', scroll: '76%', formStart: '15%', submit: '9%', orders: 253, abandon: '40%', abandonHigh: false },
  { name: 'Sacou Velvet', visits: '1,120', scroll: '91%', formStart: '8%', submit: '4%', orders: 45, abandon: '58%', abandonHigh: true },
]

export function JourneyProductTable() {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#E7E5E4]">
        <h4 className="text-xl font-semibold text-[#1C1917]">Defalcare per Produs</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F5F5F4] text-[#78716C] font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-6 py-4">Produs</th>
              <th className="px-6 py-4">Vizite</th>
              <th className="px-6 py-4">Scroll%</th>
              <th className="px-6 py-4">Start Form%</th>
              <th className="px-6 py-4">Submit%</th>
              <th className="px-6 py-4">Comenzi</th>
              <th className="px-6 py-4">Abandon%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E5E4]">
            {rows.map((row) => (
              <tr key={row.name} className="hover:bg-[#FAFAF9] transition-colors">
                <td className="px-6 py-4 font-medium text-[#1C1917]">{row.name}</td>
                <td className="px-6 py-4 text-[#78716C]">{row.visits}</td>
                <td className="px-6 py-4 text-[#78716C]">{row.scroll}</td>
                <td className="px-6 py-4 text-[#78716C]">{row.formStart}</td>
                <td className="px-6 py-4 text-[#78716C]">{row.submit}</td>
                <td className="px-6 py-4 text-[#78716C]">{row.orders}</td>
                <td className={cn('px-6 py-4 font-semibold', row.abandonHigh ? 'text-red-500' : 'text-green-600')}>
                  {row.abandon}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

### Task 8: JourneyAIPanel component

**Files:**
- Create: `features/journey/JourneyAIPanel.tsx`

- [ ] Create component:

```tsx
import { Sparkles, RefreshCw, Rocket, StickyNote, Trophy } from 'lucide-react'

interface Problem {
  severity: 'critical' | 'medium' | 'low'
  label: string
  category: string
  title: string
  description: string
}

const problems: Problem[] = [
  {
    severity: 'critical',
    label: 'CRITICĂ',
    category: 'Abandon Formular',
    title: 'Eroare Validare Județ',
    description: 'Utilizatorii întâmpină dificultăți la selectarea județului pe mobil. Scriptul de validare blochează trimiterea formularului fără feedback vizibil.',
  },
  {
    severity: 'medium',
    label: 'MEDIE',
    category: '',
    title: 'Latență Metodă Plată',
    description: 'Gateway-ul de plată procesează tranzacțiile în peste 12 secunde. Utilizatorii renunță în timpul procesării.',
  },
  {
    severity: 'low',
    label: 'MICĂ',
    category: '',
    title: 'Optimizare Buton Promo',
    description: 'Sugerăm mutarea câmpului pentru cod promoțional după sumarul comenzii pentru a reduce distragerile la Checkout.',
  },
]

const severityStyles = {
  critical: {
    border: 'border-red-500',
    badge: 'bg-red-100 text-red-800',
  },
  medium: {
    border: 'border-orange-400',
    badge: 'bg-orange-100 text-orange-800',
  },
  low: {
    border: 'border-blue-400',
    badge: 'bg-blue-100 text-blue-800',
  },
}

export function JourneyAIPanel() {
  return (
    <aside className="bg-[#faf5ff] rounded-3xl p-8 flex flex-col gap-6 shadow-sm border border-purple-100">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-purple-600" strokeWidth={1.5} />
            <h4 className="text-sm font-bold uppercase tracking-wider text-purple-600">Analiză AI</h4>
          </div>
          <p className="text-[10px] text-[#78716C] font-medium">Generată azi 06:30</p>
        </div>
        <button className="text-purple-500 hover:bg-purple-100 p-2 rounded-lg transition-all">
          <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Problem cards */}
      <div className="space-y-3">
        {problems.map((p) => {
          const s = severityStyles[p.severity]
          return (
            <div key={p.title} className={`bg-white p-4 rounded-2xl border-l-4 ${s.border} shadow-sm`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.badge}`}>{p.label}</span>
                {p.category && <span className="text-[10px] text-[#78716C]">{p.category}</span>}
              </div>
              <h5 className="font-bold text-[#1C1917] text-sm mb-1">{p.title}</h5>
              <p className="text-xs text-[#78716C] leading-relaxed">{p.description}</p>
            </div>
          )
        })}
      </div>

      {/* Quick wins */}
      <div className="space-y-3">
        <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#78716C]">
          Ce testezi săptămâna aceasta
        </h5>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl hover:bg-white transition-all cursor-pointer">
            <Rocket className="w-4 h-4 text-purple-500 flex-shrink-0" strokeWidth={1.5} />
            <span className="text-xs font-medium text-[#1C1917]">A/B Test: One-page checkout</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl hover:bg-white transition-all cursor-pointer">
            <StickyNote className="w-4 h-4 text-purple-500 flex-shrink-0" strokeWidth={1.5} />
            <span className="text-xs font-medium text-[#1C1917]">Sticky "Adaugă în Coș"</span>
          </div>
        </div>
      </div>

      {/* Golden insight */}
      <div className="mt-auto bg-gradient-to-br from-[#D4AF37] to-[#B8971F] p-6 rounded-2xl text-[#1C1917] shadow-lg overflow-hidden relative group">
        <Trophy className="absolute -right-3 -bottom-3 w-20 h-20 opacity-10 rotate-12 group-hover:scale-110 transition-transform" strokeWidth={1} />
        <h6 className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-70">Insight de Aur</h6>
        <p className="text-sm font-semibold italic leading-relaxed">
          "Utilizatorii care petrec mai mult de 3 minute pe pagina de FAQ au o rată de conversie cu 240% mai mare. Încearcă să integrezi secțiunea FAQ direct în pagina de produs."
        </p>
      </div>
    </aside>
  )
}
```

---

### Task 9: Journey page

**Files:**
- Create: `app/(dashboard)/journey/page.tsx`

- [ ] Create page:

```tsx
import { requireAuth } from '@/features/auth/helpers'
import { JourneyAlertBanner } from '@/features/journey/JourneyAlertBanner'
import { JourneyFilters } from '@/features/journey/JourneyFilters'
import { JourneyFunnel } from '@/features/journey/JourneyFunnel'
import { JourneyKPICards } from '@/features/journey/JourneyKPICards'
import { JourneyMetricsChart } from '@/features/journey/JourneyMetricsChart'
import { JourneyProductTable } from '@/features/journey/JourneyProductTable'
import { JourneyAIPanel } from '@/features/journey/JourneyAIPanel'

export default async function JourneyPage() {
  await requireAuth()

  return (
    <div className="max-w-[1200px] space-y-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-bold text-[#1C1917] leading-tight tracking-tight">
            Parcurs Client
          </h1>
          <p className="text-[#78716C] text-lg mt-2">Analiza detaliată a fluxului de conversie</p>
        </div>
        <JourneyFilters />
      </section>

      {/* Alert */}
      <JourneyAlertBanner message="Rată abandon formular crescută cu 34% față de medie în ultimele 24 ore." />

      {/* Funnel */}
      <JourneyFunnel />

      {/* KPI Cards */}
      <JourneyKPICards />

      {/* Split view */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        <div className="lg:col-span-2 space-y-8">
          <JourneyMetricsChart />
          <JourneyProductTable />
        </div>
        <JourneyAIPanel />
      </section>
    </div>
  )
}
```

- [ ] Commit all:

```bash
git add features/journey/ app/(dashboard)/journey/ components/layout/Sidebar.tsx
git commit -m "feat: add Parcurs Client UI — static mock data"
```
