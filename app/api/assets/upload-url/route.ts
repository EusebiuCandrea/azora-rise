import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrgId } from '@/features/auth/helpers'
import { getPresignedUploadUrlForKey } from '@/lib/r2'
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

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
  adId: z.string().optional(),
})

export async function POST(request: Request) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = uploadSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Date invalide', details: result.error.flatten() }, { status: 400 })
  }

  const { filename, contentType, sizeBytes, adId } = result.data

  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: 'Tip de fișier neacceptat' }, { status: 400 })
  }

  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const assetType = contentTypeToAssetType(contentType)

  let r2Key: string
  let resolvedAdId: string | null = null

  if (adId) {
    // Verify ad belongs to this org and fetch product
    const ad = await db.videoAd.findFirst({
      where: { id: adId, organizationId: orgId },
      include: { product: { select: { title: true } } },
    })
    if (!ad) return NextResponse.json({ error: 'Reclamă negăsită' }, { status: 404 })

    const productSlug = toSlug(ad.product.title)
    const adSlug = toSlug(ad.name)
    r2Key = `${orgId}/assets/${productSlug}/${adSlug}-${adId.slice(-6)}/${sanitized}`
    resolvedAdId = adId
  } else {
    r2Key = `${orgId}/assets/_unassigned/${sanitized}`
  }

  try {
    const uploadUrl = await getPresignedUploadUrlForKey(r2Key, contentType)

    const existing = await db.videoAsset.findFirst({
      where: { organizationId: orgId, r2Key },
      select: { id: true },
    })

    if (existing) {
      await db.videoAsset.update({
        where: { id: existing.id },
        data: { filename: sanitized, assetType, sizeBytes: sizeBytes ?? null, adId: resolvedAdId },
      })
    } else {
      await db.videoAsset.create({
        data: {
          organizationId: orgId,
          filename: sanitized,
          r2Key,
          assetType,
          sizeBytes: sizeBytes ?? null,
          adId: resolvedAdId,
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
