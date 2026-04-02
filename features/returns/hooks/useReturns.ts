'use client'

import { useApiQuery } from '@/lib/hooks/useApiQuery'
import type { ReturnsListResponse } from '../types'

export function useReturns(params?: {
  page?: number
  status?: string
  returnType?: string
  dateFrom?: string
  dateTo?: string
}) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.status) searchParams.set('status', params.status)
  if (params?.returnType) searchParams.set('returnType', params.returnType)
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo)

  const query = searchParams.toString()
  const url = `/api/returns${query ? `?${query}` : ''}`

  return useApiQuery<ReturnsListResponse>(['returns', params], url)
}
