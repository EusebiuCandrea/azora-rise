import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const url = new URL('/settings', appUrl)
  url.searchParams.set('error', 'manual_connect_only')

  const shop = req.nextUrl.searchParams.get('shop')
  if (shop) {
    url.searchParams.set('detail', `Folosește formularul manual pentru ${shop}.`)
  }

  return NextResponse.redirect(url)
}
