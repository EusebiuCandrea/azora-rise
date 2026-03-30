"use client"
import { useState } from "react"
import { RefreshCw } from "lucide-react"

export function SyncShopifyButton() {
  const [syncing, setSyncing] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setDone(false)
    try {
      await fetch('/api/shopify/sync', { method: 'POST' })
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } catch {
      // ignore
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-2 px-4 h-9 border border-[#E7E5E4] bg-white rounded-lg text-sm text-[#1C1917] hover:bg-[#F5F5F4] transition-colors disabled:opacity-60"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
      {done ? 'Sincronizat!' : syncing ? 'Se sincronizează...' : 'Sincronizează Shopify'}
    </button>
  )
}
