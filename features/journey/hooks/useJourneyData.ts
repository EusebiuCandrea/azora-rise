'use client'

import { useApiQuery } from '@/lib/hooks/useApiQuery'
import type { JourneyDataResponse } from '../types'

export function useJourneyData(days: 7 | 30 | 90 = 30) {
  return useApiQuery<JourneyDataResponse>(
    ['journey', 'data', days],
    `/api/journey/data?days=${days}`,
  )
}
