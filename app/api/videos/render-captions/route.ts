import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { r2, getPresignedDownloadUrl } from '@/lib/r2'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { groupWordsIntoLines, generateASSSubtitles } from '@/lib/captions'
import type { CaptionWord } from '@/lib/captions'
import { spawn } from 'child_process'
import { createWriteStream, createReadStream, unlinkSync, existsSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

export const maxDuration = 300

const wordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
})

const bodySchema = z.object({
  assetId: z.string().min(1),
  words: z.array(wordSchema).min(1),
  outputFormat: z.enum(['9x16', '4x5', '1x1', '16x9']).default('9x16'),
  offset: z.number().min(-2).max(2).default(0),
})

function burnSubtitles(inputPath: string, assPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i', inputPath,
      '-vf', `ass=${assPath}`,
      '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ])
    const stderr: string[] = []
    proc.stderr.on('data', (d) => stderr.push(d.toString()))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg subtitle burn failed:\n${stderr.join('')}`))
    })
    proc.on('error', reject)
  })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Date invalide', details: parsed.error.flatten() }, { status: 400 })
  }

  const { assetId, words, outputFormat, offset } = parsed.data

  const asset = await db.videoAsset.findFirst({
    where: { id: assetId, organizationId: orgId, assetType: 'VIDEO' },
    select: { r2Key: true, filename: true },
  })
  if (!asset) return NextResponse.json({ error: 'Asset negăsit' }, { status: 404 })

  const suffix = Math.random().toString(36).slice(2, 8)
  const inputPath = join(tmpdir(), `rise-cap-in-${suffix}.mp4`)
  const assPath = join(tmpdir(), `rise-cap-${suffix}.ass`)
  const outputPath = join(tmpdir(), `rise-cap-out-${suffix}.mp4`)

  try {
    // Download source video from R2
    const obj = await r2.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: asset.r2Key,
    }))
    if (!obj.Body) throw new Error('R2 body gol')
    await pipeline(obj.Body as Readable, createWriteStream(inputPath))

    // Apply timing offset and generate ASS subtitle file
    const shifted = (words as CaptionWord[]).map(w => ({
      ...w,
      start: Math.max(0, w.start + offset),
      end: Math.max(0, w.end + offset),
    }))
    const lines = groupWordsIntoLines(shifted)
    const assContent = generateASSSubtitles(lines, outputFormat)
    writeFileSync(assPath, assContent, 'utf-8')

    // Burn subtitles with FFmpeg
    await burnSubtitles(inputPath, assPath, outputPath)

    // Upload result to R2
    const baseName = asset.filename.replace(/\.[^.]+$/, '')
    const outputKey = `${orgId}/rendered/${baseName}-captions-${outputFormat}-${suffix}.mp4`
    const { size } = statSync(outputPath)

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: outputKey,
      Body: createReadStream(outputPath),
      ContentType: 'video/mp4',
      ContentLength: size,
    }))

    // Save rendered asset in DB — upsert to handle re-renders of the same video
    const rendered = await db.videoAsset.upsert({
      where: { parentAssetId_outputFormat: { parentAssetId: assetId, outputFormat: `${outputFormat}-captions` } },
      update: { r2Key: outputKey, sizeBytes: size, updatedAt: new Date() },
      create: {
        organizationId: orgId,
        filename: `${baseName}-captions-${outputFormat}.mp4`,
        r2Key: outputKey,
        assetType: 'RENDERED',
        sizeBytes: size,
        tags: ['caption'],
        parentAssetId: assetId,
        outputFormat: `${outputFormat}-captions`,
      },
    })

    const downloadUrl = await getPresignedDownloadUrl(outputKey, true)
    return NextResponse.json({ assetId: rendered.id, downloadUrl, filename: rendered.filename })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Eroare la render'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    for (const p of [inputPath, assPath, outputPath]) {
      if (existsSync(p)) unlinkSync(p)
    }
  }
}
