export interface ShopifyProductVariant {
  id: string
  price: string
  compare_at_price: string | null
  inventory_quantity: number
}

export interface ShopifyProductImage {
  src: string
}

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  status: string
  variants: ShopifyProductVariant[]
  images: ShopifyProductImage[]
}

export interface ShopifySyncResult {
  synced: number
  updated: number
  errors: string[]
}

export interface ShopifyOrderLineItem {
  id: number
  product_id: number | null
  variant_id: number | null
  title: string
  variant_title: string | null
  sku: string | null
  quantity: number
  price: string           // string în Shopify API
  total_discount: string  // string în Shopify API
  requires_shipping: boolean
}

export interface ShopifyOrderShippingPriceSet {
  shop_money: {
    amount: string
    currency_code: string
  }
}

export interface ShopifyOrder {
  id: number
  order_number: number
  email: string | null
  phone: string | null
  financial_status: string
  fulfillment_status: string | null
  total_price: string
  subtotal_price: string
  total_tax: string
  total_shipping_price_set: ShopifyOrderShippingPriceSet | null
  currency: string
  processed_at: string
  cancelled_at: string | null
  line_items: ShopifyOrderLineItem[]
}

export interface ShopifyOrdersResult {
  orders: ShopifyOrder[]
  nextPageInfo: string | null
}

export interface ShopifyOrdersSyncResult {
  synced: number
  updated: number
  skipped: number   // comenzi cu status != paid/partially_refunded/refunded (ex. pending, cancelled)
  errors: string[]
}
