"use client"

import { useQuery } from "@tanstack/react-query"

export function useCampaignMetrics(campaignId: string, days = 30) {
  return useQuery({
    queryKey: ["campaign-metrics", campaignId, days],
    queryFn: async () => {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/metrics?days=${days}`)
      if (!res.ok) throw new Error("Failed to fetch metrics")
      return res.json()
    },
    enabled: !!campaignId,
  })
}

export function useCampaignDetail(campaignId: string) {
  return useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/campaigns/${campaignId}`)
      if (!res.ok) throw new Error("Failed to fetch campaign")
      return res.json()
    },
    enabled: !!campaignId,
  })
}
