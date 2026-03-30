import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Product, ProductCost } from '@prisma/client'

interface ProductCardProps {
  product: Product & { cost: ProductCost | null }
}

export function ProductCard({ product }: ProductCardProps) {
  const hasCost = product.cost !== null

  return (
    <Link href={`/products/${product.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="p-4 flex gap-4">
          {product.imageUrl && (
            <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted">
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{product.title}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{product.price.toFixed(2)} RON</p>
            <div className="mt-2">
              {hasCost ? (
                <Badge variant="default" className="text-xs bg-green-900 text-green-300">
                  Cost configurat
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Fără cost
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
