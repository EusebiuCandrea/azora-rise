import { decrypt } from '@/lib/crypto'
import type { ShopifyOrder, ShopifyOrdersResult, ShopifyProduct } from './types'

const SHOP_DOMAIN_REGEX = /^[a-z0-9-]+\.myshopify\.com$/

export function validateShopDomain(domain: string): boolean {
  return SHOP_DOMAIN_REGEX.test(domain)
}

export function createShopifyClient(shopDomain: string, accessTokenEncrypted: string) {
  if (!validateShopDomain(shopDomain)) {
    throw new Error(`Invalid Shopify domain: ${shopDomain}`)
  }
  const accessToken = decrypt(accessTokenEncrypted)
  const baseUrl = `https://${shopDomain}/admin/api/2025-01`

  return {
    async getProducts(limit = 250, pageInfo?: string) {
      const params = new URLSearchParams({
        limit: String(limit),
        fields: 'id,title,handle,variants,images,status',
      })
      if (pageInfo) params.set('page_info', pageInfo)
      const res = await fetch(`${baseUrl}/products.json?${params}`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      })
      if (!res.ok) throw new Error(`Shopify API error: ${res.status}`)
      const linkHeader = res.headers.get('Link')
      const nextPageInfo = parseLinkHeader(linkHeader)
      const data = await res.json() as { products: ShopifyProduct[] }
      return { data, nextPageInfo }
    },

    /** Validare rapidă: token funcționează? */
    async verifyConnection() {
      const res = await fetch(`${baseUrl}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      })
      return res.ok
    },

    /**
     * Preia comenzi din Shopify cu cursor pagination.
     *
     * @param options.pageInfo  - cursor pentru pagina următoare (undefined = prima pagină)
     * @param options.sinceId   - Shopify order ID; returnează comenzi cu ID > sinceId
     *                            IMPORTANT: sinceId NU poate fi combinat cu pageInfo
     * @param options.processedAtMin - ISO 8601 string; filtrare după dată
     * @param options.status    - "any" (default) | "open" | "closed" | "cancelled"
     * @param options.financialStatus - "paid" | "partially_refunded" | "any" (default)
     */
    async getOrders(options: {
      pageInfo?: string
      sinceId?: string
      processedAtMin?: string
      status?: string
      financialStatus?: string
      limit?: number
    } = {}): Promise<ShopifyOrdersResult> {
      const {
        pageInfo,
        sinceId,
        processedAtMin,
        status = 'any',
        financialStatus,
        limit = 250,
      } = options

      const params = new URLSearchParams({
        limit: String(limit),
        fields: [
          'id',
          'order_number',
          'email',
          'phone',
          'financial_status',
          'fulfillment_status',
          'total_price',
          'subtotal_price',
          'total_tax',
          'total_shipping_price_set',
          'currency',
          'processed_at',
          'cancelled_at',
          'line_items',
        ].join(','),
      })

      // Când pageInfo e prezent, NU adăugăm alți parametri (Shopify returnează 422)
      if (pageInfo) {
        params.set('page_info', pageInfo)
      } else {
        params.set('status', status)
        if (financialStatus) params.set('financial_status', financialStatus)
        if (sinceId) params.set('since_id', sinceId)
        if (processedAtMin) params.set('processed_at_min', processedAtMin)
      }

      const res = await fetch(`${baseUrl}/orders.json?${params}`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (res.status === 429) {
        throw new Error('SHOPIFY_RATE_LIMIT')
      }

      if (res.status === 403) {
        throw new Error('SHOPIFY_MISSING_SCOPE_read_orders')
      }

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Shopify Orders API error: ${res.status} — ${errorText}`)
      }

      const linkHeader = res.headers.get('Link')
      const nextPageInfo = parseLinkHeader(linkHeader)
      const data = await res.json() as { orders: ShopifyOrder[] }

      return {
        orders: data.orders ?? [],
        nextPageInfo,
      }
    },
  }
}

function parseLinkHeader(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/<[^>]*page_info=([^&>]*).*?>;\s*rel="next"/)
  return match?.[1] ?? null
}
