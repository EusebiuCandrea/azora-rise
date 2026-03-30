'use client'

import { useQuery } from '@tanstack/react-query'
import { ProductListWithRoas } from './ProductListWithRoas'
import type { Product, ProductCost } from '@prisma/client'

interface Props {
  products: (Product & { cost: ProductCost | null })[]
}

interface ProfitabilityData {
  avgRoas: number | null
}

export function ProductsWithProfitability({ products }: Props) {
  const { data } = useQuery<ProfitabilityData>({
    queryKey: ['profitability-summary'],
    queryFn: () => fetch('/api/analytics/profitability').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <ProductListWithRoas
      products={products}
      actualRoas={data?.avgRoas ?? null}
    />
  )
}
