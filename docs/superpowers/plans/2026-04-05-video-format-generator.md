# Video Format Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select a VIDEO asset from the library, preview it in 4 social media formats (9x16, 4x5, 1x1, 16x9) via `@remotion/player`, and copy CLI commands to render each format locally as MP4.

**Architecture:** Remotion compositions live in `src/remotion/` inside the Rise project and are rendered client-side by `@remotion/player`. A Server Component fetches the presigned R2 URL and asset metadata, passes them to a Client Component that renders tabbed previews. CLI commands are generated with `--props` containing the live R2 URL.

**Tech Stack:** Next.js 16 App Router, Remotion 4.0.438, `@remotion/player`, TypeScript, Tailwind v4

> ⚠️ **R2 not configured** — tests use a public fallback video URL. Real R2 URLs work once credentials are set and R2 CORS is configured to allow `localhost:3000`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `remotion`, `@remotion/player`, `@remotion/cli` |
| `remotion.config.ts` | Create | Remotion CLI config (JPEG format, overwrite enabled) |
| `src/remotion/index.tsx` | Create | Root — registers 4 Compositions |
| `src/remotion/FormatVideo.tsx` | Create | Single composition component for all 4 formats |
| `app/(dashboard)/videos/library/formats/[assetId]/page.tsx` | Create | Server Component — fetches asset + presigned URL, renders preview page |
| `features/videos/components/FormatPreviewTabs.tsx` | Create | Client Component — 4 tabs with `@remotion/player` + CLI copy button |
| `app/(dashboard)/videos/library/page.tsx` | Modify | Add "Formate" button on VIDEO asset cards |

---

## Task 1: Install Remotion packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Remotion packages**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npm install remotion@4.0.438 @remotion/player@4.0.438 @remotion/cli@4.0.438
```

Expected: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Add remotion:studio script to package.json**

Open `package.json` and add to `"scripts"`:
```json
"remotion:studio": "npx remotion studio src/remotion/index.tsx"
```

- [ ] **Step 3: Verify install**

```bash
node -e "require('remotion'); require('@remotion/player'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install remotion 4.0.438 + @remotion/player + @remotion/cli"
```

---

## Task 2: Create remotion.config.ts

**Files:**
- Create: `remotion.config.ts`

- [ ] **Step 1: Create remotion.config.ts in project root**

```typescript
// remotion.config.ts
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
```

- [ ] **Step 2: Verify TypeScript recognizes it**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npm run build 2>&1 | tail -5
```

Expected: build still succeeds (remotion.config.ts is not imported by Next.js).

- [ ] **Step 3: Commit**

```bash
git add remotion.config.ts
git commit -m "feat: add remotion.config.ts for CLI render"
```

---

## Task 3: Create FormatVideo composition

**Files:**
- Create: `src/remotion/FormatVideo.tsx`

- [ ] **Step 1: Create `src/` directory and FormatVideo component**

```bash
mkdir -p /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise/src/remotion
```

Create `src/remotion/FormatVideo.tsx`:

```typescript
import { AbsoluteFill, Video, useVideoConfig } from 'remotion'

export type OutputFormat = '9x16' | '4x5' | '1x1' | '16x9'

export interface FormatVideoProps {
  videoUrl: string
  outputFormat: OutputFormat
  durationInFrames: number
}

export const FormatVideo: React.FC<FormatVideoProps> = ({ videoUrl, outputFormat }) => {
  const { width, height } = useVideoConfig()

  // 9x16 and 4x5: fill canvas with cover crop
  if (outputFormat === '9x16' || outputFormat === '4x5') {
    return (
      <AbsoluteFill>
        <Video
          src={videoUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </AbsoluteFill>
    )
  }

  // 1x1 and 16x9: blurred backdrop + centered sharp portrait column
  const portraitWidth = Math.round(height * (9 / 16))

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {/* Blurred background — full canvas */}
      <AbsoluteFill>
        <Video
          src={videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(24px) brightness(0.35)',
            transform: 'scale(1.2)',
          }}
        />
      </AbsoluteFill>

      {/* Sharp centered column */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
      >
        <div style={{ width: portraitWidth, height: '100%', overflow: 'hidden' }}>
          <Video
            src={videoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/remotion/FormatVideo.tsx
git commit -m "feat: FormatVideo Remotion composition — 4 format variants"
```

---

## Task 4: Create Remotion Root (src/remotion/index.tsx)

**Files:**
- Create: `src/remotion/index.tsx`

- [ ] **Step 1: Create Root component**

```typescript
// src/remotion/index.tsx
import { Composition } from 'remotion'
import { FormatVideo, FormatVideoProps } from './FormatVideo'

const defaultProps: FormatVideoProps = {
  videoUrl:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  outputFormat: '9x16',
  durationInFrames: 900,
}

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="FormatVideo-9x16"
      component={FormatVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '9x16' }}
    />
    <Composition
      id="FormatVideo-4x5"
      component={FormatVideo}
      width={1080}
      height={1350}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '4x5' }}
    />
    <Composition
      id="FormatVideo-1x1"
      component={FormatVideo}
      width={1080}
      height={1080}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '1x1' }}
    />
    <Composition
      id="FormatVideo-16x9"
      component={FormatVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '16x9' }}
    />
  </>
)
```

- [ ] **Step 2: Verify Remotion Studio launches**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npm run remotion:studio
```

Expected: browser opens at `http://localhost:3000` showing Remotion Studio with 4 compositions (FormatVideo-9x16, FormatVideo-4x5, FormatVideo-1x1, FormatVideo-16x9), each playing Big Buck Bunny.

Press Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add src/remotion/index.tsx
git commit -m "feat: Remotion Root — registers 4 FormatVideo compositions"
```

---

## Task 5: Create FormatPreviewTabs client component

**Files:**
- Create: `features/videos/components/FormatPreviewTabs.tsx`

- [ ] **Step 1: Create FormatPreviewTabs**

```typescript
// features/videos/components/FormatPreviewTabs.tsx
'use client'

import { useState } from 'react'
import { Player } from '@remotion/player'
import { FormatVideo, FormatVideoProps, OutputFormat } from '@/src/remotion/FormatVideo'
import { Copy, Check } from 'lucide-react'

interface FormatConfig {
  id: OutputFormat
  label: string
  width: number
  height: number
}

const FORMATS: FormatConfig[] = [
  { id: '9x16',  label: '9:16 — Stories / Reels', width: 1080, height: 1920 },
  { id: '4x5',   label: '4:5 — Feed',              width: 1080, height: 1350 },
  { id: '1x1',   label: '1:1 — Pătrat',            width: 1080, height: 1080 },
  { id: '16x9',  label: '16:9 — Landscape',         width: 1920, height: 1080 },
]

interface FormatPreviewTabsProps {
  videoUrl: string
  durationInFrames: number
  filename: string
  assetR2Key: string
}

export function FormatPreviewTabs({
  videoUrl,
  durationInFrames,
  filename,
  assetR2Key,
}: FormatPreviewTabsProps) {
  const [activeFormat, setActiveFormat] = useState<OutputFormat>('9x16')
  const [copied, setCopied] = useState(false)

  const format = FORMATS.find((f) => f.id === activeFormat)!
  const baseName = filename.replace(/\.[^.]+$/, '')

  const inputProps: FormatVideoProps = {
    videoUrl,
    outputFormat: activeFormat,
    durationInFrames,
  }

  const cliCommand =
    `npx remotion render FormatVideo-${activeFormat} ` +
    `out/${baseName}-${activeFormat}.mp4 ` +
    `--props '${JSON.stringify(inputProps)}'`

  async function handleCopy() {
    await navigator.clipboard.writeText(cliCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Scale player to fit in UI — max height 480px
  const playerHeight = Math.min(480, 480)
  const playerWidth = Math.round(playerHeight * (format.width / format.height))

  return (
    <div className="space-y-6">
      {/* Format tabs */}
      <div className="flex items-center gap-1 border-b border-[#E7E5E4]">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFormat(f.id)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeFormat === f.id
                ? 'font-semibold text-[#1C1917] border-[#D4AF37]'
                : 'text-[#78716C] border-transparent hover:text-[#1C1917]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Player */}
      <div className="flex justify-center">
        <div
          className="rounded-xl overflow-hidden border border-[#E7E5E4] shadow-sm bg-black"
          style={{ width: playerWidth, height: playerHeight }}
        >
          <Player
            component={FormatVideo}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            compositionWidth={format.width}
            compositionHeight={format.height}
            fps={30}
            style={{ width: playerWidth, height: playerHeight }}
            controls
            loop
          />
        </div>
      </div>

      {/* CLI command */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#78716C]">Comandă render local (rulează din directorul azora-rise):</p>
        <div className="flex items-start gap-2">
          <code className="flex-1 block bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg px-4 py-3 text-xs text-[#1C1917] font-mono break-all">
            {cliCommand}
          </code>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-xs font-semibold rounded-lg transition-colors flex-shrink-0 mt-1"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5" /> Copiat</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copiază</>
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#78716C]">
          MP4-ul va fi salvat în <code className="bg-[#F5F5F4] px-1 rounded">out/{baseName}-{activeFormat}.mp4</code> · URL valid 1h
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors related to FormatPreviewTabs.

- [ ] **Step 3: Commit**

```bash
git add features/videos/components/FormatPreviewTabs.tsx
git commit -m "feat: FormatPreviewTabs — 4-tab player + CLI copy"
```

---

## Task 6: Create format preview page

**Files:**
- Create: `app/(dashboard)/videos/library/formats/[assetId]/page.tsx`

- [ ] **Step 1: Create the page directory and file**

```bash
mkdir -p "/Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise/app/(dashboard)/videos/library/formats/[assetId]"
```

Create `app/(dashboard)/videos/library/formats/[assetId]/page.tsx`:

```typescript
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { getPresignedDownloadUrl } from '@/lib/r2'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { FormatPreviewTabs } from '@/features/videos/components/FormatPreviewTabs'

const FPS = 30
const DEFAULT_DURATION_SECONDS = 30

export default async function FormatGeneratorPage({
  params,
}: {
  params: Promise<{ assetId: string }>
}) {
  const { assetId } = await params

  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) notFound()

  const asset = await db.videoAsset.findFirst({
    where: { id: assetId, organizationId: orgId, assetType: 'VIDEO' },
    select: { id: true, filename: true, r2Key: true, durationSeconds: true, ad: { select: { name: true, product: { select: { title: true } } } } },
  })
  if (!asset) notFound()

  const videoUrl = await getPresignedDownloadUrl(asset.r2Key)
  const durationInFrames = Math.round((asset.durationSeconds ?? DEFAULT_DURATION_SECONDS) * FPS)

  const breadcrumb = asset.ad
    ? `${asset.ad.product.title} / ${asset.ad.name}`
    : 'Neasignat'

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <div>
        <Link
          href="/videos/library"
          className="flex items-center gap-1 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Înapoi la bibliotecă
        </Link>
        <h1 className="text-[22px] font-bold text-[#1C1917]">Generează formate</h1>
        <p className="mt-1 text-sm text-[#78716C]">
          <span className="font-medium text-[#1C1917]">{asset.filename}</span>
          {' · '}
          <span>{breadcrumb}</span>
        </p>
      </div>

      <FormatPreviewTabs
        videoUrl={videoUrl}
        durationInFrames={durationInFrames}
        filename={asset.filename}
        assetR2Key={asset.r2Key}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/Eusebiu1/Desktop/workspace/Personal/azora/azora-rise
npm run build 2>&1 | tail -15
```

Expected: new route `/videos/library/formats/[assetId]` appears as `ƒ` (dynamic).

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/videos/library/formats/[assetId]/page.tsx"
git commit -m "feat: format generator page — server component with presigned URL"
```

---

## Task 7: Add "Formate" button to library asset cards

**Files:**
- Modify: `app/(dashboard)/videos/library/page.tsx`

- [ ] **Step 1: Read current AssetCardShell in library/page.tsx**

Read `app/(dashboard)/videos/library/page.tsx` lines 1–90 to find the `AssetCardShell` component and its card body section.

- [ ] **Step 2: Add "Formate" link to VIDEO card body**

In `AssetCardShell`, find the card body div (`<div className="p-3">`). After the existing `<p>` tags showing filename and size, add a "Formate" link **only for VIDEO assets**:

```typescript
import Link from 'next/link'
import { LayoutTemplate } from 'lucide-react'
```

Add after the size line inside the card body (still inside the `p-3` div):

```typescript
      {isVideo && (
        <Link
          href={`/videos/library/formats/${asset.id}`}
          className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#78716C] hover:text-[#D4AF37] transition-colors"
        >
          <LayoutTemplate className="w-3 h-3" strokeWidth={1.5} />
          Generează formate
        </Link>
      )}
```

- [ ] **Step 3: Verify build and manual test**

```bash
npm run build 2>&1 | tail -10
npm run dev
```

Navigate to `http://localhost:3000/videos/library` — VIDEO asset cards should show "Generează formate" link. Clicking should navigate to the format page.

**If no VIDEO assets uploaded yet** (R2 not configured): navigate directly to `/videos/library/formats/some-asset-id` — should return 404 (expected). The feature works once R2 is configured and a video is uploaded.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/videos/library/page.tsx"
git commit -m "feat: add Generează formate link to VIDEO asset cards"
```

---

## Task 8: Fix @remotion/player import path (if needed)

**Files:**
- Potentially modify: `features/videos/components/FormatPreviewTabs.tsx`
- Potentially modify: `tsconfig.json`

- [ ] **Step 1: Check if `@/src/remotion/FormatVideo` resolves**

The import `@/src/remotion/FormatVideo` uses the `@` alias which maps to the project root. Check `tsconfig.json`:

```bash
cat tsconfig.json | grep -A5 '"paths"'
```

If `@` maps to `.` or `./`, the import `@/src/remotion/FormatVideo` resolves to `./src/remotion/FormatVideo`. If `@` maps to `./app` or similar, the import path needs adjustment.

- [ ] **Step 2: Fix import if needed**

If `@` does NOT map to the project root, change the import in `FormatPreviewTabs.tsx` from:
```typescript
import { FormatVideo, FormatVideoProps, OutputFormat } from '@/src/remotion/FormatVideo'
```
to a relative import:
```typescript
import { FormatVideo, FormatVideoProps, OutputFormat } from '../../../src/remotion/FormatVideo'
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no import errors.

- [ ] **Step 4: Commit if changed**

```bash
git add features/videos/components/FormatPreviewTabs.tsx
git commit -m "fix: resolve remotion import path in FormatPreviewTabs"
```

---

## Notes for manual testing

Once R2 is configured and a VIDEO is uploaded:

1. Go to `/videos/library`
2. Click "Generează formate" on a video card
3. Player should load the video in 9:16 format
4. Switch tabs to see 4:5 (crop), 1:1 (blurred backdrop), 16:9 (blurred backdrop)
5. Click "Copiază" → paste in terminal → run from `azora-rise/` directory
6. MP4 saved to `out/filename-9x16.mp4`

**Test with public video (before R2):**
Modify `FormatPreviewTabs` temporarily to use:
```
videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
```
This tests the player UI without R2.
