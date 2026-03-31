type OrderItem = {
  title: string
  quantity: number
  price: number
  shopifyProductId: string
}

type Order = {
  id: string
  shopifyOrderId: string
  orderNumber: number
  processedAt: string | Date
  financialStatus: string
  fulfillmentStatus: string | null
  totalPrice: number
  currency: string
  items: OrderItem[]
}

interface Props {
  orders: Order[]
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: '#DCFCE7', text: '#15803D', label: 'Plătit' },
  partially_refunded: { bg: '#FFF7ED', text: '#D97706', label: 'Parțial rambursat' },
  refunded: { bg: '#FEF2F2', text: '#DC2626', label: 'Rambursat' },
  pending: { bg: '#F5F5F4', text: '#78716C', label: 'În așteptare' },
  cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Anulat' },
  voided: { bg: '#FEF2F2', text: '#DC2626', label: 'Stornat' },
}

const VOIDED_STATUSES = new Set(['voided', 'cancelled'])

const FULFILLMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  fulfilled: { bg: '#DCFCE7', text: '#15803D', label: 'Livrat' },
  partial: { bg: '#FFF7ED', text: '#D97706', label: 'Parțial' },
  unfulfilled: { bg: '#F5F5F4', text: '#78716C', label: 'Nelivrat' },
}

export function OrdersTable({ orders }: Props) {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#E7E5E4] bg-[#FAFAF9]">
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">#Comandă</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Data</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Livrare</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Produse</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-[#78716C] uppercase tracking-wide">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E7E5E4]">
          {orders.map((order) => {
            const statusStyle = STATUS_STYLES[order.financialStatus] ?? STATUS_STYLES.pending
            const fulfillmentStyle = FULFILLMENT_STYLES[order.fulfillmentStatus ?? 'unfulfilled'] ?? FULFILLMENT_STYLES.unfulfilled
            const date = new Date(order.processedAt)
            return (
              <tr key={order.id} className="hover:bg-[#FAFAF9] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#1C1917]">
                  <a
                    href={`https://admin.shopify.com/orders/${order.shopifyOrderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#D4AF37] transition-colors"
                  >
                    #{order.orderNumber}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-[#78716C]">
                  {date.toLocaleDateString('ro', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: statusStyle.bg, color: statusStyle.text }}
                  >
                    {statusStyle.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {order.fulfillmentStatus && !VOIDED_STATUSES.has(order.financialStatus) ? (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: fulfillmentStyle.bg, color: fulfillmentStyle.text }}
                    >
                      {fulfillmentStyle.label}
                    </span>
                  ) : (
                    <span className="text-xs text-[#C4C0BA]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[#78716C] max-w-[240px]">
                  {order.items.slice(0, 2).map((item, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {item.title} ×{item.quantity}
                    </span>
                  ))}
                  {order.items.length > 2 && (
                    <span className="text-[#78716C]"> +{order.items.length - 2} mai multe</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-[#1C1917] text-right">
                  {order.totalPrice.toFixed(2)} {order.currency}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
