import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { validateShopDomain, createShopifyClient } from '@/features/shopify/client'
import { encrypt } from '@/lib/crypto'
import { db } from '@/lib/db'
import { syncProducts } from '@/features/shopify/sync'

const connectSchema = z.object({
  shopDomain: z.string(),
  accessToken: z.string().min(1),
  webhookSecret: z.string().min(1),
})

export async function POST(request: Request) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
  }

  const body = await request.json()
  const result = connectSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request', details: result.error.flatten() }, { status: 400 })
  }

  const { shopDomain, accessToken, webhookSecret } = result.data

  // Validare SSRF — previne request-uri la domenii arbitrare
  if (!validateShopDomain(shopDomain)) {
    return NextResponse.json({ error: 'Invalid Shopify domain' }, { status: 400 })
  }

  // Verifică că token-ul funcționează înainte de a-l salva
  const tempClient = createShopifyClient(shopDomain, encrypt(accessToken))
  let verifyError = ''
  const isValid = await tempClient.verifyConnection().catch((err) => {
    verifyError = err?.message ?? 'unknown'
    return false
  })
  if (!isValid) {
    console.error('[shopify/connect] verifyConnection failed:', verifyError)
    // Testăm direct ca să vedem statusul exact
    const probe = await fetch(`https://${shopDomain}/admin/api/2025-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    }).catch((e) => ({ ok: false, status: 0, statusText: e.message }))
    const detail = `HTTP ${(probe as any).status} ${(probe as any).statusText}`
    console.error('[shopify/connect] probe result:', detail)
    return NextResponse.json({ error: `Invalid Shopify access token (${detail})` }, { status: 400 })
  }

  const accessTokenEncrypted = encrypt(accessToken)

  await db.shopifyConnection.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      shopDomain,
      accessTokenEncrypted,
      webhookSecret,
    },
    update: {
      shopDomain,
      accessTokenEncrypted,
      webhookSecret,
    },
  })

  // Sync async — fire-and-forget (nu blochează response-ul)
  syncProducts(orgId).catch((err) => {
    console.error('[shopify/connect] sync error:', err)
  })

  return NextResponse.json({ success: true })
}
