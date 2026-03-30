import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrgId } from '@/features/auth/helpers'
import { getPresignedUploadUrl } from '@/lib/r2'
import { db } from '@/lib/db'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4']

function contentTypeToAssetType(ct: string): 'VIDEO' | 'IMAGE' | 'AUDIO' {
  if (VIDEO_TYPES.includes(ct)) return 'VIDEO'
  if (IMAGE_TYPES.includes(ct)) return 'IMAGE'
  if (AUDIO_TYPES.includes(ct)) return 'AUDIO'
  return 'VIDEO'
}

function contentTypeToFolder(ct: string): 'clips' | 'images' | 'audio' {
  if (IMAGE_TYPES.includes(ct)) return 'images'
  if (AUDIO_TYPES.includes(ct)) return 'audio'
  return 'clips'
}

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
})

export async function POST(request: Request) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = uploadSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Date invalide', details: result.error.flatten() }, { status: 400 })
  }

  const { filename, contentType, sizeBytes } = result.data

  const ALLOWED = [...VIDEO_TYPES, ...IMAGE_TYPES, ...AUDIO_TYPES]
  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: 'Tip de fișier neacceptat' }, { status: 400 })
  }

  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const folder = contentTypeToFolder(contentType)
  const assetType = contentTypeToAssetType(contentType)

  try {
    const uploadUrl = await getPresignedUploadUrl(orgId, folder, sanitized, contentType)
    const r2Key = `${orgId}/${folder}/${sanitized}`

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
          sizeBytes: sizeBytes ?? null,
        },
      })
    } else {
      await db.videoAsset.create({
        data: {
          organizationId: orgId,
          filename: sanitized,
          r2Key,
          assetType,
          sizeBytes: sizeBytes ?? null,
          tags: [],
        },
      })
    }

    return NextResponse.json({ uploadUrl, r2Key: `r2://${r2Key}` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Eroare necunoscută'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
