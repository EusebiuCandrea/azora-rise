import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { r2 } from '@/lib/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { GoogleGenAI } from '@google/genai'
import { spawn } from 'child_process'
import { createWriteStream, unlinkSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { CaptionWord } from '@/lib/captions'

export const maxDuration = 120

const bodySchema = z.object({ assetId: z.string().min(1) })

const MODEL = 'gemini-2.5-flash'

const PROMPT = `Transcribe this audio and return ONLY a JSON array of word objects with exact timestamps.
Each object: {"word":"...", "start":0.00, "end":0.00} — start/end in seconds, 2 decimal places.
Return ONLY the raw JSON array, no markdown, no explanation.`

function parseError(raw: string): string {
  try {
    const obj = JSON.parse(raw.slice(raw.indexOf('{')))
    const status: string = obj?.error?.status ?? ''
    const msg: string = obj?.error?.message ?? ''
    if (status === 'RESOURCE_EXHAUSTED' || status === 'TOO_MANY_REQUESTS') return 'Limita per minut Gemini atinsă. Încearcă din nou în 60 de secunde.'
    if (status === 'UNAVAILABLE') return 'Serverul Gemini este supraîncărcat. Încearcă din nou în câteva secunde.'
    if (msg) return msg.slice(0, 200)
  } catch { /* not JSON */ }
  if (raw.includes('RESOURCE_EXHAUSTED')) return 'Quota Gemini epuizată. Încearcă din nou mâine sau activează billing pe Google Cloud.'
  if (raw.includes('UNAVAILABLE')) return 'Serverul Gemini este supraîncărcat. Încearcă din nou.'
  return raw.split('\n')[0].slice(0, 200) || 'Eroare la transcripție.'
}

function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '-y', outputPath,
    ])
    const stderr: string[] = []
    proc.stderr.on('data', (d) => stderr.push(d.toString()))
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.join(''))))
    proc.on('error', reject)
  })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'assetId lipsă' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY neconfigurat' }, { status: 500 })

  const asset = await db.videoAsset.findFirst({
    where: { id: parsed.data.assetId, organizationId: orgId, assetType: 'VIDEO' },
    select: { r2Key: true, filename: true },
  })
  if (!asset) return NextResponse.json({ error: 'Asset negăsit' }, { status: 404 })

  const suffix = Math.random().toString(36).slice(2, 8)
  const videoPath = join(tmpdir(), `rise-cap-${suffix}.mp4`)
  const audioPath = join(tmpdir(), `rise-cap-${suffix}.mp3`)

  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: asset.r2Key }))
    if (!obj.Body) throw new Error('R2 body gol')
    await pipeline(obj.Body as Readable, createWriteStream(videoPath))
    await extractAudio(videoPath, audioPath)

    const audioBase64 = readFileSync(audioPath).toString('base64')
    const ai = new GoogleGenAI({ apiKey })

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{
          parts: [
            { inlineData: { mimeType: 'audio/mp3', data: audioBase64 } },
            { text: PROMPT },
          ],
        }],
      })
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('Răspuns JSON invalid de la Gemini')
      const words: CaptionWord[] = JSON.parse(match[0])
      return NextResponse.json({ words })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      return NextResponse.json({ error: parseError(error.message) }, { status: 500 })
    }
  } finally {
    for (const p of [videoPath, audioPath]) {
      if (existsSync(p)) unlinkSync(p)
    }
  }
}
