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
