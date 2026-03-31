'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Calendar } from 'lucide-react'

type Preset = {
  label: string
  getRange: () => { from: Date; to: Date }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date) {
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  end.setHours(23, 59, 59, 999)
  return end
}

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return startOfDay(monday)
}

const PRESETS: Preset[] = [
  {
    label: 'Azi',
    getRange: () => { const d = new Date(); return { from: startOfDay(d), to: endOfDay(d) } },
  },
  {
    label: 'Ieri',
    getRange: () => {
      const d = new Date(); d.setDate(d.getDate() - 1)
      return { from: startOfDay(d), to: endOfDay(d) }
    },
  },
  {
    label: 'Ultimele 7 zile',
    getRange: () => {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6)
      return { from: startOfDay(from), to: endOfDay(to) }
    },
  },
  {
    label: 'Această săptămână',
    getRange: () => {
      const now = new Date(); const from = startOfWeek(now); const to = endOfDay(now)
      return { from, to }
    },
  },
  {
    label: 'Ultimele 30 zile',
    getRange: () => {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29)
      return { from: startOfDay(from), to: endOfDay(to) }
    },
  },
  {
    label: 'Luna trecută',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: startOfDay(from), to: endOfDay(to) }
    },
  },
  {
    label: 'Luna aceasta',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: startOfDay(from), to: endOfDay(now) }
    },
  },
  {
    label: 'Anul acesta',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), 0, 1)
      return { from: startOfDay(from), to: endOfDay(now) }
    },
  },
]

function toUrlDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

interface Props {
  currentFrom?: string
  currentTo?: string
}

export function DateRangePicker({ currentFrom, currentTo }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [fromVal, setFromVal] = useState(currentFrom ?? '')
  const [toVal, setToVal] = useState(currentTo ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function applyRange(from: Date, to: Date) {
    const params = new URLSearchParams()
    params.set('from', toUrlDate(from))
    params.set('to', toUrlDate(to))
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  function applyCustom() {
    if (!fromVal || !toVal) return
    const from = new Date(fromVal + 'T00:00:00')
    const to = new Date(toVal + 'T23:59:59')
    if (from > to) return
    applyRange(from, to)
  }

  function clearFilter() {
    router.push(pathname)
    setOpen(false)
  }

  const hasFilter = !!currentFrom || !!currentTo
  const label = hasFilter ? `${currentFrom} → ${currentTo}` : 'Toate perioadele'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm transition-colors ${
          hasFilter
            ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#1C1917] font-medium'
            : 'border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#F5F5F4]'
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 bg-white border border-[#E7E5E4] rounded-xl shadow-lg p-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => { const r = preset.getRange(); applyRange(r.from, r.to) }}
              className="w-full text-left px-3 py-2 text-sm text-[#1C1917] rounded-lg hover:bg-[#F5F5F4] transition-colors"
            >
              {preset.label}
            </button>
          ))}
          <div className="border-t border-[#E7E5E4] my-2" />
          <div className="px-2 space-y-2">
            <div className="flex gap-2">
              <input
                type="date"
                value={fromVal}
                onChange={(e) => setFromVal(e.target.value)}
                className="flex-1 h-8 px-2 text-xs border border-[#E7E5E4] rounded-lg"
              />
              <input
                type="date"
                value={toVal}
                onChange={(e) => setToVal(e.target.value)}
                className="flex-1 h-8 px-2 text-xs border border-[#E7E5E4] rounded-lg"
              />
            </div>
            <button
              onClick={applyCustom}
              className="w-full h-8 bg-[#D4AF37] text-[#1C1917] text-xs font-semibold rounded-lg hover:bg-[#B8971F] transition-colors"
            >
              Aplică interval
            </button>
            {hasFilter && (
              <button
                onClick={clearFilter}
                className="w-full h-8 border border-[#E7E5E4] text-[#78716C] text-xs rounded-lg hover:bg-[#F5F5F4] transition-colors"
              >
                Resetează filtrul
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
