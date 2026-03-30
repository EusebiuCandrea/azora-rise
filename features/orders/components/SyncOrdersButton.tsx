'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

interface Props {
  isSyncing: boolean
}

export function SyncOrdersButton({ isSyncing: initialSyncing }: Props) {
  const [loading, setLoading] = useState(initialSyncing)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/shopify/sync-orders', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const r = data.result
        setResult(`Sincronizat: ${r.synced} noi, ${r.updated} actualizate`)
        router.refresh()
      } else {
        setResult(`Eroare: ${data.error}`)
      }
    } catch {
      setResult('Eroare de conexiune')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs text-[#78716C]">{result}</span>
      )}
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-4 h-9 bg-[#D4AF37] text-[#1C1917] rounded-lg text-sm font-semibold
                   hover:bg-[#B8971F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Se sincronizează...' : 'Sincronizează comenzi'}
      </button>
    </div>
  )
}
