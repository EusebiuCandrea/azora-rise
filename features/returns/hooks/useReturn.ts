'use client'

import { useApiQuery } from '@/lib/hooks/useApiQuery'
import type { ReturnRecord } from '../types'

export function useReturn(id: string) {
  return useApiQuery<ReturnRecord>(['return', id], `/api/returns/${id}`)
}
