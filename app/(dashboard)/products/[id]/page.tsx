import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ProductCostForm } from '@/features/products/components/ProductCostForm'
import { ProfitabilityTab } from '@/features/products/components/ProfitabilityTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Image from 'next/image'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params

  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
    include: { cost: true },
  })
  if (!product) notFound()

  const [shopifyDomain, orgData] = await Promise.all([
    db.shopifyConnection.findUnique({
      where: { organizationId: orgId },
      select: { shopDomain: true },
    }),
    db.organization.findUnique({
      where: { id: orgId },
      select: {
        shopifyFeeRate: true,
        incomeTaxType: true,
        shippingCostDefault: true,
        packagingCostDefault: true,
        returnRateDefault: true,
      },
    }),
  ])

  const orgSettings = {
    shopifyFeeRate: orgData?.shopifyFeeRate ?? 0.02,
    incomeTaxType: (orgData?.incomeTaxType ?? 'MICRO_1') as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    shippingCostDefault: orgData?.shippingCostDefault ?? 20,
    packagingCostDefault: orgData?.packagingCostDefault ?? 0,
    returnRateDefault: orgData?.returnRateDefault ?? 0.05,
  }

  const shopifyUrl = shopifyDomain
    ? `https://${shopifyDomain.shopDomain}/admin/products/${product.shopifyId}`
    : null

  const tags = (product.shopifyData as any)?.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) ?? []

  return (
    <div className="max-w-[1100px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/products"
          className="flex items-center gap-1.5 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Produse
        </Link>
        <span className="text-[#E7E5E4]">/</span>
        <span className="text-sm text-[#1C1917] font-medium truncate max-w-[300px]">{product.title}</span>
      </div>

      <div className="grid grid-cols-[1fr_1.8fr] gap-5">
        {/* LEFT — Product info card */}
        <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden self-start">
          {/* Product image */}
          {product.imageUrl ? (
            <div className="relative w-full aspect-square bg-[#F5F5F4]">
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                sizes="400px"
              />
              {/* Status badge */}
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                ACTIV
              </span>
            </div>
          ) : (
            <div className="w-full aspect-square bg-[#F5F5F4] flex items-center justify-center">
              <span className="text-[#78716C] text-sm">Fără imagine</span>
            </div>
          )}

          <div className="p-5 space-y-4">
            {/* Title + price */}
            <div>
              <h1 className="text-base font-bold text-[#1C1917] leading-snug">{product.title}</h1>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-[22px] font-bold text-[#1C1917]">{product.price.toFixed(0)} RON</span>
                {product.compareAtPrice && (
                  <span className="text-base text-[#78716C] line-through">{product.compareAtPrice.toFixed(0)} RON</span>
                )}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 5).map((tag: string) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#F5F5F4] text-[#78716C] border border-[#E7E5E4]">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <hr className="border-[#E7E5E4]" />

            {/* Meta */}
            <div className="space-y-1.5">
              <p className="text-xs text-[#78716C]">Shopify ID: {product.shopifyId}</p>
              <p className="text-xs text-[#78716C]">
                Ultima actualizare: {new Intl.DateTimeFormat('ro', { day: 'numeric', month: 'short', year: 'numeric' }).format(product.updatedAt)}
              </p>
              {shopifyUrl && (
                <a
                  href={shopifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
                >
                  Vezi pe Shopify <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Cost form + Profitability */}
        <Tabs defaultValue="costs">
          <TabsList className="mb-4">
            <TabsTrigger value="costs">Costuri</TabsTrigger>
            <TabsTrigger value="profitability">Profitabilitate</TabsTrigger>
          </TabsList>
          <TabsContent value="costs">
            <ProductCostForm productId={product.id} cost={product.cost} price={product.price} orgSettings={orgSettings} />
          </TabsContent>
          <TabsContent value="profitability">
            <ProfitabilityTab
              productId={product.id}
              price={product.price}
              hasCost={!!product.cost}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
