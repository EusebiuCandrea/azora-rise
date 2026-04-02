'use client'
import { useState } from 'react'
import { AddReturnDialog } from './AddReturnDialog'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export function AddReturnButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        style={{ background: '#D4AF37', color: '#1C1917' }}
      >
        <Plus className="w-4 h-4" strokeWidth={2} />
        Adaugă retur
      </button>
      <AddReturnDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => router.refresh()}
      />
    </>
  )
}
