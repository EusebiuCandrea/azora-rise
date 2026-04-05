import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { r2 } from '@/lib/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { Readable } from 'stream'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get('assetId')
  if (!assetId) return NextResponse.json({ error: 'assetId lipsă' }, { status: 400 })

  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const asset = await db.videoAsset.findFirst({
    where: { id: assetId, organizationId: orgId },
    select: { r2Key: true, filename: true, assetType: true },
  })
  if (!asset) return NextResponse.json({ error: 'Asset negăsit' }, { status: 404 })

  const obj = await r2.send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: asset.r2Key,
  }))
  if (!obj.Body) return NextResponse.json({ error: 'Fișier gol' }, { status: 500 })

  const chunks: Uint8Array[] = []
  for await (const chunk of obj.Body as Readable) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  const ext = asset.filename.split('.').pop() ?? 'bin'
  const contentType = ext === 'mp4' ? 'video/mp4'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : 'application/octet-stream'

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(asset.filename)}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
