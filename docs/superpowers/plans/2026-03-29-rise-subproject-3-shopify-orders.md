# Rise — Sub-proiect 3: Shopify Orders Sync + Profitabilitate per Produs

**Data:** 2026-03-29
**Status:** Plan de implementare
**Autor:** Claude (Product Manager & Arhitect Software)

---

## Cuprins

1. [Overview și obiective](#1-overview-și-obiective)
2. [Ce nu se schimbă (invarianți)](#2-ce-nu-se-schimbă-invarianți)
3. [Schema Prisma — modele noi](#3-schema-prisma--modele-noi)
4. [Shopify Orders REST API — referință](#4-shopify-orders-rest-api--referință)
5. [Implementare getOrders()](#5-implementare-getorders)
6. [Sync service — orders-sync.ts](#6-sync-service--orders-syncts)
7. [Formula profitabilitate — lib/profitability.ts](#7-formula-profitabilitate--libprofitabilityts)
8. [API Routes noi](#8-api-routes-noi)
9. [Extindere API Routes existente](#9-extindere-api-routes-existente)
10. [UI — pagina /orders](#10-ui--pagina-orders)
11. [UI — extindere /products/[id] cu tab Profitabilitate](#11-ui--extindere-productsid-cu-tab-profitabilitate)
12. [UI — dashboard cards cu date reale](#12-ui--dashboard-cards-cu-date-reale)
13. [Webhook orders/paid](#13-webhook-orderspaid)
14. [Migrație Prisma + deployment](#14-migrație-prisma--deployment)
15. [Sugestii de îmbunătățire față de cerințe](#15-sugestii-de-îmbunătățire-față-de-cerințe)
16. [Checklist verificare](#16-checklist-verificare)
17. [Ordine implementare recomandată](#17-ordine-implementare-recomandată)

---

## 1. Overview și obiective

### Ce rezolvă Sub-proiectul 3

Sub-proiectele 1 și 2 au pus bazele platformei: auth, produse Shopify sincronizate, configurare costuri per produs (COGS, TVA, transport, ambalaj, rată retur), design system, video creation wizard. Platforma știe **ce vinzi** și **cât te costă** fiecare produs. Dar nu știe **câte ai vândut** și, mai important, **cât profit real ai făcut**.

Sub-proiectul 3 completează bucla: preia comenzile reale din Shopify și calculează profitabilitatea netă per produs și per perioadă, cu toate deducerile fiscale specifice pieței românești.

### Obiective concrete

| # | Obiectiv | Livrabil |
|---|----------|----------|
| 1 | Comenzi Shopify stocate local | Model `Order` + `OrderItem` în DB, sync complet cu cursor pagination |
| 2 | `getOrders()` funcțional | Înlocuiește stub-ul cu implementare completă |
| 3 | Profitabilitate per produs calculabilă | `lib/profitability.ts` — pur, testabil, fără side effects |
| 4 | API endpoints noi | `POST /api/shopify/sync-orders`, `GET /api/orders`, `GET /api/products/[id]/profitability` |
| 5 | Pagina /orders | Lista comenzi recente cu status, valoare, produse |
| 6 | Tab Profitabilitate pe /products/[id] | Grafic marjă + detalii calcul per produs |
| 7 | Dashboard cu date reale | KPI-uri conectate la comenzi reale (nu mock data) |
| 8 | Webhook orders/paid | Update automat la comenzi noi fără sync manual |

### De ce contează

Fără date reale de vânzări, platforma afișează cifre fictive (mock data vizibilă în `dashboard/page.tsx`). Cu Sub-proiectul 3, utilizatorul poate vedea:
- Ce marjă netă face **efectiv** per produs (nu estimată)
- Ce produse sunt cu adevărat profitabile după taxe
- Tendința profitabilității în timp

Aceasta este valoarea de bază a platformei Rise — fără ea, e doar un dashboard frumos cu date false.

---

## 2. Ce nu se schimbă (invarianți)

Aceste fișiere/patternuri rămân **neatinse** sau extinse minim:

- `features/shopify/client.ts` — se extinde `getOrders()`, restul rămâne identic
- `features/shopify/sync.ts` (sync produse) — rămâne neatins
- `lib/profitability.ts` — fișier **nou**, nu suprascrie nimic
- `prisma/schema.prisma` — se adaugă modele noi, cele existente nu se modifică
- Multi-tenancy pattern: **orice query Prisma include `organizationId`** — fără excepții
- API routes existente (`/api/shopify/sync`, `/api/products/...`) — rămân compatibile backward

---

## 3. Schema Prisma — modele noi

**Fișier:** `rise/prisma/schema.prisma` — adăugare la sfârșitul fișierului (înainte de enum-uri)

```prisma
// ─── Orders — Sub-proiect 3 ────────────────────────────────────────────────

model Order {
  id              String      @id @default(cuid())
  organizationId  String
  shopifyOrderId  String      // Shopify numeric ID ca string (e.g. "5123456789")
  orderNumber     Int         // #1234 — numărul afișat în admin Shopify
  email           String?
  phone           String?
  financialStatus String      // "paid" | "refunded" | "partially_refunded" | "pending"
  fulfillmentStatus String?   // "fulfilled" | "partial" | "unfulfilled" | null
  totalPrice      Float       // prețul total al comenzii (cu TVA), RON
  subtotalPrice   Float       // subtotal fără shipping
  totalTax        Float       @default(0)
  totalShipping   Float       @default(0)
  currency        String      @default("RON")
  processedAt     DateTime    // când a fost plasată comanda — din Shopify
  cancelledAt     DateTime?
  shopifyData     Json?       // date extra Shopify (adresă, discount codes etc.)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  items           OrderItem[]

  @@unique([organizationId, shopifyOrderId])
  @@index([organizationId])
  @@index([organizationId, processedAt])
  @@index([organizationId, financialStatus])
}

model OrderItem {
  id              String   @id @default(cuid())
  orderId         String
  organizationId  String
  productId       String?  // null dacă produsul a fost șters din Shopify
  shopifyProductId String  // Shopify product ID — pentru matching
  shopifyVariantId String? // Shopify variant ID
  title           String
  variantTitle    String?  // "L / Roșu" etc.
  sku             String?
  quantity        Int
  price           Float    // prețul unitar la momentul comenzii (poate diferi de price curent)
  totalDiscount   Float    @default(0)
  requiresShipping Boolean @default(true)
  createdAt       DateTime @default(now())
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([organizationId])
  @@index([shopifyProductId])
}
```

### Modificări la modele existente

**`Organization`** — adăugare câmp pentru tracking sync comenzi:
```prisma
model Organization {
  // ... câmpuri existente ...
  ordersLastSyncedAt  DateTime?  // tracking sync comenzi separat de produse
  ordersSyncCursor    String?    // last processed Shopify order ID pentru sync incremental

  // relație nouă:
  orders             Order[]
}
```

**`ShopifyConnection`** — adăugare câmp pentru webhook comenzi:
```prisma
model ShopifyConnection {
  // ... câmpuri existente ...
  ordersWebhookId     String?    // Shopify webhook ID pentru orders/paid (pentru deregistrare)
  isOrdersSyncing     Boolean    @default(false)
  ordersLastSyncedAt  DateTime?
}
```

**`Product`** — adăugare relație la OrderItem:
```prisma
model Product {
  // ... câmpuri existente ...
  orderItems  OrderItem[]
}
```

### De ce stocăm comenzile local

1. **Performanță**: calculele de profitabilitate cer agregări complexe (GROUP BY produs, JOIN cu ProductCost) — imposibil eficient direct pe Shopify API
2. **Independență**: dacă conexiunea Shopify cade, datele istorice rămân disponibile
3. **Audit**: comenzile pot fi refund-uite sau anulate ulterior — avem sursa de adevăr
4. **Rate limiting**: Shopify permite 2 req/s; calcule repetate din UI ar depăși limita rapid

---

## 4. Shopify Orders REST API — referință

### Endpoint

```
GET https://{shop}.myshopify.com/admin/api/2025-01/orders.json
```

### Parametri relevanți

| Parametru | Valoare | Descriere |
|-----------|---------|-----------|
| `status` | `any` | Include toate statusurile (paid, refunded etc.) |
| `financial_status` | `paid,partially_refunded` | Filtrare opțională — excludem comenzile neplatite |
| `limit` | `250` | Maximum per pagină |
| `page_info` | `<cursor>` | Cursor pagination — **exclusiv cu `limit`** |
| `since_id` | `<id>` | Pentru sync incremental (după sync inițial) |
| `processed_at_min` | ISO 8601 | Comenzi procesate după această dată |
| `fields` | listă | Câmpuri dorite — reduce payload |

### Headers necesare

```
X-Shopify-Access-Token: {decrypted_token}
```

### Câmpuri necesare (fields param)

```
id,order_number,email,phone,financial_status,fulfillment_status,
total_price,subtotal_price,total_tax,total_shipping_price_set,
currency,processed_at,cancelled_at,line_items
```

### Structura răspuns

```json
{
  "orders": [
    {
      "id": 5123456789012,
      "order_number": 1234,
      "email": "client@example.com",
      "financial_status": "paid",
      "fulfillment_status": "fulfilled",
      "total_price": "299.00",
      "subtotal_price": "279.00",
      "total_tax": "47.73",
      "total_shipping_price_set": {
        "shop_money": { "amount": "20.00", "currency_code": "RON" }
      },
      "currency": "RON",
      "processed_at": "2026-03-15T14:23:45+02:00",
      "cancelled_at": null,
      "line_items": [
        {
          "id": 9876543210,
          "product_id": 7890123456789,
          "variant_id": 4567890123456,
          "title": "Dispozitiv EP-2011",
          "variant_title": null,
          "sku": "EP-2011-BLK",
          "quantity": 1,
          "price": "279.00",
          "total_discount": "0.00",
          "requires_shipping": true
        }
      ]
    }
  ]
}
```

### Cursor pagination pentru orders

Shopify folosește **Link header** pentru cursor pagination — identic cu produsele:

```
Link: <https://shop.myshopify.com/admin/api/2025-01/orders.json?page_info=eyJsYXN0...&limit=250>; rel="next"
```

**Important:** când `page_info` e prezent, **nu poți folosi alți parametri** (nici `since_id`, nici `financial_status`). Filtrul de status se aplică doar la prima cerere; paginile următoare urmează cursor-ul automat.

### Rate limiting

Shopify REST API: **2 cereri/secundă** (bucket de 40, reîncărcare 2/s). La sync inițial cu 1000+ comenzi (4 pagini × 250), e nevoie de pauze de **500ms între pagini**.

### Permisiuni necesare în Custom App

Trebuie adăugat scope **`read_orders`** în setările Custom App din Shopify Admin:
- Admin Shopify → Apps → Develop apps → Rise App → Configuration → Admin API scopes
- Bifează: `read_orders`
- Apasă Save → reinstalează app-ul (noul token va include scope-ul)

---

## 5. Implementare getOrders()

**Fișier:** `rise/features/shopify/client.ts` — înlocuire stub

### Tipuri noi — features/shopify/types.ts

```typescript
// Adaugă la fișierul existent rise/features/shopify/types.ts

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
  skipped: number   // comenzi cu status != paid/partially_refunded
  errors: string[]
}
```

### Implementare client.ts

```typescript
// rise/features/shopify/client.ts — versiune completă cu getOrders()

import { decrypt } from '@/lib/crypto'
import type { ShopifyProduct, ShopifyOrder, ShopifyOrdersResult } from './types'

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
      // ... cod existent neschimbat ...
    },

    async verifyConnection() {
      // ... cod existent neschimbat ...
    },

    /**
     * Preia comenzi din Shopify cu cursor pagination.
     *
     * @param options.pageInfo  - cursor pentru pagina următoare (undefined = prima pagină)
     * @param options.sinceId   - Shopify order ID numeric; returnează comenzi cu ID > sinceId
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
        // Rate limit atins — aruncăm eroare specifică pentru retry în sync service
        throw new Error('SHOPIFY_RATE_LIMIT')
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
```

---

## 6. Sync service — orders-sync.ts

**Fișier nou:** `rise/features/shopify/orders-sync.ts`

Acest serviciu este modelat după `sync.ts` (products sync) cu aceleași patternuri:
- `isSyncing` flag anti-race condition (câmpul `isOrdersSyncing` din `ShopifyConnection`)
- cursor pagination loop cu rate limiting
- `upsert` pentru idempotență (sync-ul poate fi rulat de mai multe ori)
- erori per-comandă izolate (o comandă cu eroare nu oprește tot sync-ul)

```typescript
// rise/features/shopify/orders-sync.ts

import { db } from '@/lib/db'
import { createShopifyClient } from './client'
import type { ShopifyOrder, ShopifyOrdersSyncResult } from './types'

const RATE_LIMIT_DELAY_MS = 500  // 500ms între pagini = 2 req/s
const INITIAL_SYNC_DAYS = 90     // preia ultimele 90 zile la primul sync

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function syncOrders(orgId: string): Promise<ShopifyOrdersSyncResult> {
  const result: ShopifyOrdersSyncResult = {
    synced: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  // 1. Preia conexiunea Shopify
  const connection = await db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
  })

  if (!connection) {
    throw new Error('Shopify connection not found')
  }

  // 2. Anti-race condition
  if (connection.isOrdersSyncing) {
    throw new Error('Orders sync already in progress')
  }

  // 3. Setează flag sync activ
  await db.shopifyConnection.update({
    where: { organizationId: orgId },
    data: { isOrdersSyncing: true },
  })

  try {
    const client = createShopifyClient(connection.shopDomain, connection.accessTokenEncrypted)

    // 4. Determină punctul de start pentru sync
    //    - Dacă avem un cursor salvat (sync incremental) → folosim since_id
    //    - Dacă e primul sync → ultimele 90 zile
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { ordersSyncCursor: true },
    })

    const isInitialSync = !org?.ordersSyncCursor
    const processedAtMin = isInitialSync
      ? new Date(Date.now() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : undefined
    const sinceId = org?.ordersSyncCursor ?? undefined

    let pageInfo: string | undefined = undefined
    let isFirstPage = true
    let latestShopifyOrderId: string | null = null

    // 5. Cursor pagination loop
    do {
      let ordersResult

      try {
        ordersResult = await client.getOrders({
          pageInfo,
          sinceId: isFirstPage ? sinceId : undefined,
          processedAtMin: isFirstPage ? processedAtMin : undefined,
          status: 'any',
          limit: 250,
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'SHOPIFY_RATE_LIMIT') {
          // Rate limit: așteaptă 1s și încearcă din nou
          await sleep(1000)
          ordersResult = await client.getOrders({
            pageInfo,
            sinceId: isFirstPage ? sinceId : undefined,
            processedAtMin: isFirstPage ? processedAtMin : undefined,
            status: 'any',
            limit: 250,
          })
        } else {
          throw err
        }
      }

      isFirstPage = false
      const { orders, nextPageInfo } = ordersResult

      // 6. Procesează fiecare comandă
      for (const order of orders) {
        try {
          await upsertOrder(order, orgId)

          // Tracking stare (paid/partially_refunded = comenzi de inclus în profitabilitate)
          const INCLUDED_STATUSES = ['paid', 'partially_refunded', 'refunded']
          if (INCLUDED_STATUSES.includes(order.financial_status)) {
            result.synced++
          } else {
            result.skipped++
          }

          // Reține cel mai mare Shopify ID pentru cursor incremental
          const shopifyIdNum = order.id
          if (!latestShopifyOrderId || shopifyIdNum > parseInt(latestShopifyOrderId)) {
            latestShopifyOrderId = String(shopifyIdNum)
          }
        } catch (err) {
          result.errors.push(`Order ${order.order_number}: ${String(err)}`)
        }
      }

      pageInfo = nextPageInfo ?? undefined

      // 7. Rate limiting — pauză între pagini
      if (pageInfo) {
        await sleep(RATE_LIMIT_DELAY_MS)
      }
    } while (pageInfo)

    // 8. Salvează cursorul pentru sync incremental ulterior
    if (latestShopifyOrderId) {
      await db.organization.update({
        where: { id: orgId },
        data: { ordersSyncCursor: latestShopifyOrderId },
      })
    }

    // 9. Actualizează timestamp sync
    await db.shopifyConnection.update({
      where: { organizationId: orgId },
      data: { ordersLastSyncedAt: new Date() },
    })
  } finally {
    // 10. Eliberează lock indiferent de erori
    await db.shopifyConnection.update({
      where: { organizationId: orgId },
      data: { isOrdersSyncing: false },
    })
  }

  return result
}

/**
 * Upsert o comandă Shopify în DB.
 * Idempotent — poate fi apelat de mai multe ori pentru aceeași comandă.
 */
async function upsertOrder(order: ShopifyOrder, orgId: string): Promise<void> {
  const shopifyOrderId = String(order.id)
  const totalShipping = parseFloat(
    order.total_shipping_price_set?.shop_money?.amount ?? '0'
  )

  // Extragem ID-urile produselor pentru matching cu Product table
  const productShopifyIds = order.line_items
    .map((li) => li.product_id)
    .filter((id): id is number => id !== null)
    .map(String)

  // Lookup produse locale prin Shopify ID
  const localProducts =
    productShopifyIds.length > 0
      ? await db.product.findMany({
          where: {
            organizationId: orgId,
            shopifyId: { in: productShopifyIds },
          },
          select: { id: true, shopifyId: true },
        })
      : []

  const productMap = new Map(localProducts.map((p) => [p.shopifyId, p.id]))

  // Upsert Order
  await db.order.upsert({
    where: {
      organizationId_shopifyOrderId: {
        organizationId: orgId,
        shopifyOrderId,
      },
    },
    create: {
      organizationId: orgId,
      shopifyOrderId,
      orderNumber: order.order_number,
      email: order.email,
      phone: order.phone,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: parseFloat(order.total_price),
      subtotalPrice: parseFloat(order.subtotal_price),
      totalTax: parseFloat(order.total_tax),
      totalShipping,
      currency: order.currency,
      processedAt: new Date(order.processed_at),
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
      shopifyData: {
        // păstrăm doar câmpurile utile, nu tot payload-ul Shopify
        order_number: order.order_number,
        financial_status: order.financial_status,
      },
      items: {
        create: order.line_items.map((li) => ({
          organizationId: orgId,
          shopifyProductId: String(li.product_id ?? ''),
          shopifyVariantId: li.variant_id ? String(li.variant_id) : null,
          productId: li.product_id ? (productMap.get(String(li.product_id)) ?? null) : null,
          title: li.title,
          variantTitle: li.variant_title,
          sku: li.sku,
          quantity: li.quantity,
          price: parseFloat(li.price),
          totalDiscount: parseFloat(li.total_discount),
          requiresShipping: li.requires_shipping,
        })),
      },
    },
    update: {
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: parseFloat(order.total_price),
      subtotalPrice: parseFloat(order.subtotal_price),
      totalTax: parseFloat(order.total_tax),
      totalShipping,
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
      // Nu upsertăm items la update — sunt imutabile după creare
      // Excepție: refund-urile pot schimba financial_status
    },
  })
}
```

### Note despre sync incremental

După primul sync complet (90 zile), fiecare sync ulterior folosește `since_id` — returnează doar comenzile cu ID mai mare decât ultimul sincronizat. Shopify garantează că ID-urile sunt monoton crescătoare, deci aceasta este o strategie corectă.

**Cazuri edge:**
- Comenzi anulate după sync → `financialStatus` se actualizează la update
- Refund-uri parțiale → `financial_status` devine `partially_refunded` → se actualizează
- Comenzi cu `financial_status: "pending"` → se salvează (skipped în statistici), dar nu se includ în calcule profitabilitate

---

## 7. Formula profitabilitate — lib/profitability.ts

**Fișier nou:** `rise/lib/profitability.ts`

Acest modul este **pur** — primește date ca input, returnează calcule. Fără acces la DB, fără side effects. Astfel poate fi unit-testat trivial.

### Formula completă

```
revenue_brut       = price (prețul de vânzare cu TVA)
revenue_net        = price / 1.19                    (eliminăm TVA colectată la vânzare)
cogs_net           = supplierVatDeductible
                       ? cogs / 1.19                 (furnizor cu TVA → deducem TVA din COGS)
                       : cogs                        (furnizor fără TVA → COGS rămâne)
shopify_fee        = price * shopifyFeeRate          (2% din prețul cu TVA — Shopify aplică pe brut)
gross_profit       = revenue_net - cogs_net - shippingCost - packagingCost - shopify_fee
cost_per_return    = cogs_net + shippingCost + returnShippingCost + packagingCost
                     (pierzi: produsul + transport inițial rambursat + transport retur + ambalaj)
returns_provision  = cost_per_return * returnRate    (provizion bazat pe costul real al unui retur)
profit_pre_tax     = gross_profit - returns_provision
impozit            = calculeaza(incomeTaxType, revenue_brut, profit_pre_tax)
profit_net         = profit_pre_tax - impozit
profit_margin      = profit_net / price * 100        (% din prețul de vânzare cu TVA)
```

 Definiția corectă a unui retur real în Shopify                                                                                                                          
                                                                                                                                                                          
  fulfillment_status: "fulfilled"  +  financial_status: "refunded"     → RETUR REAL                                                                                       
  fulfillment_status: "fulfilled"  +  financial_status: "partially_refunded" → RETUR PARȚIAL                                                                              
  fulfillment_status: "unfulfilled" + financial_status: "refunded"     → ANULARE (NU retur)                                                                               
                                                                                                                                                                          
  Deci ai perfect dreptate: livrat (AWB generat + fulfillment complet) + apoi refundat = retur. Anulările înainte de livrare nu sunt retururi și nu trebuie incluse în    
  calcul.                                                                                                                                                                 
                                                                                                                                                                          
  Cum arată formula corectă                                                                                                                                               
                                         
  // Rata reală calculată din comenzile istorice                                                                                                                          
  const totalFulfilled = await db.orderItem.count({
    where: {                                                                                                                                                              
      productId,                                                                      
      order: { fulfillmentStatus: "fulfilled" }                                                                                                                           
    }                                                                                                                                                                     
  })                                     
                                                                                                                                                                          
  const totalReturned = await db.orderItem.count({                                    
    where: {                             
      productId,                                                                                                                                                          
      order: {
        fulfillmentStatus: "fulfilled",                                                                                                                                   
        financialStatus: { in: ["refunded", "partially_refunded"] }                   
      }                                                                                                                                                                   
    }
  })                                                                                                                                                                      
                                                                                      
  const realReturnRate = totalFulfilled >= 20   // minim 20 comenzi pentru a fi statistic relevant                                                                        
    ? totalReturned / totalFulfilled
    : productCost.returnRate                    // fallback la valoarea configurată manual                                                                                
                                                                                                                                                                          
  Costurile reale ale unui retur (din cercetare)
                                                                                                                                                                          
  Conform legislației românești (OUG 34/2014), un retur costă magazinul:                                                                                                  
                                         
  ┌───────────────────────────────┬────────────────┐                                                                                                                      
  │             Cost              │ Valoare tipică │                                  
  ├───────────────────────────────┼────────────────┤                                                                                                                      
  │ Transport inițial (rambursat) │ ~16 RON        │                                  
  ├───────────────────────────────┼────────────────┤
  │ Transport retur               │ ~16 RON        │                                                                                                                      
  ├───────────────────────────────┼────────────────┤
  │ Total transport per retur     │ ~32 RON        │                                                                                                                      
  ├───────────────────────────────┼────────────────┤                                                                                                                      
  │ Produs deteriorat/nevânzabil  │ variabil       │
  └───────────────────────────────┴────────────────┘                                                                                                                      
                                                                                      
  Asta înseamnă că returnsProvision din plan e calculat prea simplu — nu reflectă costul real. O abordare mai corectă:                                                    
  
  // În loc de: returnsProvision = grossProfit * returnRate                                                                                                               
  // Mai corect:                                                                                                                                                          
  const returnShippingCost = 32  // RON, configurabil per org
  const returnProvision = (shippingCost + returnShippingCost + cogs_net) * returnRate                                                                                     
  // adică: pentru fiecare retur pierzi COGS + 2x transport, nu un % din profit                                                                                           
             --dangerously-skip-permission                                                                                                                                                               
  Rata medie în România (din cercetare)                                                                                                                                   
                                                                                                                                                                          
  - E-commerce general: ~30% (mult mai mare decât default-ul de 5% din plan)                                                                                              
  - Beauty/wellness: mai mică — produse igienice deschise nu pot fi returnate legal (OUG 34/2014, excepție sanitară)
  - Cadouri: medie — dar retururile sezoniere (Crăciun, Valentine's) pot fi 15-20%                                                                                        
                                                                                                                                                                          
  ---                                                                                                                                                                     
  Concluzie pentru plan: Vrei să actualizez 2026-03-29-rise-subproject-3-shopify-orders.md cu:                                                                            
  1. Calculul ratei reale din comenzile fulfilled + refunded                                                                                                              
  2. Formula returnsProvision bazată pe cost real (2x transport + COGS) în loc de % din profit
  3. Default-ul schimbat din 5% la 10% pentru Azora (beauty/wellness, dar cu excepții sanitare)? 

### Calcul impozit per tip

- **MICRO_1**: 1% aplicat pe `revenue_brut` (cifra de afaceri)
- **MICRO_3**: 3% aplicat pe `revenue_brut`
- **PROFIT_16**: 16% aplicat pe `profit_pre_tax` (profit brut)

**Observație importantă**: pentru MICRO (1% sau 3%), impozitul se calculează pe cifra de afaceri **brută** (cu TVA), nu pe profit. Aceasta e specificitatea regimului micro-întreprindere din legislația română. Chiar dacă un produs are profit negativ, impozitul micro se plătește oricum.

```typescript
// rise/lib/profitability.ts

export type IncomeTaxType = 'MICRO_1' | 'MICRO_3' | 'PROFIT_16'

export interface ProductCostInput {
  cogs: number
  supplierVatDeductible: boolean
  shippingCost: number
  packagingCost: number
  vatRate: number       // 0.19 în România
  returnRate: number    // 0.05 = 5%
}

export interface OrgSettings {
  shopifyFeeRate: number   // 0.02 = 2%
  incomeTaxType: IncomeTaxType
}

export interface ProfitabilityResult {
  revenueBrut: number           // prețul de vânzare cu TVA
  revenueNet: number            // fără TVA colectată
  cogsNet: number               // COGS după deducere TVA furnizor (dacă aplicabil)
  shopifyFee: number            // taxa Shopify
  grossProfit: number           // profit brut înainte de provizion retururi
  returnsProvision: number      // provizion retururi
  profitPreTax: number          // profit înainte de impozit
  taxAmount: number             // impozit calculat
  profitNet: number             // profit net final
  profitMargin: number          // % din prețul de vânzare
  breakdowns: {
    vatCollected: number        // TVA colectată la vânzare (informativ)
    vatDeducted: number         // TVA dedusă din COGS (informativ)
    effectiveTaxRate: number    // rata efectivă de impozitare pe vânzare
  }
}

/**
 * Calculează profitabilitatea netă per unitate vândută.
 *
 * @param price    - prețul de vânzare cu TVA (RON)
 * @param cost     - configurația de costuri a produsului
 * @param orgSettings - setările organizației (taxe, tarif Shopify)
 */
export function calculateProductProfitability(
  price: number,
  cost: ProductCostInput,
  orgSettings: OrgSettings
): ProfitabilityResult {
  const { vatRate, returnRate, cogs, supplierVatDeductible, shippingCost, packagingCost } = cost
  const { shopifyFeeRate, incomeTaxType } = orgSettings

  // 1. Revenue
  const revenueBrut = price
  const revenueNet = price / (1 + vatRate)          // elimină TVA colectată
  const vatCollected = revenueBrut - revenueNet

  // 2. COGS net după deducere TVA furnizor
  const cogsNet = supplierVatDeductible
    ? cogs / (1 + vatRate)    // furnizor cu factură cu TVA → deducem TVA
    : cogs                    // furnizor fără TVA (ex. China) → COGS întreg
  const vatDeducted = supplierVatDeductible ? cogs - cogsNet : 0

  // 3. Taxa Shopify — aplicată pe prețul brut
  const shopifyFee = price * shopifyFeeRate

  // 4. Profit brut
  const grossProfit = revenueNet - cogsNet - shippingCost - packagingCost - shopifyFee

  // 5. Provizion retururi
  const returnsProvision = grossProfit * returnRate

  // 6. Profit înainte de impozit
  const profitPreTax = grossProfit - returnsProvision

  // 7. Impozit
  const taxAmount = calculateTax(incomeTaxType, revenueBrut, profitPreTax)

  // 8. Profit net
  const profitNet = profitPreTax - taxAmount

  // 9. Marjă (față de prețul de vânzare cu TVA — baza de referință comercială)
  const profitMargin = (profitNet / revenueBrut) * 100

  // 10. Rata efectivă de impozitare pe vânzare (informativ)
  const effectiveTaxRate = revenueBrut > 0 ? (taxAmount / revenueBrut) * 100 : 0

  return {
    revenueBrut,
    revenueNet,
    cogsNet,
    shopifyFee,
    grossProfit,
    returnsProvision,
    profitPreTax,
    taxAmount,
    profitNet,
    profitMargin,
    breakdowns: {
      vatCollected,
      vatDeducted,
      effectiveTaxRate,
    },
  }
}

function calculateTax(
  type: IncomeTaxType,
  revenueBrut: number,
  profitPreTax: number
): number {
  switch (type) {
    case 'MICRO_1':
      // 1% din cifra de afaceri brută — indiferent de profit
      return revenueBrut * 0.01
    case 'MICRO_3':
      // 3% din cifra de afaceri brută
      return revenueBrut * 0.03
    case 'PROFIT_16':
      // 16% din profit brut — nu se aplică pe pierdere
      return Math.max(0, profitPreTax * 0.16)
    default:
      return 0
  }
}

/**
 * Calculează profitabilitatea agregată pentru un set de comenzi.
 * Util pentru dashboard (totale pe perioadă).
 */
export interface OrderProfitabilityInput {
  quantity: number
  unitPrice: number   // prețul efectiv din comandă (poate diferi de prețul curent)
  cost: ProductCostInput
}

export function calculateOrderProfitability(
  items: OrderProfitabilityInput[],
  orgSettings: OrgSettings
): { totalRevenue: number; totalProfit: number; avgMargin: number } {
  let totalRevenue = 0
  let totalProfit = 0

  for (const item of items) {
    const result = calculateProductProfitability(item.unitPrice, item.cost, orgSettings)
    totalRevenue += result.revenueBrut * item.quantity
    totalProfit += result.profitNet * item.quantity
  }

  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return { totalRevenue, totalProfit, avgMargin }
}

/**
 * Formatează un rezultat de profitabilitate pentru display în UI.
 */
export function formatProfitability(result: ProfitabilityResult, currency = 'RON') {
  const fmt = (n: number) => `${n.toFixed(2)} ${currency}`
  const pct = (n: number) => `${n.toFixed(1)}%`

  return {
    revenueBrut: fmt(result.revenueBrut),
    revenueNet: fmt(result.revenueNet),
    cogsNet: fmt(result.cogsNet),
    shopifyFee: fmt(result.shopifyFee),
    grossProfit: fmt(result.grossProfit),
    returnsProvision: fmt(result.returnsProvision),
    profitPreTax: fmt(result.profitPreTax),
    taxAmount: fmt(result.taxAmount),
    profitNet: fmt(result.profitNet),
    profitMargin: pct(result.profitMargin),
  }
}
```

### Exemplu de calcul (Azora.ro, produs 299 RON)

Input:
- `price = 299 RON`
- `cogs = 80 RON`, `supplierVatDeductible = true` (furnizor cu TVA)
- `shippingCost = 15 RON`, `packagingCost = 5 RON`
- `vatRate = 0.19`, `returnRate = 0.05`
- `shopifyFeeRate = 0.02`, `incomeTaxType = MICRO_1`

Calcul pas cu pas:
```
revenueBrut      = 299.00 RON
revenueNet       = 299 / 1.19       = 251.26 RON
cogsNet          = 80 / 1.19        = 67.23 RON   (furnizor cu TVA)
shopifyFee       = 299 × 0.02       = 5.98 RON
grossProfit      = 251.26 - 67.23 - 15 - 5 - 5.98 = 158.05 RON
returnsProvision = 158.05 × 0.05    = 7.90 RON
profitPreTax     = 158.05 - 7.90    = 150.15 RON
taxAmount        = 299 × 0.01       = 2.99 RON    (MICRO_1: 1% din CA brută)
profitNet        = 150.15 - 2.99    = 147.16 RON
profitMargin     = 147.16 / 299 × 100 = 49.2%
```

---

## 8. API Routes noi

### POST /api/shopify/sync-orders

**Fișier:** `rise/app/api/shopify/sync-orders/route.ts`

```typescript
// rise/app/api/shopify/sync-orders/route.ts

import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { syncOrders } from '@/features/shopify/orders-sync'

export async function POST() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  try {
    const result = await syncOrders(orgId)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Orders sync already in progress') {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

### GET /api/orders

**Fișier:** `rise/app/api/orders/route.ts`

```typescript
// rise/app/api/orders/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const searchParams = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const status = searchParams.get('status') // null = toate
  const skip = (page - 1) * limit

  const where = {
    organizationId: orgId,
    ...(status ? { financialStatus: status } : {}),
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        items: {
          include: {
            // Include produs local pentru link la /products/[id]
          },
        },
      },
      orderBy: { processedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.order.count({ where }),
  ])

  return NextResponse.json({
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
```

### GET /api/products/[id]/profitability

**Fișier:** `rise/app/api/products/[id]/profitability/route.ts`

```typescript
// rise/app/api/products/[id]/profitability/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { calculateProductProfitability } from '@/lib/profitability'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { id } = await params
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  // Verifică că produsul aparține organizației
  const product = await db.product.findFirst({
    where: { id, organizationId: orgId },
    include: { cost: true },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Setările organizației
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { shopifyFeeRate: true, incomeTaxType: true },
  })
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  // Calculăm profitabilitatea per unitate (prețul curent)
  const costInput = product.cost
    ? {
        cogs: product.cost.cogs,
        supplierVatDeductible: product.cost.supplierVatDeductible,
        shippingCost: product.cost.shippingCost,
        packagingCost: product.cost.packagingCost,
        vatRate: product.cost.vatRate,
        returnRate: product.cost.returnRate,
      }
    : {
        cogs: 0,
        supplierVatDeductible: false,
        shippingCost: 0,
        packagingCost: 0,
        vatRate: 0.19,
        returnRate: 0.05,
      }

  const perUnit = calculateProductProfitability(product.price, costInput, {
    shopifyFeeRate: org.shopifyFeeRate,
    incomeTaxType: org.incomeTaxType as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
  })

  // Date reale: comenzi cu acest produs (ultimele 90 zile)
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const orderItems = await db.orderItem.findMany({
    where: {
      organizationId: orgId,
      shopifyProductId: product.shopifyId,
      order: {
        processedAt: { gte: since90 },
        financialStatus: { in: ['paid', 'partially_refunded'] },
      },
    },
    select: {
      quantity: true,
      price: true,
      order: { select: { processedAt: true, orderNumber: true, financialStatus: true } },
    },
    orderBy: { order: { processedAt: 'desc' } },
  })

  const totalQuantitySold = orderItems.reduce((s, i) => s + i.quantity, 0)
  const totalRevenue = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalProfit = perUnit.profitNet * totalQuantitySold  // estimat cu costul curent

  return NextResponse.json({
    perUnit,
    stats: {
      totalQuantitySold,
      totalRevenue,
      totalProfit,
      period: '90d',
    },
    recentOrderItems: orderItems.slice(0, 10),
    hasCostData: !!product.cost,
  })
}
```

---

## 9. Extindere API Routes existente

### PATCH /api/analytics/profitability — date reale

**Fișier:** `rise/app/api/analytics/profitability/route.ts` — extindere `GET`

Înlocuiește `netProfit: null` cu calcul real din comenzi sincronizate:

```typescript
// Înlocuiește secțiunea "Net profit estimate: requires orders data" cu:

const orderItems = await db.orderItem.findMany({
  where: {
    organizationId: orgId,
    order: {
      processedAt: { gte: since },
      financialStatus: { in: ['paid', 'partially_refunded'] },
    },
  },
  include: {
    order: { select: { financialStatus: true } },
    // Include ProductCost prin join pe productId
  },
})

// Simplu: suma totalPrice comenzi din perioadă (revenue real)
const orders = await db.order.findMany({
  where: {
    organizationId: orgId,
    processedAt: { gte: since },
    financialStatus: { in: ['paid', 'partially_refunded'] },
  },
  select: { totalPrice: true },
})

const realRevenue = orders.reduce((s, o) => s + o.totalPrice, 0)

// Returnăm totalRevenue real (din comenzi) în loc de spend × roas
return NextResponse.json({
  storeSummary: {
    totalSpend,
    totalRevenue: realRevenue > 0 ? realRevenue : totalRevenue,
    actualRoas: totalSpend > 0 && realRevenue > 0 ? realRevenue / totalSpend : actualRoas,
    netProfit: null,  // TODO: calcul complet cu ProductCost în Sub-proiect 3+
    hasData: realRevenue > 0 || hasData,
    period,
  },
})
```

---

## 10. UI — pagina /orders

**Fișier nou:** `rise/app/(dashboard)/orders/page.tsx`

Pagina listează comenzile recente cu: număr comandă, data, status financiar, status livrare, valoare totală, produse (thumbnail + titlu condensat).

```typescript
// rise/app/(dashboard)/orders/page.tsx

import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import Link from 'next/link'
import { OrdersTable } from '@/features/orders/components/OrdersTable'
import { SyncOrdersButton } from '@/features/orders/components/SyncOrdersButton'

export default async function OrdersPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const [orders, connection, total] = await Promise.all([
    db.order.findMany({
      where: { organizationId: orgId },
      include: {
        items: {
          select: {
            title: true,
            quantity: true,
            price: true,
            shopifyProductId: true,
          },
          take: 3,  // primele 3 produse per comandă pentru preview
        },
      },
      orderBy: { processedAt: 'desc' },
      take: 50,
    }),
    db.shopifyConnection.findUnique({
      where: { organizationId: orgId },
      select: { ordersLastSyncedAt: true, isOrdersSyncing: true },
    }),
    db.order.count({ where: { organizationId: orgId } }),
  ])

  return (
    <div className="max-w-[1200px] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Comenzi</h1>
          <p className="text-sm text-[#78716C] mt-0.5">
            {total} comenzi sincronizate
            {connection?.ordersLastSyncedAt && (
              <> · Ultima sincronizare: {new Intl.DateTimeFormat('ro', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              }).format(connection.ordersLastSyncedAt)}</>
            )}
          </p>
        </div>
        <SyncOrdersButton isSyncing={connection?.isOrdersSyncing ?? false} />
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-12 text-center">
          <p className="text-[#78716C] text-sm">Nu există comenzi sincronizate.</p>
          <p className="text-[#78716C] text-xs mt-1">
            Apasă „Sincronizează comenzi" pentru a prelua comenzile din Shopify.
          </p>
        </div>
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  )
}
```

**Component `SyncOrdersButton`** — `rise/features/orders/components/SyncOrdersButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  isSyncing: boolean
}

export function SyncOrdersButton({ isSyncing: initialSyncing }: Props) {
  const [loading, setLoading] = useState(initialSyncing)
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/shopify/sync-orders', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const r = data.result
        setResult(`Sincronizat: ${r.synced} noi, ${r.updated} actualizate`)
      } else {
        setResult(`Eroare: ${data.error}`)
      }
    } catch {
      setResult('Eroare de conexiune')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs text-[#78716C]">{result}</span>
      )}
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-4 h-9 bg-[#1C1917] text-white rounded-lg text-sm
                   hover:bg-[#292524] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Se sincronizează...' : 'Sincronizează comenzi'}
      </button>
    </div>
  )
}
```

**Component `OrdersTable`** — `rise/features/orders/components/OrdersTable.tsx`:

Tabel cu coloane: `#Comandă | Data | Status | Produse (preview) | Total | Acțiuni`

Status financiar cu badge-uri colorate:
- `paid` → verde (`#DCFCE7 / #15803D`)
- `partially_refunded` → portocaliu (`#FFF7ED / #D97706`)
- `refunded` → roșu (`#FEF2F2 / #DC2626`)
- `pending` → gri (`#F5F5F4 / #78716C`)

---

## 11. UI — extindere /products/[id] cu tab Profitabilitate

**Fișier modificat:** `rise/app/(dashboard)/products/[id]/page.tsx`

Pagina existentă are layout `grid cols-[1fr 1.8fr]`. Se adaugă **tab-uri** în coloana dreaptă: „Costuri" (formularul existent `ProductCostForm`) și „Profitabilitate" (tab nou).

### Structura cu tab-uri

```typescript
// Înlocuiește:
// <ProductCostForm ... />
// Cu:

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfitabilityTab } from '@/features/products/components/ProfitabilityTab'

// În JSX:
<Tabs defaultValue="costs">
  <TabsList className="mb-4">
    <TabsTrigger value="costs">Costuri</TabsTrigger>
    <TabsTrigger value="profitability">Profitabilitate</TabsTrigger>
  </TabsList>
  <TabsContent value="costs">
    <ProductCostForm
      productId={product.id}
      cost={product.cost}
      price={product.price}
      orgSettings={orgSettings}
    />
  </TabsContent>
  <TabsContent value="profitability">
    <ProfitabilityTab
      productId={product.id}
      price={product.price}
      hasCost={!!product.cost}
    />
  </TabsContent>
</Tabs>
```

### Component ProfitabilityTab

**Fișier nou:** `rise/features/products/components/ProfitabilityTab.tsx`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

interface Props {
  productId: string
  price: number
  hasCost: boolean
}

export function ProfitabilityTab({ productId, price, hasCost }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['product-profitability', productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/profitability`)
      if (!res.ok) throw new Error('Failed to load profitability')
      return res.json()
    },
    enabled: hasCost,   // nu facem fetch dacă nu există costuri configurate
  })

  if (!hasCost) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-6 text-center">
        <p className="text-sm text-[#78716C]">
          Configurează costurile în tab-ul „Costuri" pentru a vedea profitabilitatea.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="h-48 animate-pulse bg-[#F5F5F4] rounded-xl" />
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-6">
        <p className="text-sm text-red-600">Eroare la încărcarea datelor de profitabilitate.</p>
      </div>
    )
  }

  const { perUnit, stats } = data

  // Badge marjă
  const marginColor =
    perUnit.profitMargin >= 30 ? '#15803D' :
    perUnit.profitMargin >= 15 ? '#D97706' :
    '#DC2626'
  const marginBg =
    perUnit.profitMargin >= 30 ? '#DCFCE7' :
    perUnit.profitMargin >= 15 ? '#FFF7ED' :
    '#FEF2F2'

  return (
    <div className="space-y-4">
      {/* Headline metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
          <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Profit net/buc</p>
          <p className="text-[22px] font-bold text-[#1C1917] mt-1">{perUnit.profitNet.toFixed(2)} RON</p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
          <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Marjă netă</p>
          <span
            className="inline-block mt-1 px-3 py-1 rounded-lg text-[18px] font-bold"
            style={{ background: marginBg, color: marginColor }}
          >
            {perUnit.profitMargin.toFixed(1)}%
          </span>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
          <p className="text-xs text-[#78716C] font-medium uppercase tracking-wide">Vânzări 90 zile</p>
          <p className="text-[22px] font-bold text-[#1C1917] mt-1">{stats.totalQuantitySold} buc</p>
          <p className="text-xs text-[#78716C]">{stats.totalRevenue.toFixed(0)} RON venituri</p>
        </div>
      </div>

      {/* Defalcare calcul */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E7E5E4]">
          <h3 className="text-sm font-semibold text-[#1C1917]">Defalcare profitabilitate per unitate</h3>
          <p className="text-xs text-[#78716C] mt-0.5">Calculat pentru prețul curent: {price.toFixed(2)} RON</p>
        </div>
        <div className="divide-y divide-[#E7E5E4]">
          <ProfitRow label="Preț vânzare (brut)" value={perUnit.revenueBrut} />
          <ProfitRow label="— TVA colectată (19%)" value={-perUnit.breakdowns.vatCollected} isDeduction />
          <ProfitRow label="= Venit net (fără TVA)" value={perUnit.revenueNet} isSubtotal />
          <ProfitRow label="— COGS net" value={-perUnit.cogsNet} isDeduction />
          <ProfitRow label="— Transport" value={-data.perUnit.shippingCostDisplay ?? 0} isDeduction />
          <ProfitRow label="— Ambalaj" value={-data.perUnit.packagingCostDisplay ?? 0} isDeduction />
          <ProfitRow label="— Taxă Shopify (2%)" value={-perUnit.shopifyFee} isDeduction />
          <ProfitRow label="= Profit brut" value={perUnit.grossProfit} isSubtotal />
          <ProfitRow label="— Provizion retururi" value={-perUnit.returnsProvision} isDeduction />
          <ProfitRow label="= Profit înainte de impozit" value={perUnit.profitPreTax} isSubtotal />
          <ProfitRow label="— Impozit venit" value={-perUnit.taxAmount} isDeduction />
          <ProfitRow label="= Profit net" value={perUnit.profitNet} isFinal />
        </div>
      </div>
    </div>
  )
}

function ProfitRow({
  label,
  value,
  isDeduction,
  isSubtotal,
  isFinal,
}: {
  label: string
  value: number
  isDeduction?: boolean
  isSubtotal?: boolean
  isFinal?: boolean
}) {
  const textColor = isFinal
    ? value >= 0 ? '#15803D' : '#DC2626'
    : isSubtotal
    ? '#1C1917'
    : '#78716C'

  return (
    <div className={`flex justify-between items-center px-4 py-2.5 ${isFinal ? 'bg-[#F5F5F4]' : ''}`}>
      <span className={`text-sm ${isSubtotal || isFinal ? 'font-semibold' : ''}`} style={{ color: textColor }}>
        {label}
      </span>
      <span
        className={`text-sm font-medium tabular-nums ${isSubtotal || isFinal ? 'font-bold' : ''}`}
        style={{ color: textColor }}
      >
        {value >= 0 ? '+' : ''}{value.toFixed(2)} RON
      </span>
    </div>
  )
}
```

**Notă:** API-ul `/api/products/[id]/profitability` trebuie să returneze și `shippingCostDisplay` și `packagingCostDisplay` (costurile din ProductCost) pentru afișarea defalcată. Adaugă-le în răspunsul GET:

```typescript
// În route.ts, adaugă la return:
perUnit: {
  ...perUnit,
  shippingCostDisplay: costInput.shippingCost,
  packagingCostDisplay: costInput.packagingCost,
},
```

---

## 12. UI — dashboard cards cu date reale

**Fișier modificat:** `rise/app/(dashboard)/dashboard/page.tsx`

Înlocuiește mock data cu date reale din comenzi:

```typescript
// Înlocuiește în DashboardPage():

const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

const [productCount, campaignCount, orderStats] = await Promise.all([
  orgId ? db.product.count({ where: { organizationId: orgId, status: 'active' } }) : 0,
  orgId ? db.campaign.count({ where: { organizationId: orgId, status: 'ACTIVE' } }) : 0,
  orgId
    ? db.order.aggregate({
        where: {
          organizationId: orgId,
          processedAt: { gte: thirtyDaysAgo },
          financialStatus: { in: ['paid', 'partially_refunded'] },
        },
        _sum: { totalPrice: true },
        _count: { id: true },
      })
    : null,
])

const realRevenue = orderStats?._sum.totalPrice ?? 0
const orderCount = orderStats?._count.id ?? 0
const hasRealData = realRevenue > 0
```

Înlocuiește în JSX:
```typescript
// Card "Vânzări totale":
<p className="text-[28px] font-bold text-[#1C1917] mt-2 leading-none">
  {hasRealData ? `${realRevenue.toFixed(0)} RON` : '—'}
</p>
<p className="text-xs text-[#78716C] mt-1">
  {hasRealData ? `${orderCount} comenzi` : 'Sincronizează comenzi pentru date reale'}
</p>
```

---

## 13. Webhook orders/paid

**Fișier modificat:** `rise/app/api/shopify/webhook/route.ts`

Extindere handler existent cu topic `orders/paid`:

```typescript
// În switch/if pe topic, adaugă:

if (topic === 'orders/paid') {
  const order = payload as ShopifyOrder  // tipul din features/shopify/types.ts
  await upsertSingleOrder(order, connection.organizationId)
}
```

Extrage funcția `upsertOrder` din `orders-sync.ts` ca export separat (sau o re-exportă):

```typescript
// rise/features/shopify/orders-sync.ts — adaugă export:
export { upsertOrder }
```

Webhook-ul `orders/paid` se declanșează de Shopify când o comandă este marcată ca plătită. Este cel mai relevant pentru profitabilitate — nu ne interesează comenzile pending sau abandonate.

### Înregistrare webhook în Shopify

Webhookul `orders/paid` trebuie înregistrat în Shopify Admin → Notifications → Webhooks, sau programatic via API:

```bash
curl -X POST "https://SHOP.myshopify.com/admin/api/2025-01/webhooks.json" \
  -H "X-Shopify-Access-Token: TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "orders/paid",
      "address": "https://rise.azora.ro/api/shopify/webhook",
      "format": "json"
    }
  }'
```

Salvăm `webhookId` returnat în câmpul `ordersWebhookId` din `ShopifyConnection` pentru a putea deregistra webhook-ul dacă e nevoie.

**Notă de securitate:** webhook-ul existent verifică deja HMAC-SHA256 — noul topic beneficiază de aceeași protecție. **Nu adăuga niciodată un endpoint webhook fără verificare HMAC.**

### Script utilitar pentru înregistrare webhook

**Fișier nou:** `rise/prisma/register-orders-webhook.ts`

```typescript
// rise/prisma/register-orders-webhook.ts
// Usage: npx tsx prisma/register-orders-webhook.ts

import { db } from '../lib/db'
import { decrypt } from '../lib/crypto'

async function main() {
  const connections = await db.shopifyConnection.findMany()

  for (const conn of connections) {
    const token = decrypt(conn.accessTokenEncrypted)
    const res = await fetch(
      `https://${conn.shopDomain}/admin/api/2025-01/webhooks.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            topic: 'orders/paid',
            address: `https://rise.azora.ro/api/shopify/webhook`,
            format: 'json',
          },
        }),
      }
    )

    const data = await res.json()
    if (res.ok && data.webhook?.id) {
      await db.shopifyConnection.update({
        where: { id: conn.id },
        data: { ordersWebhookId: String(data.webhook.id) },
      })
      console.log(`✓ Webhook registered for ${conn.shopDomain}: ID ${data.webhook.id}`)
    } else {
      console.error(`✗ Failed for ${conn.shopDomain}:`, data)
    }
  }
}

main().catch(console.error).finally(() => process.exit())
```

---

## 14. Migrație Prisma + deployment

### Generare migrație

```bash
cd rise

# Adaugă modelele noi în schema.prisma, apoi:
npm run db:migrate
# Nume sugestiv: add_orders_order_items

# Verifică migrația generată în prisma/migrations/
# Asigură-te că nu modifică tabele existente

# Generează Prisma Client actualizat:
npx prisma generate
```

### Checklist schema înainte de migrate

- [ ] `Order` și `OrderItem` adăugate cu toate câmpurile
- [ ] `Organization.ordersLastSyncedAt` și `ordersSyncCursor` adăugate
- [ ] `ShopifyConnection.isOrdersSyncing` și `ordersLastSyncedAt` adăugate
- [ ] `Product.orderItems OrderItem[]` adăugat
- [ ] Toate `@@unique` și `@@index` definite
- [ ] Relații bidirecționale corecte

### Deployment pe Dokploy (rise.azora.ro)

Dockerfile-ul existent rulează `prisma migrate deploy` la startup — migrația se aplică automat la deploy.

```bash
# Deploy normal prin Dokploy — fără modificări speciale
# Sau manual:
git push origin main  # Dokploy auto-deploy la push

# Verifică că migrația s-a aplicat:
npm run db:studio  # Prisma Studio → verifică tabelele Orders, OrderItems
```

### Environment variables

Nu sunt necesare variabile noi de mediu. Conexiunea Shopify și cheia de criptare sunt deja configurate.

---

## 15. Sugestii de îmbunătățire față de cerințe

### A. Sidebar navigation — adaugă link /orders

Fișierul `rise/components/layout/Sidebar.tsx` nu are link către `/orders`. Adaugă:

```typescript
// În nav items array:
{ href: '/orders', label: 'Comenzi', icon: ShoppingBag },
```

### B. Cache invalidation după sync

Când sync-ul finalizează, React Query cache-ul pentru `orders` și `dashboard` devine stale. Adaugă `router.refresh()` în `SyncOrdersButton` după sync de succes — Next.js App Router va reface server components.

### C. Profitabilitate per perioadă în API

`/api/products/[id]/profitability` returnează fixed 90 zile. Adaugă `?period=30` support:

```typescript
const period = parseInt(req.nextUrl.searchParams.get('period') ?? '90')
const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000)
```

### D. Eroare vizibilă când lipsește scope read_orders

Dacă token-ul Shopify nu are `read_orders`, `getOrders()` returnează `403 Forbidden`. Prinde eroarea specific și afișează un mesaj clar în UI:

```typescript
// În orders-sync.ts, detectează eroarea:
if (res.status === 403) {
  throw new Error('SHOPIFY_MISSING_SCOPE_read_orders')
}

// În /api/shopify/sync-orders/route.ts:
if (message.includes('SHOPIFY_MISSING_SCOPE')) {
  return NextResponse.json({
    error: 'Lipsă permisiuni Shopify. Adaugă scopul read_orders în Custom App și regenerează token-ul.',
  }, { status: 403 })
}
```

### E. Index composite pentru queries de profitabilitate

Query-ul care agregă OrderItem după `shopifyProductId + processedAt` ar beneficia de un index composite:

```prisma
@@index([organizationId, shopifyProductId])
// Adaugă în OrderItem
```

Deja inclus în schema propusă — asigură-te că e prezent.

### F. `tabs` component din shadcn/ui

Pagina `/products/[id]` va folosi `<Tabs>` din shadcn. Dacă nu e instalat:

```bash
cd rise
npx shadcn@latest add tabs
```

### G. Total profit net în dashboard — calcul complet

Calculul exact al profitului net pe dashboard necesită JOIN OrderItem → ProductCost → calcul per linie. Aceasta e o operație costisitoare pentru dashboardul principal. Soluție recomandată: **calcul denormalizat** — stochează `profitNet` calculat pe `OrderItem` la momentul sync-ului. Se adaugă câmpul:

```prisma
model OrderItem {
  // ... câmpuri existente ...
  calculatedProfitNet Float?  // salvat la sync, bazat pe costul din acel moment
}
```

La upsert în `orders-sync.ts`, dacă produsul are `ProductCost`, calculează și salvează `profitNet`. Dacă costurile se schimbă ulterior, un job de recalcul poate actualiza valorile (Sub-proiect 4).

---

## 16. Checklist verificare

### Funcționalitate de bază

- [ ] `POST /api/shopify/sync-orders` returnează `{ success: true, result: { synced, updated, skipped, errors } }`
- [ ] Tabelele `Order` și `OrderItem` sunt populate în DB după sync
- [ ] Comenzile din ultimele 90 zile sunt preluate complet
- [ ] Cursor pagination funcționează (testează cu un shop cu >250 comenzi)
- [ ] Sync incremental cu `since_id` funcționează (al doilea sync preia doar comenzile noi)

### Profitabilitate

- [ ] `calculateProductProfitability(299, { cogs: 80, supplierVatDeductible: true, ... }, { incomeTaxType: 'MICRO_1', ... })` returnează `profitMargin ≈ 49.2%`
- [ ] MICRO_1 impozit = 1% din `revenueBrut` (nu din profit)
- [ ] PROFIT_16 impozit = 16% din `profitPreTax`, minim 0 (nu taxăm pierderea)
- [ ] `supplierVatDeductible = true` → `cogsNet = cogs / 1.19`
- [ ] `supplierVatDeductible = false` → `cogsNet = cogs` (neschimbat)

### API

- [ ] `GET /api/products/[id]/profitability` returnează `{ perUnit, stats, recentOrderItems }`
- [ ] `GET /api/orders` returnează lista paginată cu `pagination.total` corect
- [ ] Toate API routes includ `organizationId` în fiecare query Prisma

### UI

- [ ] Pagina `/orders` se încarcă și afișează comenzile
- [ ] Buton „Sincronizează comenzi" afișează spinner și rezultat
- [ ] `/products/[id]` are tab-urile „Costuri" și „Profitabilitate"
- [ ] Tab „Profitabilitate" afișează defalcarea completă cu valori corecte
- [ ] Dashboard afișează vânzări reale (nu mock data) dacă există comenzi sincronizate

### Webhook

- [ ] Webhook `orders/paid` este înregistrat în Shopify
- [ ] O comandă nouă din Shopify apare în DB în <5 secunde
- [ ] HMAC verificat corect (testează cu `ngrok` în dev sau direct în prod)

### Edge cases

- [ ] Sync cu `isOrdersSyncing = true` returnează 409 Conflict
- [ ] Comenzi anulate (`cancelled_at != null`) sunt stocate dar marcate ca `skipped` în statistici
- [ ] Produse șterse din Shopify → `OrderItem.productId = null` (nu eroare)
- [ ] Token Shopify fără `read_orders` → mesaj de eroare clar în UI

---

## 17. Ordine implementare recomandată

Implementarea se face în această ordine pentru a evita stări intermediare invalide:

1. **Schema Prisma** — adaugă modele, rulează `db:migrate`, verifică în Prisma Studio
2. **types.ts** — adaugă `ShopifyOrder`, `ShopifyOrderLineItem`, `ShopifyOrdersResult`, `ShopifyOrdersSyncResult`
3. **lib/profitability.ts** — implementare pură, fără dependențe de DB; testabilă imediat
4. **features/shopify/client.ts** — înlocuiește `getOrders()` stub
5. **features/shopify/orders-sync.ts** — serviciul de sync complet
6. **API: POST /api/shopify/sync-orders** — testează sync-ul end-to-end cu Shopify real
7. **API: GET /api/orders** — verifică că datele sunt prezente în DB
8. **API: GET /api/products/[id]/profitability** — verifică calculele
9. **Sidebar** — adaugă link `/orders`
10. **UI: /orders page** — pagina cu lista comenzi + buton sync
11. **UI: /products/[id]** — adaugă tab-uri + ProfitabilityTab
12. **UI: dashboard** — conectează KPI-urile la date reale
13. **Webhook orders/paid** — extinde handler-ul existent + înregistrare webhook
14. **prisma/register-orders-webhook.ts** — rulează script pentru a înregistra webhook-ul

---

*Document creat: 2026-03-29. Revizuiește înainte de implementare pentru orice schimbări în API Shopify 2025-01 sau schema Prisma existentă.*
