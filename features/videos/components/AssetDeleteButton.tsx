'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function AssetDeleteButton({ assetId }: { assetId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    setLoading(true)
    try {
      await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={`flex items-center gap-1 text-[10px] font-semibold transition-colors ${
        confirming
          ? 'text-red-500 hover:text-red-600'
          : 'text-[#78716C] hover:text-red-500'
      }`}
    >
      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
      {loading ? 'Se șterge...' : confirming ? 'Confirmă' : 'Șterge'}
    </button>
  )
}
