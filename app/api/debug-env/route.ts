import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not available' }, { status: 404 })
  }
  return NextResponse.json({
    SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID ? `set (${process.env.SHOPIFY_CLIENT_ID.length} chars, starts: ${process.env.SHOPIFY_CLIENT_ID.slice(0,4)})` : 'MISSING',
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ?? 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'MISSING',
  })
}
