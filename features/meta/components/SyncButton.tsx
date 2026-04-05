"use client"

import { RefreshCw, AlertCircle } from "lucide-react"
import { useSyncCampaigns } from "@/features/meta/hooks/useCampaigns"

export function SyncButton() {
  const { mutate, isPending, isError, error } = useSyncCampaigns()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => mutate()}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-[#E7E5E4] bg-white px-3 py-1.5 text-sm text-[#1C1917] transition-colors hover:bg-[#F5F5F4] disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Se sincronizează..." : "Sincronizează"}
      </button>
      {isError && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" />
          {error instanceof Error ? error.message : "Eroare sync"}
        </span>
      )}
    </div>
  )
}
