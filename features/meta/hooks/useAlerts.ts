"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useAlerts() {
  return useQuery({
    queryKey: ["meta-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/meta/alerts")
      if (!res.ok) throw new Error("Failed to fetch alerts")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function useMarkAlertRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meta/alerts/${id}/read`, { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-alerts"] }),
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meta/alerts/${id}/resolve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-alerts"] }),
  })
}
