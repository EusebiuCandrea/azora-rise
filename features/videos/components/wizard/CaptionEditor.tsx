'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { CaptionWord } from '@/lib/captions'

interface Props {
  words: CaptionWord[]
  onChange: (words: CaptionWord[]) => void
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${String(sec).padStart(4, '0')}`
}

export function CaptionEditor({ words, onChange }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditValue(words[idx].word)
  }

  function commitEdit(idx: number) {
    if (editValue.trim()) {
      const next = words.map((w, i) => i === idx ? { ...w, word: editValue.trim() } : w)
      onChange(next)
    }
    setEditingIdx(null)
  }

  function cancelEdit() {
    setEditingIdx(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#1C1917]">Subtitrare extrasă</p>
        <span className="text-xs text-[#78716C]">{words.length} cuvinte</span>
      </div>

      <div className="border border-[#E7E5E4] rounded-xl bg-white overflow-hidden">
        <div className="max-h-64 overflow-y-auto divide-y divide-[#F5F5F4]">
          {words.map((w, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAF9] group">
              {/* Timing */}
              <span className="font-mono text-[11px] text-[#78716C] w-16 flex-shrink-0 select-none">
                {formatTime(w.start)}
              </span>

              {/* Word */}
              {editingIdx === idx ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(idx)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 h-7 px-2 border border-[#D4AF37] rounded-md text-sm text-[#1C1917] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                  <button onClick={() => commitEdit(idx)} className="p-1 rounded text-[#16A34A] hover:bg-[#F0FDF4]">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                  <button onClick={cancelEdit} className="p-1 rounded text-[#DC2626] hover:bg-[#FEF2F2]">
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#1C1917] truncate">{w.word}</span>
                  <button
                    onClick={() => startEdit(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F5F4] transition-opacity flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              )}

              {/* Duration bar */}
              <div className="w-20 flex-shrink-0 hidden sm:block">
                <div className="h-1 bg-[#F5F5F4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7C3AED] rounded-full"
                    style={{ width: `${Math.min(100, (w.end - w.start) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[#78716C]">
        Click pe iconiță pentru a edita un cuvânt. Timpii sunt preluați automat din voce.
      </p>
    </div>
  )
}
