# Video Library — Product → Ad → Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the video asset library to a 3-level hierarchy: Product → Ad (reclamă) → Source files, with product+ad selection at upload time and a folder-navigation UI in the library.

**Architecture:** Add a `VideoAd` model as a named container (slug, productId) that groups `VideoAsset` records. The library page uses `searchParams` for navigation (no client state), and a new 3-step upload modal collects product → ad → file before hitting the existing presigned-URL upload flow.

**Tech Stack:** Next.js 16 App Router, Prisma + PostgreSQL, Cloudflare R2 (presigned PUT), shadcn/ui + Tailwind v4, React Query, TypeScript

> ⚠️ **Dependință nerezolvată: R2 nu este configurat.**
> Variabilele de mediu `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` lipsesc din `.env`.
> Upload-ul de fișiere (modal 3 pași) și preview-ul asset-urilor **nu vor funcționa** până când R2 nu este configurat.
> DB schema, UI-ul și API routes sunt complete și gata — doar R2 credentials lipsesc.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `VideoAd` model, add `adId` to `VideoAsset`, add `videoAds` relation to `Product` |
| `lib/r2.ts` | Modify | Add `getPresignedUploadUrlForKey(key, contentType)` overload accepting full R2 key |
| `app/api/video-ads/route.ts` | Create | `POST` — create a named ad under a product |
| `app/api/assets/upload-url/route.ts` | Modify | Accept `adId`, resolve slugs, use new R2 key pattern |
| `features/videos/components/UploadModal.tsx` | Create | 3-step modal: ProductPicker → AdPicker → AssetUploader |
| `features/videos/components/ProductPicker.tsx` | Create | Step 1 — searchable product list |
| `features/videos/components/AdPicker.tsx` | Create | Step 2 — list existing ads + inline create new |
| `features/videos/components/AssetUploader.tsx` | Modify | Accept `adId?: string` prop, pass to upload-url API |
| `features/videos/components/AssetUploaderSection.tsx` | Modify | Render `UploadModal` instead of bare `AssetUploader` |
| `features/videos/components/LibrarySidebar.tsx` | Create | Left sidebar: products expandable → ads under each |
| `app/(dashboard)/videos/library/page.tsx` | Modify | 2-column layout, searchParams navigation, query by adId/productId |

---

## Task 1: Prisma schema — add VideoAd model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `VideoAd` model and update relations**

In `prisma/schema.prisma`, add after the `VideoAsset` model:

```prisma
model VideoAd {
  id             String       @id @default(cuid())
  organizationId String
  productId      String
  name           String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  product        Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  assets         VideoAsset[]

  @@unique([productId, name])
  @@index([organizationId])
  @@index([productId])
}
```

- [ ] **Step 2: Add `adId` to `VideoAsset` and `videoAds` relation to `Product`**

In `VideoAsset` model, add after `tags String[]`:
```prisma
  adId  String?
  ad    VideoAd? @relation(fields: [adId], references: [id], onDelete: SetNull)
```

Also add the index:
```prisma
  @@index([organizationId, adId])
```

In `Product` model, add alongside existing relations:
```prisma
  videoAds    VideoAd[]
```

In `Organization` model, add:
```prisma
  videoAds    VideoAd[]
```

- [ ] **Step 3: Run migration**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npm run db:migrate
```

When prompted for migration name, enter: `add_video_ad_model`

Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 4: Verify build still compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no Prisma type errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add VideoAd model — product→ad→asset hierarchy"
```

---

## Task 2: Update `lib/r2.ts` — flexible key-based upload URL

**Files:**
- Modify: `lib/r2.ts`

- [ ] **Step 1: Add `getPresignedUploadUrlForKey` function**

Add after the existing `getPresignedUploadUrl` function in `lib/r2.ts`:

```typescript
export async function getPresignedUploadUrlForKey(
  key: string,
  contentType: string
): Promise<string> {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`)
  }
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 900 }
  )
}
```

Also add `'video/quicktime'` to `ALLOWED_CONTENT_TYPES` array (it's missing, but `AssetUploader` accepts it):

```typescript
const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'image/jpeg',
  'image/png',
  'image/webp',
]
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build 2>&1 | grep "lib/r2"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/r2.ts
git commit -m "feat: add getPresignedUploadUrlForKey for arbitrary R2 paths"
```

---

## Task 3: API route — create VideoAd

**Files:**
- Create: `app/api/video-ads/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/video-ads/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'

const createSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = createSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Date invalide', details: result.error.flatten() }, { status: 400 })
  }

  const { productId, name } = result.data

  // Verify product belongs to this org
  const product = await db.product.findFirst({
    where: { id: productId, organizationId: orgId },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })

  try {
    const ad = await db.videoAd.create({
      data: { organizationId: orgId, productId, name },
      select: { id: true, name: true, productId: true },
    })
    return NextResponse.json(ad, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Există deja o reclamă cu acest nume pentru produsul selectat' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Eroare server' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "video-ads"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/video-ads/route.ts
git commit -m "feat: POST /api/video-ads — create named ad under product"
```

---

## Task 4: Update upload-url API to accept adId

**Files:**
- Modify: `app/api/assets/upload-url/route.ts`

- [ ] **Step 1: Rewrite upload-url route**

Replace the entire content of `app/api/assets/upload-url/route.ts`:

```typescript
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
    r2Key = `${orgId}/assets/${productSlug}/${adSlug}/${sanitized}`
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "upload-url"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/assets/upload-url/route.ts
git commit -m "feat: upload-url accepts adId, stores assets under product/ad slug path"
```

---

## Task 5: Update AssetUploader component to accept adId

**Files:**
- Modify: `features/videos/components/AssetUploader.tsx`

- [ ] **Step 1: Add `adId` prop and pass it to API**

Replace the `AssetUploaderProps` interface and `uploadFile` function. Full updated file:

```typescript
'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UploadState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'uploading'; filename: string; progress: number }
  | { phase: 'done'; filename: string }
  | { phase: 'error'; message: string }

interface AssetUploaderProps {
  onUploaded: () => void
  adId?: string
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4']
const MAX_SIZE_MB = 500

export function AssetUploader({ onUploaded, adId }: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>({ phase: 'idle' })

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setState({ phase: 'dragging' })
  }

  function handleDragLeave() {
    setState({ phase: 'idle' })
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  async function uploadFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setState({ phase: 'error', message: 'Tip fișier neacceptat. Sunt permise: MP4, MOV, JPG, PNG, WEBP, MP3, M4A' })
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setState({ phase: 'error', message: `Fișierul depășește limita de ${MAX_SIZE_MB} MB` })
      return
    }

    setState({ phase: 'uploading', filename: file.name, progress: 0 })

    try {
      const res = await fetch('/api/assets/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          ...(adId ? { adId } : {}),
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Eroare la generarea URL-ului de upload')
      }

      const { uploadUrl } = await res.json()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setState({ phase: 'uploading', filename: file.name, progress: Math.round((e.loaded / e.total) * 100) })
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload eșuat (HTTP ${xhr.status})`))
        })
        xhr.addEventListener('error', () => reject(new Error('Eroare de rețea la upload')))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      setState({ phase: 'done', filename: file.name })
      onUploaded()
      setTimeout(() => setState({ phase: 'idle' }), 3000)
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Eroare necunoscută' })
    }
  }

  const isDragging = state.phase === 'dragging'

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
        isDragging ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="sr-only"
        onChange={handleChange}
      />

      {state.phase === 'idle' || state.phase === 'dragging' ? (
        <>
          <Upload className={cn('h-10 w-10 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm font-medium text-foreground">
            Trage fișierul aici sau{' '}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              selectează
            </button>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV, JPG, PNG, WEBP, MP3 · Max {MAX_SIZE_MB} MB
          </p>
        </>
      ) : state.phase === 'uploading' ? (
        <div className="w-full max-w-xs space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-foreground truncate">{state.filename}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state.progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{state.progress}%</p>
        </div>
      ) : state.phase === 'done' ? (
        <div className="space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="text-sm font-medium text-foreground">Upload reușit!</p>
          <p className="text-xs text-muted-foreground truncate">{state.filename}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">Upload eșuat</p>
          <p className="text-xs text-muted-foreground">{state.message}</p>
          <Button size="sm" variant="outline" onClick={() => setState({ phase: 'idle' })}>
            Încearcă din nou
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "AssetUploader"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/videos/components/AssetUploader.tsx
git commit -m "feat: AssetUploader accepts adId prop for structured upload"
```

---

## Task 6: Create ProductPicker component (modal step 1)

**Files:**
- Create: `features/videos/components/ProductPicker.tsx`

- [ ] **Step 1: Create ProductPicker**

```typescript
// features/videos/components/ProductPicker.tsx
'use client'

import { useState } from 'react'
import { Package, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PickableProduct {
  id: string
  title: string
  imageUrl: string | null
  price: string | null
}

interface ProductPickerProps {
  products: PickableProduct[]
  selectedId: string | null
  onSelect: (product: PickableProduct) => void
}

export function ProductPicker({ products, selectedId, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState('')

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Caută produs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
        />
      </div>

      <div className="border border-[#E7E5E4] rounded-xl overflow-hidden bg-white max-h-[340px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#78716C]">Niciun produs găsit.</div>
        ) : (
          filtered.map((product) => {
            const active = selectedId === product.id
            return (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#E7E5E4] last:border-0 transition-colors border-l-[3px]',
                  active ? 'bg-[#FFFBEB] border-l-[#D4AF37]' : 'hover:bg-[#FAFAF9] border-l-transparent'
                )}
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.title} className="w-10 h-10 rounded-lg object-cover border border-[#E7E5E4] flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-[#C4C0BA]" strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1917] truncate">{product.title}</p>
                  {product.price && <p className="text-xs text-[#78716C] mt-0.5">{product.price} RON</p>}
                </div>
                {active && (
                  <div className="w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#1C1917]" strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "ProductPicker"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/videos/components/ProductPicker.tsx
git commit -m "feat: ProductPicker component for upload modal step 1"
```

---

## Task 7: Create AdPicker component (modal step 2)

**Files:**
- Create: `features/videos/components/AdPicker.tsx`

- [ ] **Step 1: Create AdPicker**

```typescript
// features/videos/components/AdPicker.tsx
'use client'

import { useState } from 'react'
import { Video, Check, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface PickableAd {
  id: string
  name: string
}

interface AdPickerProps {
  productId: string
  productName: string
  ads: PickableAd[]
  selectedId: string | null
  onSelect: (ad: PickableAd) => void
}

export function AdPicker({ productId, productName, ads, selectedId, onSelect }: AdPickerProps) {
  const [list, setList] = useState<PickableAd[]>(ads)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/video-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Eroare la creare')
        return
      }
      const created: PickableAd = { id: data.id, name: data.name }
      setList((prev) => [...prev, created])
      setNewName('')
      onSelect(created)
    } catch {
      setError('Eroare de rețea')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#78716C]">
        Produs: <span className="font-semibold text-[#1C1917]">{productName}</span>
      </p>

      {/* Existing ads */}
      {list.length > 0 && (
        <div className="border border-[#E7E5E4] rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
          {list.map((ad) => {
            const active = selectedId === ad.id
            return (
              <button
                key={ad.id}
                onClick={() => onSelect(ad)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#E7E5E4] last:border-0 transition-colors border-l-[3px]',
                  active ? 'bg-[#FFFBEB] border-l-[#D4AF37]' : 'hover:bg-[#FAFAF9] border-l-transparent'
                )}
              >
                <Video className="w-4 h-4 text-[#78716C] flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm text-[#1C1917] flex-1">{ad.name}</span>
                {active && (
                  <div className="w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#1C1917]" strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Create new */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#78716C]">Reclamă nouă</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ex: reclama-vara-2024"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 h-9 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Creează
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "AdPicker"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/videos/components/AdPicker.tsx
git commit -m "feat: AdPicker component for upload modal step 2"
```

---

## Task 8: Create UploadModal (3-step modal)

**Files:**
- Create: `features/videos/components/UploadModal.tsx`

- [ ] **Step 1: Create UploadModal**

```typescript
// features/videos/components/UploadModal.tsx
'use client'

import { useState } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductPicker, PickableProduct } from './ProductPicker'
import { AdPicker, PickableAd } from './AdPicker'
import { AssetUploader } from './AssetUploader'
import { useRouter } from 'next/navigation'

interface UploadModalProps {
  products: PickableProduct[]
  onClose: () => void
}

type Step = 'product' | 'ad' | 'upload'

export function UploadModal({ products, onClose }: UploadModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('product')
  const [selectedProduct, setSelectedProduct] = useState<PickableProduct | null>(null)
  const [ads, setAds] = useState<PickableAd[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [selectedAd, setSelectedAd] = useState<PickableAd | null>(null)
  const [uploadKey, setUploadKey] = useState(0)

  async function handleProductContinue() {
    if (!selectedProduct) return
    setLoadingAds(true)
    try {
      const res = await fetch(`/api/video-ads?productId=${selectedProduct.id}`)
      const data = await res.json()
      setAds(res.ok ? data : [])
    } catch {
      setAds([])
    } finally {
      setLoadingAds(false)
    }
    setStep('ad')
  }

  function handleUploaded() {
    router.refresh()
    setUploadKey((k) => k + 1)
  }

  const stepTitles: Record<Step, string> = {
    product: 'Selectează produsul',
    ad: 'Selectează reclama',
    upload: 'Încarcă fișier',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E5E4]">
          <div className="flex items-center gap-3">
            {step !== 'product' && (
              <button
                onClick={() => setStep(step === 'upload' ? 'ad' : 'product')}
                className="text-[#78716C] hover:text-[#1C1917] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-base font-bold text-[#1C1917]">{stepTitles[step]}</h2>
          </div>
          <button onClick={onClose} className="text-[#78716C] hover:text-[#1C1917] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {(['product', 'ad', 'upload'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step === s ? 'bg-[#D4AF37]' : i < ['product', 'ad', 'upload'].indexOf(step) ? 'bg-[#D4AF37]/40' : 'bg-[#E7E5E4]'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {step === 'product' && (
            <>
              <ProductPicker
                products={products}
                selectedId={selectedProduct?.id ?? null}
                onSelect={setSelectedProduct}
              />
              <div className="mt-5">
                <Button
                  onClick={handleProductContinue}
                  disabled={!selectedProduct || loadingAds}
                  className="w-full bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold h-10"
                >
                  {loadingAds ? 'Se încarcă...' : 'Continuă'}
                </Button>
              </div>
            </>
          )}

          {step === 'ad' && selectedProduct && (
            <>
              <AdPicker
                productId={selectedProduct.id}
                productName={selectedProduct.title}
                ads={ads}
                selectedId={selectedAd?.id ?? null}
                onSelect={setSelectedAd}
              />
              <div className="mt-5">
                <Button
                  onClick={() => setStep('upload')}
                  disabled={!selectedAd}
                  className="w-full bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold h-10"
                >
                  Continuă
                </Button>
              </div>
            </>
          )}

          {step === 'upload' && selectedAd && selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#78716C] bg-[#F5F5F4] px-3 py-2 rounded-lg">
                <span>📦 {selectedProduct.title}</span>
                <span>→</span>
                <span>🎬 {selectedAd.name}</span>
              </div>
              <AssetUploader key={uploadKey} onUploaded={handleUploaded} adId={selectedAd.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add GET handler to `/api/video-ads/route.ts`** to fetch ads by product

Append to `app/api/video-ads/route.ts`:

```typescript
export async function GET(request: Request) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const ads = await db.videoAd.findMany({
    where: { organizationId: orgId, productId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(ads)
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "UploadModal|video-ads"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add features/videos/components/UploadModal.tsx app/api/video-ads/route.ts
git commit -m "feat: UploadModal (3 steps) + GET /api/video-ads"
```

---

## Task 9: Create LibrarySidebar component

**Files:**
- Create: `features/videos/components/LibrarySidebar.tsx`

- [ ] **Step 1: Create LibrarySidebar**

```typescript
// features/videos/components/LibrarySidebar.tsx
import Link from 'next/link'
import { Package, Video, FolderOpen, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarAd {
  id: string
  name: string
  _count: { assets: number }
}

export interface SidebarProduct {
  id: string
  title: string
  imageUrl: string | null
  videoAds: SidebarAd[]
}

interface LibrarySidebarProps {
  products: SidebarProduct[]
  totalCount: number
  unassignedCount: number
  activeProductId?: string
  activeAdId?: string
}

export function LibrarySidebar({
  products,
  totalCount,
  unassignedCount,
  activeProductId,
  activeAdId,
}: LibrarySidebarProps) {
  const productsWithAssets = products.filter(
    (p) => p.videoAds.some((ad) => ad._count.assets > 0)
  )

  return (
    <nav className="w-56 flex-shrink-0 space-y-0.5">
      {/* All */}
      <Link
        href="/videos/library"
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
          !activeProductId && !activeAdId
            ? 'bg-[#FFFBEB] text-[#1C1917] font-semibold'
            : 'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
        )}
      >
        <FolderOpen className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
        <span className="flex-1 truncate">Toate fișierele</span>
        {totalCount > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
            {totalCount}
          </span>
        )}
      </Link>

      {/* Products */}
      {productsWithAssets.map((product) => {
        const isProductActive = activeProductId === product.id && !activeAdId
        const isExpanded = activeProductId === product.id || product.videoAds.some(ad => ad.id === activeAdId)
        const productAssetCount = product.videoAds.reduce((acc, ad) => acc + ad._count.assets, 0)

        return (
          <div key={product.id}>
            <Link
              href={`/videos/library?product=${product.id}`}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isProductActive
                  ? 'bg-[#FFFBEB] text-[#1C1917] font-semibold'
                  : 'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
              )}
            >
              <Package className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 truncate">{product.title}</span>
              <div className="flex items-center gap-1">
                {productAssetCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
                    {productAssetCount}
                  </span>
                )}
                <ChevronDown className={cn('w-3 h-3 transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')} />
              </div>
            </Link>

            {/* Ads under product */}
            {isExpanded && product.videoAds.filter(ad => ad._count.assets > 0).map((ad) => {
              const isAdActive = activeAdId === ad.id
              return (
                <Link
                  key={ad.id}
                  href={`/videos/library?ad=${ad.id}`}
                  className={cn(
                    'flex items-center gap-2.5 pl-8 pr-3 py-1.5 rounded-lg text-sm transition-colors',
                    isAdActive
                      ? 'bg-[#FFFBEB] text-[#1C1917] font-semibold'
                      : 'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
                  )}
                >
                  <Video className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 truncate text-xs">{ad.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
                    {ad._count.assets}
                  </span>
                </Link>
              )
            })}
          </div>
        )
      })}

      {/* Unassigned */}
      {unassignedCount > 0 && (
        <Link
          href="/videos/library?unassigned=1"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            'text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]'
          )}
        >
          <FolderOpen className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          <span className="flex-1 truncate">Neasignate</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#78716C]">
            {unassignedCount}
          </span>
        </Link>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "LibrarySidebar"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/videos/components/LibrarySidebar.tsx
git commit -m "feat: LibrarySidebar with product→ad folder navigation"
```

---

## Task 10: Refactor library page with 2-column layout

**Files:**
- Modify: `app/(dashboard)/videos/library/page.tsx`
- Modify: `features/videos/components/AssetUploaderSection.tsx`

- [ ] **Step 1: Update AssetUploaderSection to accept products and use UploadModal**

Replace entire `features/videos/components/AssetUploaderSection.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { UploadModal } from './UploadModal'
import { PickableProduct } from './ProductPicker'

interface AssetUploaderSectionProps {
  products: PickableProduct[]
}

export function AssetUploaderSection({ products }: AssetUploaderSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors"
      >
        <Upload className="w-3.5 h-3.5" strokeWidth={2} />
        Încarcă fișiere
      </button>

      {open && (
        <UploadModal
          products={products}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Rewrite library page**

Replace entire `app/(dashboard)/videos/library/page.tsx`:

```typescript
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { LibrarySidebar } from '@/features/videos/components/LibrarySidebar'
import { AssetUploaderSection } from '@/features/videos/components/AssetUploaderSection'
import { Film, Image as ImageIcon, Music, HardDrive, Upload } from 'lucide-react'

function AssetCardShell({ asset }: { asset: any }) {
  const isVideo = asset.assetType === 'VIDEO'
  const isAudio = asset.assetType === 'AUDIO'
  const isImage = asset.assetType === 'IMAGE'

  const sizeDisplay = asset.sizeBytes
    ? asset.sizeBytes > 1048576
      ? `${(asset.sizeBytes / 1048576).toFixed(1)} MB`
      : `${(asset.sizeBytes / 1024).toFixed(0)} KB`
    : '—'

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
      {isVideo && (
        <div className="relative aspect-video flex items-center justify-center bg-[radial-gradient(circle_at_top,#FFF8DB_0%,#FAFAF9_60%,#F5F5F4_100%)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E7E5E4]">
            <svg className="ml-0.5 w-4 h-4 text-[#B8971F]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      {isImage && (
        <div className="aspect-video bg-[#F5F5F4] flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-[#E7E5E4]" strokeWidth={1} />
        </div>
      )}
      {isAudio && (
        <div className="aspect-video bg-[#FFF7ED] flex flex-col items-center justify-center gap-2">
          <span className="text-2xl">🎵</span>
          <div className="flex items-end gap-0.5 h-8">
            {[6, 12, 8, 16, 10, 14, 7, 11, 9, 15].map((h, i) => (
              <div key={i} className="w-1.5 rounded-sm bg-[#D4AF37]" style={{ height: h * 2, opacity: 0.7 }} />
            ))}
          </div>
        </div>
      )}
      {!isVideo && !isImage && !isAudio && (
        <div className="aspect-video bg-[#F5F5F4] flex items-center justify-center">
          <HardDrive className="w-8 h-8 text-[#E7E5E4]" strokeWidth={1} />
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-[#1C1917] truncate">{asset.filename}</p>
        <p className="text-xs text-[#78716C] mt-0.5">{sizeDisplay}</p>
      </div>
    </div>
  )
}

export default async function VideoLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; ad?: string; unassigned?: string }>
}) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const { product: productFilter, ad: adFilter, unassigned } = await searchParams

  // Sidebar data: all products with their ads and asset counts
  const products = await db.product.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      price: true,
      videoAds: {
        select: {
          id: true,
          name: true,
          _count: { select: { assets: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { title: 'asc' },
  })

  // Unassigned count
  const unassignedCount = await db.videoAsset.count({
    where: { organizationId: orgId, adId: null },
  })

  // Total count
  const totalCount = await db.videoAsset.count({
    where: { organizationId: orgId },
  })

  // Assets for main content area
  const assetWhere: any = { organizationId: orgId }
  if (adFilter) {
    assetWhere.adId = adFilter
  } else if (productFilter) {
    assetWhere.ad = { productId: productFilter }
  } else if (unassigned) {
    assetWhere.adId = null
  }

  const assets = await db.videoAsset.findMany({
    where: assetWhere,
    orderBy: { createdAt: 'desc' },
  })

  const videos = assets.filter((a) => a.assetType === 'VIDEO')
  const images = assets.filter((a) => a.assetType === 'IMAGE')
  const audios = assets.filter((a) => a.assetType === 'AUDIO')

  // Heading for content area
  let heading = 'Toate fișierele'
  if (adFilter) {
    const ad = products.flatMap((p) => p.videoAds).find((a) => a.id === adFilter)
    if (ad) heading = ad.name
  } else if (productFilter) {
    const product = products.find((p) => p.id === productFilter)
    if (product) heading = product.title
  } else if (unassigned) {
    heading = 'Neasignate'
  }

  const pickableProducts = products.map((p) => ({
    id: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.price?.toString() ?? null,
  }))

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-bold text-[#1C1917]">Biblioteca</h1>
        <p className="mt-1 text-sm text-[#78716C]">Organizează clipuri, imagini și audio pentru toate reclamele create în Rise.</p>
      </div>

      {/* 2-column layout */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <LibrarySidebar
          products={products}
          totalCount={totalCount}
          unassignedCount={unassignedCount}
          activeProductId={productFilter}
          activeAdId={adFilter}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Content header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1C1917]">{heading}</h2>
            <AssetUploaderSection products={pickableProducts} />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-[#E7E5E4]">
            {[
              { label: 'Toate', count: assets.length, active: true },
              { label: 'Clipuri video', count: videos.length },
              { label: 'Imagini', count: images.length },
              { label: 'Audio', count: audios.length },
            ].map((tab) => (
              <button
                key={tab.label}
                className={`pb-3 text-sm flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
                  tab.active
                    ? 'font-semibold text-[#1C1917] border-[#D4AF37]'
                    : 'text-[#78716C] border-transparent hover:text-[#1C1917]'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    tab.active ? 'bg-[#D4AF37] text-[#1C1917]' : 'bg-[#F5F5F4] text-[#78716C]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Asset grid or empty state */}
          {assets.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {assets.map((asset) => (
                <AssetCardShell key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFFBEB] flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-bold text-[#1C1917]">Nicio înregistrare</p>
              <p className="text-sm text-[#78716C] mt-1 max-w-xs">
                Încarcă primul fișier folosind butonul din dreapta sus.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Manual verification**

Start dev server and navigate to `/videos/library`:
```bash
npm run dev
```
- Sidebar should show "Toate fișierele"
- "Încarcă fișiere" button → opens modal → Step 1 shows products list
- Select product → Continue → Step 2 shows empty ad list + input to create new
- Type a name → Creează → ad appears selected
- Continue → Step 3 shows uploader with breadcrumb
- Upload a file → modal stays open, library refreshes

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/videos/library/page.tsx features/videos/components/AssetUploaderSection.tsx
git commit -m "feat: library page 2-col layout with sidebar folder navigation"
```
