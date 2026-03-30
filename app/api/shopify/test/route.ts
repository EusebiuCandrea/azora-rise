import { NextRequest, NextResponse } from 'next/server'

// Endpoint de diagnostic — testează un token Shopify direct
// GET /api/shopify/test?domain=azora-shop-3.myshopify.com&token=shpat_xxx
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const domain = searchParams.get('domain')
  const token = searchParams.get('token')

  if (!domain || !token) {
    return NextResponse.json({ error: 'Params: domain + token required' }, { status: 400 })
  }

  const url = `https://${domain}/admin/api/2025-01/shop.json`

  try {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token },
    })
    const body = await res.text()
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      url,
      body: body.slice(0, 500),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
