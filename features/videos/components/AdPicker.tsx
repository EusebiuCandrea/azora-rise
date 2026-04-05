'use client'

import { useState } from 'react'
import { Video, Check, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface PickableAd {
  id: string
  name: string
}

interface AdPickerProps {
  productId: string
  productName: string
  ads: PickableAd[]
  selectedId: string | null
  onSelect: (ad: PickableAd) => void
}

export function AdPicker({ productId, productName, ads, selectedId, onSelect }: AdPickerProps) {
  const [list, setList] = useState<PickableAd[]>(ads)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/video-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Eroare la creare')
        return
      }
      const created: PickableAd = { id: data.id, name: data.name }
      setList((prev) => [...prev, created])
      setNewName('')
      onSelect(created)
    } catch {
      setError('Eroare de rețea')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#78716C]">
        Produs: <span className="font-semibold text-[#1C1917]">{productName}</span>
      </p>

      {list.length > 0 && (
        <div className="border border-[#E7E5E4] rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
          {list.map((ad) => {
            const active = selectedId === ad.id
            return (
              <button
                key={ad.id}
                onClick={() => onSelect(ad)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#E7E5E4] last:border-0 transition-colors border-l-[3px]',
                  active ? 'bg-[#FFFBEB] border-l-[#D4AF37]' : 'hover:bg-[#FAFAF9] border-l-transparent'
                )}
              >
                <Video className="w-4 h-4 text-[#78716C] flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm text-[#1C1917] flex-1">{ad.name}</span>
                {active && (
                  <div className="w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#1C1917]" strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-[#78716C]">Reclamă nouă</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ex: reclama-vara-2024"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 h-9 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Creează
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
