'use client'

import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export function useApiQuery<T>(
  queryKey: QueryKey,
  url: string,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, Error>({
    queryKey,
    queryFn: () => apiFetch<T>(url),
    ...options,
  })
}
