"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/meta/campaigns")
      if (!res.ok) throw new Error("Failed to fetch campaigns")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSyncCampaigns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/sync", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Sync eșuat (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })
}

export function useUpdateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      status?: string
      dailyBudget?: number
      name?: string
    }) => {
      const res = await fetch(`/api/meta/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Update failed")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })
}

export function usePauseCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meta/campaigns/${id}/pause`, { method: "POST" })
      if (!res.ok) throw new Error("Pause failed")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })
}
