import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

const PAYMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: '#DCFCE7', text: '#15803D', label: 'Plătit' },
  partially_refunded: { bg: '#FFF7ED', text: '#D97706', label: 'Parțial rambursat' },
  refunded: { bg: '#FEF2F2', text: '#DC2626', label: 'Rambursat' },
  pending: { bg: '#F5F5F4', text: '#78716C', label: 'În așteptare (COD)' },
  cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Anulat' },
  voided: { bg: '#FEF2F2', text: '#DC2626', label: 'Stornat' },
}

const FULFILLMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  fulfilled: { bg: '#DCFCE7', text: '#15803D', label: 'Livrat' },
  partial: { bg: '#FFF7ED', text: '#D97706', label: 'Parțial livrat' },
  unfulfilled: { bg: '#FEF2F2', text: '#DC2626', label: 'Nelivrat' },
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params

  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const order = await db.order.findFirst({
    where: { id, organizationId: orgId },
    include: {
      items: {
        include: { product: { select: { id: true, imageUrl: true } } },
        orderBy: { price: 'desc' },
      },
    },
  })
  if (!order) notFound()

  const shopifyConnection = await db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
    select: { shopDomain: true },
  })

  const shopifyOrderUrl = shopifyConnection
    ? `https://${shopifyConnection.shopDomain}/admin/orders/${order.shopifyOrderId}`
    : null

  const paymentStyle = PAYMENT_STYLES[order.financialStatus] ?? PAYMENT_STYLES.pending
  const fulfillmentStyle = FULFILLMENT_STYLES[order.fulfillmentStatus ?? 'unfulfilled'] ?? FULFILLMENT_STYLES.unfulfilled

  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0)
  const isPaid = order.financialStatus === 'paid' || order.financialStatus === 'partially_refunded'

  return (
    <div className="max-w-[800px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/orders"
          className="flex items-center gap-1.5 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Comenzi
        </Link>
        <span className="text-[#E7E5E4]">/</span>
        <span className="text-sm text-[#1C1917] font-medium">#{order.orderNumber}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1C1917]">Comanda #{order.orderNumber}</h1>
            <p className="text-sm text-[#78716C] mt-0.5">
              {new Intl.DateTimeFormat('ro', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }).format(new Date(order.processedAt))}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: paymentStyle.bg, color: paymentStyle.text }}
            >
              {paymentStyle.label}
            </span>
            {order.fulfillmentStatus && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: fulfillmentStyle.bg, color: fulfillmentStyle.text }}
              >
                {fulfillmentStyle.label}
              </span>
            )}
            {shopifyOrderUrl && (
              <a
                href={shopifyOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
              >
                Shopify <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[#E7E5E4] bg-[#FAFAF9]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#78716C]">
            Produse ({totalItems} {totalItems === 1 ? 'bucată' : 'bucăți'})
          </h2>
        </div>
        <div className="divide-y divide-[#E7E5E4]">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-5 py-4">
              {/* Product image or placeholder */}
              {item.product?.imageUrl ? (
                <img
                  src={item.product.imageUrl}
                  alt={item.title}
                  className="w-12 h-12 rounded-lg object-cover border border-[#E7E5E4] flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                {item.product?.id ? (
                  <Link
                    href={`/products/${item.product.id}`}
                    className="text-sm font-medium text-[#1C1917] hover:text-[#D4AF37] transition-colors truncate block"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-[#1C1917] truncate">{item.title}</p>
                )}
                {item.variantTitle && item.variantTitle !== 'Default Title' && (
                  <p className="text-xs text-[#78716C] mt-0.5">{item.variantTitle}</p>
                )}
                {item.sku && (
                  <p className="text-xs text-[#A8A29E] mt-0.5">SKU: {item.sku}</p>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-[#1C1917]">
                  {item.quantity} × {item.price.toFixed(2)} {order.currency}
                </p>
                <p className="text-xs text-[#78716C] mt-0.5">
                  = {(item.quantity * item.price).toFixed(2)} {order.currency}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-[#78716C]">
            <span>Subtotal</span>
            <span>{order.subtotalPrice.toFixed(2)} {order.currency}</span>
          </div>
          {order.totalShipping > 0 && (
            <div className="flex justify-between text-sm text-[#78716C]">
              <span>Transport</span>
              <span>{order.totalShipping.toFixed(2)} {order.currency}</span>
            </div>
          )}
          {order.totalTax > 0 && (
            <div className="flex justify-between text-sm text-[#78716C]">
              <span>TVA inclus</span>
              <span>{order.totalTax.toFixed(2)} {order.currency}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-[#1C1917] pt-2 border-t border-[#E7E5E4]">
            <span>Total</span>
            <span className={isPaid ? 'text-[#15803D]' : undefined}>
              {order.totalPrice.toFixed(2)} {order.currency}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
