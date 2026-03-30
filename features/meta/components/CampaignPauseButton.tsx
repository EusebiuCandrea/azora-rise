"use client"

import { Pause } from "lucide-react"
import { usePauseCampaign } from "@/features/meta/hooks/useCampaigns"
import { useRouter } from "next/navigation"

interface Props {
  campaignId: string
}

export function CampaignPauseButton({ campaignId }: Props) {
  const router = useRouter()
  const { mutate: pause, isPending } = usePauseCampaign()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        pause(campaignId, {
          onSuccess: () => router.refresh(),
        })
      }
      className="inline-flex items-center gap-2 rounded-lg border border-[#E7E5E4] bg-white px-3 py-1.5 text-sm text-[#1C1917] transition-colors hover:bg-[#FFF7ED] hover:text-[#D97706] disabled:opacity-60"
    >
      <Pause className="h-3.5 w-3.5" />
      {isPending ? "Se oprește..." : "Pauze"}
    </button>
  )
}
