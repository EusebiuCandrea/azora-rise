'use client'

import { Product } from '@prisma/client'
import { useApiQuery } from '@/lib/hooks/useApiQuery'

export function useProducts() {
  return useApiQuery<{ products: Product[] }>(['products'], '/api/products')
}
