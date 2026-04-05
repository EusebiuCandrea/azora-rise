import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { r2, getPresignedDownloadUrl } from '@/lib/r2'
import { renderVideo, RenderFormat } from '@/lib/ffmpeg'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { createWriteStream, createReadStream, statSync } from 'fs'
import { unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { z } from 'zod'

export const maxDuration = 300

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
    where: { id: assetId, organizationId: orgId, assetType: 'VIDEO' },
    select: { id: true, filename: true, r2Key: true },
  })
  if (!asset) return NextResponse.json({ error: 'Asset negăsit' }, { status: 404 })

  const suffix = Math.random().toString(36).slice(2, 8)
  const inputPath = join(tmpdir(), `rise-input-${suffix}.mp4`)
  const outputPath = join(tmpdir(), `rise-output-${suffix}.mp4`)

  try {
    // Download from R2 to temp file
    const obj = await r2.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: asset.r2Key,
    }))
    if (!obj.Body) throw new Error('R2 body gol')
    await pipeline(obj.Body as Readable, createWriteStream(inputPath))

    // Render with FFmpeg
    await renderVideo(inputPath, outputPath, outputFormat as RenderFormat)

    // Upload result to R2
    const baseName = asset.filename.replace(/\.[^.]+$/, '')
    const outputKey = `${orgId}/rendered/${baseName}-${outputFormat}.mp4`
    const { size } = statSync(outputPath)

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: outputKey,
      Body: createReadStream(outputPath),
      ContentType: 'video/mp4',
      ContentLength: size,
    }))

    // Upsert rendered asset in DB
    await db.videoAsset.upsert({
      where: { parentAssetId_outputFormat: { parentAssetId: assetId, outputFormat } },
      update: { r2Key: outputKey, sizeBytes: size, updatedAt: new Date() },
      create: {
        organizationId: orgId,
        filename: `${baseName}-${outputFormat}.mp4`,
        r2Key: outputKey,
        assetType: 'RENDERED',
        sizeBytes: size,
        tags: [],
        parentAssetId: assetId,
        outputFormat,
      },
    })

    const downloadUrl = await getPresignedDownloadUrl(outputKey, true)
    return NextResponse.json({ downloadUrl, filename: `${baseName}-${outputFormat}.mp4` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Eroare la render'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}
