import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { ProductsPageClient } from '@/features/products/components/ProductsPageClient'
import { SyncShopifyButton } from '@/features/shopify/components/SyncShopifyButton'
import { Video } from 'lucide-react'
import Link from 'next/link'

export default async function ProductsPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  const products = orgId
    ? await db.product.findMany({
        where: { organizationId: orgId },
        include: { cost: true },
        orderBy: { title: 'asc' },
      })
    : []

  const shopifyConn = orgId
    ? await db.shopifyConnection.findUnique({ where: { organizationId: orgId } })
    : null

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Produse</h1>
          {shopifyConn?.lastSyncedAt && (
            <p className="text-xs text-[#78716C] mt-1">
              Ultima sincronizare:{' '}
              {new Intl.RelativeTimeFormat('ro', { numeric: 'auto' }).format(
                -Math.round((Date.now() - shopifyConn.lastSyncedAt.getTime()) / 3600000),
                'hours'
              )}{' '}
              · {products.length} produse
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SyncShopifyButton />
          <Link
            href="/videos/new"
            className="flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors"
          >
            <Video className="w-3.5 h-3.5" strokeWidth={2} />
            Creare video nou
          </Link>
        </div>
      </div>

      {/* All interactive UI: tabs, search, filters, table, pagination, summary chips */}
      <ProductsPageClient products={products} />
    </div>
  )
}
