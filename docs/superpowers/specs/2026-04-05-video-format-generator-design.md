# Video Format Generator — Design Spec

**Date:** 2026-04-05  
**Status:** Approved

## Overview

Funcționalitate simplă de generare a 4 formate video (9x16, 4x5, 1x1, 16x9) dintr-un video sursă uploadat. Utilizatorul selectează un asset VIDEO din bibliotecă, vede preview live pentru fiecare format via `@remotion/player`, și copiază comenzile CLI pentru export local în MP4.

---

## 1. Arhitectură

```
azora-rise/
├── remotion.config.ts              ← nou (minimal)
├── src/remotion/
│   ├── index.tsx                   ← Root.tsx — 4 Composition registrations
│   └── FormatVideo.tsx             ← component unic pentru toate formatele
├── app/(dashboard)/videos/library/
│   └── formats/[assetId]/
│       └── page.tsx                ← pagina de preview + CLI
├── app/api/assets/[id]/
│   └── preview-url/route.ts        ← presigned download URL (1h TTL)
└── features/videos/components/
    └── FormatPreviewTabs.tsx        ← client component: tabs + player + CLI copy
```

---

## 2. Remotion Setup

### `remotion.config.ts`
```typescript
import { Config } from '@remotion/cli/config'
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
```

### `src/remotion/index.tsx` — 4 compositions
```typescript
import { Composition } from 'remotion'
import { FormatVideo, FormatVideoProps } from './FormatVideo'

const defaultProps: FormatVideoProps = {
  videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  durationInFrames: 900,
}

export const RemotionRoot = () => (
  <>
    <Composition id="FormatVideo-9x16"  component={FormatVideo} width={1080}  height={1920} fps={30} durationInFrames={900} defaultProps={{ ...defaultProps, outputFormat: '9x16'  }} />
    <Composition id="FormatVideo-4x5"   component={FormatVideo} width={1080}  height={1350} fps={30} durationInFrames={900} defaultProps={{ ...defaultProps, outputFormat: '4x5'   }} />
    <Composition id="FormatVideo-1x1"   component={FormatVideo} width={1080}  height={1080} fps={30} durationInFrames={900} defaultProps={{ ...defaultProps, outputFormat: '1x1'   }} />
    <Composition id="FormatVideo-16x9"  component={FormatVideo} width={1920}  height={1080} fps={30} durationInFrames={900} defaultProps={{ ...defaultProps, outputFormat: '16x9'  }} />
  </>
)
```

### `src/remotion/FormatVideo.tsx`

Props:
```typescript
export interface FormatVideoProps {
  videoUrl: string
  outputFormat: '9x16' | '4x5' | '1x1' | '16x9'
  durationInFrames: number
}
```

Comportament per format:
- **9x16 & 4x5**: `<Video src={videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} />`
- **1x1 & 16x9**: blurred backdrop (`filter: blur(24px) brightness(0.35) scale(1.2)`) + coloană centrată ascuțită (`width = height * (9/16)`)
- Durata: `durationInFrames` din props (default 900 = 30s)

---

## 3. API: presigned download URL

### `GET /api/assets/[id]/preview-url`

- Auth: `getCurrentOrgId()`
- Verifică că `videoAsset.organizationId === orgId`
- Returnează presigned download URL cu TTL 1h via `getPresignedDownloadUrl(asset.r2Key)`
- Response: `{ url: string, filename: string, durationInFrames: number }`
- `durationInFrames`: din `asset.durationSeconds * 30` dacă există, altfel `900` (default)

---

## 4. Integrarea în Bibliotecă

### Buton "Formate" pe asset card VIDEO

În `AssetCardShell` din `library/page.tsx`, adaugă pentru tipul VIDEO un link:
```tsx
<Link href={`/videos/library/formats/${asset.id}`}>
  <LayoutTemplate className="w-3.5 h-3.5" /> Formate
</Link>
```

---

## 5. Pagina de Preview

### `app/(dashboard)/videos/library/formats/[assetId]/page.tsx`

Server Component:
1. Auth + verifică asset aparține orgId
2. Fetch presigned download URL via `getPresignedDownloadUrl(asset.r2Key)`
3. Calculează `durationInFrames` din `asset.durationSeconds ?? 30`
4. Render `<FormatPreviewTabs>` cu `videoUrl`, `durationInFrames`, `filename`

### `features/videos/components/FormatPreviewTabs.tsx`

Client Component:
- 4 tab-uri: 9x16 / 4x5 / 1x1 / 16x9
- Per tab:
  - `@remotion/player` cu `FormatVideo` composition scalat la max 420px înălțime
  - Dimensiunile canvas pasate ca `compositionWidth` / `compositionHeight`
  - Buton "Copiază comanda" cu comanda CLI completă

### Comanda CLI generată per format:
```bash
npx remotion render FormatVideo-{format} out/{filename}-{format}.mp4 --props '{"videoUrl":"{url}","outputFormat":"{format}","durationInFrames":{n}}'
```

---

## 6. Package.json — script nou

```json
"remotion:studio": "npx remotion studio src/remotion/index.tsx"
```

---

## 7. Dependințe

- `@remotion/player` — deja instalat
- `@remotion/cli` — necesar pentru `remotion.config.ts` (de verificat dacă e instalat)
- R2 presigned download URL — funcționează fără bucket public; URL-ul expiră în 1h (suficient pentru render local)

> ⚠️ **R2 neconfigurat** — preview-ul și CLI commands cu URL R2 nu vor funcționa până la configurarea credentials. Se poate testa cu un URL video public (default props în composition).

---

## 8. Ce NU se schimbă

- Wizard-ul de creare video existent — neatins
- `VideoWizard`, `StepProduct`, `StepTemplate` etc. — neatinse
- Modelele DB — neatinse (nu e nevoie de câmpuri noi)
