import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const url = new URL('/settings', appUrl)
  url.searchParams.set('error', 'manual_connect_only')

  if (req.nextUrl.searchParams.has('code')) {
    url.searchParams.set('detail', 'OAuth Shopify a fost dezactivat pentru acest proiect.')
  }

  return NextResponse.redirect(url)
}
