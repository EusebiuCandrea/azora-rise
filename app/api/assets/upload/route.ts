import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { r2 } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { db } from '@/lib/db'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4']
const ALLOWED = [...VIDEO_TYPES, ...IMAGE_TYPES, ...AUDIO_TYPES]

function contentTypeToAssetType(ct: string): 'VIDEO' | 'IMAGE' | 'AUDIO' {
  if (VIDEO_TYPES.includes(ct)) return 'VIDEO'
  if (IMAGE_TYPES.includes(ct)) return 'IMAGE'
  return 'AUDIO'
}

function contentTypeToFolder(ct: string): 'clips' | 'images' | 'audio' {
  if (IMAGE_TYPES.includes(ct)) return 'images'
  if (AUDIO_TYPES.includes(ct)) return 'audio'
  return 'clips'
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fișier lipsă' }, { status: 400 })

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Tip de fișier neacceptat' }, { status: 400 })
  }

  const MAX_BYTES = 500 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fișierul depășește 500 MB' }, { status: 400 })
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const folder = contentTypeToFolder(file.type)
  const assetType = contentTypeToAssetType(file.type)
  const r2Key = `${orgId}/${folder}/${sanitized}`

  const bytes = await file.arrayBuffer()

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
    Body: Buffer.from(bytes),
    ContentType: file.type,
  }))

  const existingAsset = await db.videoAsset.findFirst({
    where: {
      organizationId: orgId,
      r2Key,
    },
    select: { id: true },
  })

  if (existingAsset) {
    await db.videoAsset.update({
      where: { id: existingAsset.id },
      data: {
        filename: sanitized,
        assetType,
        sizeBytes: file.size,
      },
    })
  } else {
    await db.videoAsset.create({
      data: {
        organizationId: orgId,
        filename: sanitized,
        r2Key,
        assetType,
        sizeBytes: file.size,
        tags: [],
      },
    })
  }

  return NextResponse.json({ ok: true, r2Key })
}
