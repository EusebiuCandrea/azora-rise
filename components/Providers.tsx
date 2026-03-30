'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/Toaster'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster>{children}</Toaster>
    </QueryClientProvider>
  )
}
