import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getCurrentOrgId } from '@/features/auth/helpers'
import crypto from 'crypto'

const SCOPES = 'read_products,write_products,read_orders,read_inventory,read_product_listings,write_product_listings'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const session = await auth()
  const orgId = session ? await getCurrentOrgId(session as any) : null
  if (!orgId) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const shop = req.nextUrl.searchParams.get('shop')
  if (!shop || !shop.endsWith('.myshopify.com')) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_shop`)
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/settings?error=config_error`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  const redirectUri = `${appUrl}/api/shopify/callback`
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('shopify_oauth_state', state, { httpOnly: true, maxAge: 600, sameSite: 'lax', secure: appUrl.startsWith('https') })
  response.cookies.set('shopify_oauth_org', orgId, { httpOnly: true, maxAge: 600, sameSite: 'lax', secure: appUrl.startsWith('https') })
  return response
}
