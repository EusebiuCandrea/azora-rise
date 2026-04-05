import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { r2, getPresignedDownloadUrl } from '@/lib/r2'
import { resizeImage, ImageRenderFormat } from '@/lib/sharp-render'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import { z } from 'zod'

const bodySchema = z.object({
  outputFormat: z.enum(['9x16', '4x5', '1x1', '16x9']),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params

  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Format invalid' }, { status: 400 })

  const { outputFormat } = parsed.data

  const asset = await db.videoAsset.findFirst({
    where: { id: assetId, organizationId: orgId, assetType: 'IMAGE' },
    select: { id: true, filename: true, r2Key: true },
  })
  if (!asset) return NextResponse.json({ error: 'Asset negăsit' }, { status: 404 })

  try {
    // Download from R2
    const obj = await r2.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: asset.r2Key,
    }))
    if (!obj.Body) throw new Error('R2 body gol')

    const chunks: Buffer[] = []
    for await (const chunk of obj.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const inputBuffer = Buffer.concat(chunks)

    // Resize with Sharp
    const outputBuffer = await resizeImage(inputBuffer, outputFormat as ImageRenderFormat)

    // Upload result to R2
    const baseName = asset.filename.replace(/\.[^.]+$/, '')
    const outputKey = `${orgId}/rendered/${baseName}-${outputFormat}.jpg`

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: outputKey,
      Body: outputBuffer,
      ContentType: 'image/jpeg',
      ContentLength: outputBuffer.length,
    }))

    // Upsert rendered asset in DB
    await db.videoAsset.upsert({
      where: { parentAssetId_outputFormat: { parentAssetId: assetId, outputFormat } },
      update: { r2Key: outputKey, sizeBytes: outputBuffer.length, updatedAt: new Date() },
      create: {
        organizationId: orgId,
        filename: `${baseName}-${outputFormat}.jpg`,
        r2Key: outputKey,
        assetType: 'RENDERED',
        sizeBytes: outputBuffer.length,
        tags: [],
        parentAssetId: assetId,
        outputFormat,
      },
    })

    const downloadUrl = await getPresignedDownloadUrl(outputKey, true)
    return NextResponse.json({ downloadUrl, filename: `${baseName}-${outputFormat}.jpg` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Eroare la procesare'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
