import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { encrypt } from '@/lib/crypto'
import { db } from '@/lib/db'
import { syncProducts } from '@/features/shopify/sync'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const { searchParams } = req.nextUrl

  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')
  const hmac = searchParams.get('hmac')

  if (!code || !shop || !state || !hmac) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_callback`)
  }

  const storedState = req.cookies.get('shopify_oauth_state')?.value
  const orgId = req.cookies.get('shopify_oauth_org')?.value

  if (!storedState || state !== storedState || !orgId) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`)
  }

  // Verify HMAC
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (!clientSecret) {
    return NextResponse.redirect(`${appUrl}/settings?error=config_error`)
  }

  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => { if (key !== 'hmac') params[key] = value })
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const digest = crypto.createHmac('sha256', clientSecret).update(message).digest('hex')

  if (digest !== hmac) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_hmac`)
  }

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: clientSecret,
      code,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`)
  }

  const { access_token } = await tokenRes.json()
  const webhookSecret = crypto.randomBytes(32).toString('hex')

  await db.shopifyConnection.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      shopDomain: shop,
      accessTokenEncrypted: encrypt(access_token),
      webhookSecret,
    },
    update: {
      shopDomain: shop,
      accessTokenEncrypted: encrypt(access_token),
      webhookSecret,
    },
  })

  syncProducts(orgId).catch((err) => console.error('[shopify/callback] sync error:', err))

  const response = NextResponse.redirect(`${appUrl}/settings?success=shopify_connected`)
  response.cookies.delete('shopify_oauth_state')
  response.cookies.delete('shopify_oauth_org')
  return response
}
