# Rise — Sub-proiectul 6: Finalizarea Modulului Video Creation

**Data:** 2026-03-29
**Status:** Plan aprobat — de implementat
**Dependențe:** Sub-proiectele 1–2 (implementate), Sub-proiect 3 (Campanii Meta, parțial)

---

## 1. Overview și Obiective

Sub-proiectul 6 finalizează complet modulul de creare video-uri din Rise. Baza a fost pusă în Sub-proiectul 2 (wizard schelet, VideoAsset model, upload R2, `@remotion/player` instalat), dar flow-ul nu este funcțional end-to-end: lipsesc template-urile Remotion reale, Step 3 nu are editor de subtitluri, Step 4 afișează un placeholder static, iar video-urile create nu pot fi atașate campaniilor Meta.

### Obiective concrete

1. **3 template-uri Remotion complete** — `ProductShowcase`, `BeforeAfter`, `Slideshow` — fiecare cu 4 variante de format (9x16, 4x5, 1x1, 16x9) → 12 compositions noi în `Root.tsx`
2. **Wizard Step 3 complet** — editor subtitluri (add/edit/delete rows), voiceover selector, câmpuri CTA config
3. **Wizard Step 4 funcțional** — `@remotion/player` live (nu placeholder), format picker, comenzi CLI corecte cu `--props` reale
4. **API `POST /api/videos` corectat** — elimină microservice-ul fantomă, salvează corect `ProductVideo.status = PENDING` + params complet
5. **Video Library îmbunătățită** — inline video preview, filtrare pe tab-uri funcțională (client-side), delete asset
6. **Integrare cu campaniile Meta** — câmp `videoId` pe `MetaCampaign`, selector video în wizard campanie

### Ce rămâne în afara scope-ului Sub-proiect 6

- Render automat server-side (rămâne CLI local — Option A)
- AI Hook Generator / subtitle generation (Sub-proiect 5)
- Semantic search (pgvector) (Sub-proiect 5)
- Publicare automată pe Meta din Rise

---

## 2. Template ProductShowcase

### Descriere

Reclama generică pentru un produs — multiple clipuri în secvență, subtitluri Romanian, voiceover opțional, CTA final.

### Fișier: `src/templates/ProductShowcase.tsx`

```typescript
// ============================================================
// ProductShowcase — template reclamă produs Azora
// Timing total: calculat dinamic din clips.length
//   - 150 frame per clip (5s) × N clips
//   - CTA_DURATION = 180 frame (6s)
//   - TOTAL_FRAMES = clips.length * 150 + 180
// ============================================================

import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  staticFile,
  useVideoConfig,
} from 'remotion'
import { CTAOverlay } from '../components/CTAOverlay'
import { DynamicWatermark } from '../components/DynamicWatermark'
import { SubtitleBlock } from '../components/SubtitleBlock'

export interface ProductShowcaseProps {
  productName: string
  price: string
  tagline: string
  clips: string[]          // HTTPS URLs (presigned R2)
  subtitles: Array<{ from: number; to: number; line1: string; line2: string }>
  voiceover?: string       // HTTPS URL
  discountLabel?: string
  deliveryLabel?: string
}

const CLIP_DURATION = 150  // 5s per clip @ 30fps
const CTA_DURATION  = 180  // 6s

export const ProductShowcase: React.FC<ProductShowcaseProps> = ({
  productName,
  price,
  tagline,
  clips,
  subtitles,
  voiceover,
  discountLabel,
  deliveryLabel,
}) => {
  const { height } = useVideoConfig()
  const ctaStart = clips.length * CLIP_DURATION

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* ── Clips ── */}
      {clips.map((clip, i) => (
        <Sequence
          key={i}
          from={i * CLIP_DURATION}
          durationInFrames={CLIP_DURATION}
          // f0–f150: clip 1 | f150–f300: clip 2 | etc.
        >
          <Video
            src={clip}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Sequence>
      ))}

      {/* ── Voiceover ── */}
      {voiceover && (
        <Audio src={voiceover} />
      )}

      {/* ── Subtitles ── */}
      {subtitles.map((sub, i) => (
        <Sequence key={i} from={sub.from} durationInFrames={sub.to - sub.from}>
          <SubtitleBlock
            line1={sub.line1}
            line2={sub.line2}
            durationInFrames={sub.to - sub.from}
            paddingBottom={height * 0.225}
          />
        </Sequence>
      ))}

      {/* ── Watermark (f0 → ctaStart) ── */}
      <Sequence from={0} durationInFrames={ctaStart}>
        <DynamicWatermark />
      </Sequence>

      {/* ── CTA Overlay (ultimele 6s) ── */}
      <Sequence from={ctaStart} durationInFrames={CTA_DURATION}>
        <CTAOverlay
          tagline={`${productName}\n${price}`}
          discountLabel={discountLabel}
          deliveryLabel={deliveryLabel}
        />
      </Sequence>
    </AbsoluteFill>
  )
}
```

### Variante de format

```typescript
// src/templates/ProductShowcase_4x5.tsx
export const ProductShowcase_4x5: React.FC<ProductShowcaseProps> = (props) => (
  <ProductShowcase {...props} />
)
// objectFit: cover pe Video — crop natural ~15% top/bottom. Fără modificări.

// src/templates/ProductShowcase_9x16.tsx
export const ProductShowcase_9x16: React.FC<ProductShowcaseProps> = (props) => (
  <ProductShowcase {...props} />
)
// Format nativ portrait. Fără modificări față de bază.

// src/templates/ProductShowcase_1x1.tsx
// Blurred backdrop pattern — clip original blur + centered portrait column
export const ProductShowcase_1x1: React.FC<ProductShowcaseProps> = (props) => {
  const { width, height } = useVideoConfig()
  const columnWidth = height * (9 / 16)  // 607px din 1080

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Voiceover */}
      {props.voiceover && <Audio src={props.voiceover} />}

      {props.clips.map((clip, i) => (
        <Sequence key={i} from={i * CLIP_DURATION} durationInFrames={CLIP_DURATION}>
          {/* Layer 1: backdrop blur + darken */}
          <Video
            src={clip}
            style={{
              position: 'absolute',
              width: '100%', height: '100%',
              objectFit: 'cover',
              filter: 'blur(28px) brightness(0.35)',
              transform: 'scale(1.15)',
            }}
          />
          {/* Layer 2: coloana portrait centrată ascuțită */}
          <div style={{
            position: 'absolute',
            left: (width - columnWidth) / 2,
            top: 0,
            width: columnWidth,
            height: '100%',
            overflow: 'hidden',
          }}>
            <Video
              src={clip}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </Sequence>
      ))}

      {/* Subtitles, Watermark, CTA — identice cu varianta bază */}
      {/* ... (copy din ProductShowcase, substituite corect) */}
    </AbsoluteFill>
  )
}

// src/templates/ProductShowcase_16x9.tsx — identic cu 1x1, dimensiuni diferite
// columnWidth = height * (9/16) = 1080 * 0.5625 = 607.5px din 1920 lățime
```

### Tabel timing

| Frames         | Conținut                         | Durată |
|----------------|----------------------------------|--------|
| f0 – f150      | Clip 1 (5s)                      | 5 s    |
| f150 – f300    | Clip 2 (5s)                      | 5 s    |
| fN … f(N+150)  | Clip N (5s)                      | 5 s    |
| ctaStart – end | CTA Overlay (6s, 180 frame)      | 6 s    |

**Total frames:** `clips.length * 150 + 180`

---

## 3. Template BeforeAfter

### Descriere

Split-screen cu reveal animat: clip "Înainte" → tranziție → clip "După". Ideal pentru produse cu efect vizibil (dispozitive LED, îngrijire piele).

### Fișier: `src/templates/BeforeAfter.tsx`

```typescript
// ============================================================
// BeforeAfter — split-screen reveal
//
// Timing table (default):
//   f0–f30      intro fade-in (ambele clipuri)
//   f0–f150     BEFORE clip (stânga) | AFTER clip (dreapta, mascat)
//   f150–f180   reveal animation: linia se mută din centru spre dreapta
//   f180–f330   AFTER clip full-screen
//   f330–f510   CTA overlay (6s)
// TOTAL_FRAMES = 510 (17s)
//
// splitDurationFrames: cât durează fiecare parte (default 150)
// ============================================================

import {
  AbsoluteFill, Audio, Sequence, Video,
  interpolate, useCurrentFrame, useVideoConfig,
} from 'remotion'

export interface BeforeAfterProps {
  productName: string
  price: string
  beforeClip: string
  afterClip: string
  beforeLabel?: string      // default "Înainte"
  afterLabel?: string       // default "După"
  subtitles: Array<{ from: number; to: number; line1: string; line2: string }>
  voiceover?: string
  splitDurationFrames?: number  // default 150 (5s)
}

const REVEAL_FRAMES = 30   // 1s de reveal
const CTA_DURATION  = 180  // 6s

export const BeforeAfter: React.FC<BeforeAfterProps> = ({
  productName,
  price,
  beforeClip,
  afterClip,
  beforeLabel = 'Înainte',
  afterLabel  = 'După',
  subtitles,
  voiceover,
  splitDurationFrames = 150,
}) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const revealStart = splitDurationFrames
  const afterStart  = revealStart + REVEAL_FRAMES
  const ctaStart    = afterStart + splitDurationFrames

  // Linia de split: se mută de la 50% la 100% în REVEAL_FRAMES
  const splitPercent = interpolate(
    frame,
    [revealStart, afterStart],
    [50, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const labelOpacity = interpolate(
    frame,
    [0, 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {voiceover && <Audio src={voiceover} />}

      {/* BEFORE clip — vizibil mereu până la CTA */}
      <Sequence from={0} durationInFrames={ctaStart}>
        <Video
          src={beforeClip}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Sequence>

      {/* AFTER clip — mascat dinamic de splitPercent */}
      <Sequence from={0} durationInFrames={ctaStart}>
        <div style={{
          position: 'absolute',
          left: `${splitPercent}%`,
          top: 0,
          width: `${100 - splitPercent}%`,
          height: '100%',
          overflow: 'hidden',
        }}>
          <Video
            src={afterClip}
            style={{
              position: 'absolute',
              right: 0,
              width: width,  // lățimea originală — se decalează cu left
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      </Sequence>

      {/* Linia de split + label-uri */}
      {frame < ctaStart && (
        <>
          {/* Linia verticală */}
          <div style={{
            position: 'absolute',
            left: `calc(${splitPercent}% - 1.5px)`,
            top: 0, bottom: 0,
            width: 3,
            background: 'rgba(255,255,255,0.8)',
            boxShadow: '0 0 12px rgba(255,255,255,0.6)',
          }} />

          {/* Label Înainte */}
          {splitPercent < 100 && (
            <div style={{
              position: 'absolute',
              top: '8%',
              left: '5%',
              opacity: labelOpacity,
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontFamily: 'sans-serif',
              fontWeight: 700,
              fontSize: 36,
              padding: '8px 20px',
              borderRadius: 8,
              letterSpacing: 1,
            }}>
              {beforeLabel}
            </div>
          )}

          {/* Label După */}
          {splitPercent > 10 && (
            <div style={{
              position: 'absolute',
              top: '8%',
              right: '5%',
              opacity: frame >= revealStart
                ? interpolate(frame, [revealStart, afterStart], [0, 1], { extrapolateRight: 'clamp' })
                : 0,
              background: 'rgba(212,175,55,0.85)',
              color: '#1C1917',
              fontFamily: 'sans-serif',
              fontWeight: 700,
              fontSize: 36,
              padding: '8px 20px',
              borderRadius: 8,
              letterSpacing: 1,
            }}>
              {afterLabel}
            </div>
          )}
        </>
      )}

      {/* Subtitles */}
      {subtitles.map((sub, i) => (
        <Sequence key={i} from={sub.from} durationInFrames={sub.to - sub.from}>
          <SubtitleBlock
            line1={sub.line1}
            line2={sub.line2}
            durationInFrames={sub.to - sub.from}
            paddingBottom={height * 0.225}
          />
        </Sequence>
      ))}

      {/* Watermark */}
      <Sequence from={0} durationInFrames={ctaStart}>
        <DynamicWatermark />
      </Sequence>

      {/* CTA */}
      <Sequence from={ctaStart} durationInFrames={CTA_DURATION}>
        <CTAOverlay tagline={`${productName}\n${price}`} />
      </Sequence>
    </AbsoluteFill>
  )
}
```

### Variante de format

- **9x16 și 4x5:** Identice cu baza. `objectFit: cover` — split-ul funcționează natural în portrait.
- **1x1 și 16x9:** Blurred backdrop — aceleași wrapper ca la ProductShowcase. Coloana centrată conține ambele clipuri split-screen suprapuse cu masking.

### Tabel timing

| Frames       | Conținut                                         |
|--------------|--------------------------------------------------|
| f0 – f150    | Clip Before full-screen + After mascat la 50%    |
| f150 – f180  | Reveal: linia se mută 50% → 100%                 |
| f180 – f330  | After clip full-screen                           |
| f330 – f510  | CTA overlay                                      |

**Total:** 510 frames (17 s)

---

## 4. Template Slideshow

### Descriere

Prezentare de imagini cu fade transitions, muzică de fundal. Ideal pentru produse cu multiple unghiuri sau variante.

### Fișier: `src/templates/Slideshow.tsx`

```typescript
// ============================================================
// Slideshow — imagini cu TransitionSeries fade
//
// Timing:
//   - slideDurationFrames = 90 (3s) per imagine
//   - transitionFrames = 15 (0.5s fade overlap)
//   - TOTAL = images.length * slideDurationFrames
//             - (images.length - 1) * transitionFrames
//             + CTA_DURATION
// ============================================================

import {
  AbsoluteFill, Audio, Img, Sequence,
  interpolate, useCurrentFrame, useVideoConfig,
} from 'remotion'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'

export interface SlideshowProps {
  productName: string
  price: string
  images: string[]              // min 3, max 10
  subtitles: Array<{ from: number; to: number; line1: string; line2: string }>
  music?: string
  slideDurationFrames?: number  // default 90
  transitionFrames?: number     // default 15
}

const CTA_DURATION = 180

export const Slideshow: React.FC<SlideshowProps> = ({
  productName,
  price,
  images,
  subtitles,
  music,
  slideDurationFrames = 90,
  transitionFrames = 15,
}) => {
  const { height } = useVideoConfig()
  // Calculează ctaStart ținând cont de overlap-ul tranzițiilor
  const slideshowDuration =
    images.length * slideDurationFrames -
    (images.length - 1) * transitionFrames
  const ctaStart = slideshowDuration

  return (
    <AbsoluteFill style={{ background: '#1C1917' }}>
      {music && <Audio src={music} volume={0.6} />}

      {/* TransitionSeries gestionează automat overlap-ul */}
      <TransitionSeries>
        {images.map((img, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={slideDurationFrames}>
              <AbsoluteFill>
                <Img
                  src={img}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {/* Ken Burns zoom ușor per slide */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5) 100%)',
                }} />
              </AbsoluteFill>
            </TransitionSeries.Sequence>

            {/* Adaugă tranziție fade între slide-uri (nu după ultimul) */}
            {i < images.length - 1 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: transitionFrames })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>

      {/* Subtitles */}
      {subtitles.map((sub, i) => (
        <Sequence key={i} from={sub.from} durationInFrames={sub.to - sub.from}>
          <SubtitleBlock
            line1={sub.line1}
            line2={sub.line2}
            durationInFrames={sub.to - sub.from}
            paddingBottom={height * 0.225}
          />
        </Sequence>
      ))}

      {/* Watermark */}
      <Sequence from={0} durationInFrames={ctaStart}>
        <DynamicWatermark />
      </Sequence>

      {/* CTA */}
      <Sequence from={ctaStart} durationInFrames={CTA_DURATION}>
        <CTAOverlay tagline={`${productName}\n${price}`} />
      </Sequence>
    </AbsoluteFill>
  )
}
```

### Variante de format

- **9x16 și 4x5:** Identice cu baza — imaginile `objectFit: cover` se centrează natural.
- **1x1:** Blurred backdrop. Imaginea blurată full-bleed + imaginea ascuțită într-o coloană centrată de lățime `height * (9/16)`.
- **16x9:** Identic cu 1x1, dar coloana are lățime `height * (9/16)` centrată în 1920×1080.

### Tabel timing exemplu (5 imagini, 90fps/slide, 15 tranziție)

| Imagine   | From (frame) | Durată   |
|-----------|--------------|----------|
| Imagine 1 | 0            | 90       |
| Fade →    | 75           | 15       |
| Imagine 2 | 75           | 90       |
| Fade →    | 150          | 15       |
| Imagine 3 | 150          | 90       |
| Fade →    | 225          | 15       |
| Imagine 4 | 225          | 90       |
| Fade →    | 300          | 15       |
| Imagine 5 | 300          | 90       |
| CTA       | 360          | 180      |

**Total:** 360 + 180 = 540 frames (18 s)

---

## 5. Root.tsx — Compositions Noi

Adaugă cele 12 înregistrări noi după compositions-urile existente (BearGiftAd, FacebookAd, etc.):

```typescript
// ── ProductShowcase (4 formate) ──────────────────────────────
<Composition
  id="ProductShowcase-9x16"
  component={ProductShowcase_9x16}
  width={1080} height={1920} fps={30}
  durationInFrames={defaultFrames}  // placeholder — overriden de --props totalFrames
  defaultProps={defaultProductShowcaseProps}
/>
<Composition
  id="ProductShowcase-4x5"
  component={ProductShowcase_4x5}
  width={1080} height={1350} fps={30}
  durationInFrames={defaultFrames}
  defaultProps={defaultProductShowcaseProps}
/>
<Composition
  id="ProductShowcase-1x1"
  component={ProductShowcase_1x1}
  width={1080} height={1080} fps={30}
  durationInFrames={defaultFrames}
  defaultProps={defaultProductShowcaseProps}
/>
<Composition
  id="ProductShowcase-16x9"
  component={ProductShowcase_16x9}
  width={1920} height={1080} fps={30}
  durationInFrames={defaultFrames}
  defaultProps={defaultProductShowcaseProps}
/>

// ── BeforeAfter (4 formate) ───────────────────────────────────
<Composition id="BeforeAfter-9x16" component={BeforeAfter_9x16}
  width={1080} height={1920} fps={30} durationInFrames={510}
  defaultProps={defaultBeforeAfterProps} />
<Composition id="BeforeAfter-4x5"  component={BeforeAfter_4x5}
  width={1080} height={1350} fps={30} durationInFrames={510}
  defaultProps={defaultBeforeAfterProps} />
<Composition id="BeforeAfter-1x1"  component={BeforeAfter_1x1}
  width={1080} height={1080} fps={30} durationInFrames={510}
  defaultProps={defaultBeforeAfterProps} />
<Composition id="BeforeAfter-16x9" component={BeforeAfter_16x9}
  width={1920} height={1080} fps={30} durationInFrames={510}
  defaultProps={defaultBeforeAfterProps} />

// ── Slideshow (4 formate) ─────────────────────────────────────
<Composition id="Slideshow-9x16" component={Slideshow_9x16}
  width={1080} height={1920} fps={30} durationInFrames={540}
  defaultProps={defaultSlideshowProps} />
<Composition id="Slideshow-4x5"  component={Slideshow_4x5}
  width={1080} height={1350} fps={30} durationInFrames={540}
  defaultProps={defaultSlideshowProps} />
<Composition id="Slideshow-1x1"  component={Slideshow_1x1}
  width={1080} height={1080} fps={30} durationInFrames={540}
  defaultProps={defaultSlideshowProps} />
<Composition id="Slideshow-16x9" component={Slideshow_16x9}
  width={1920} height={1080} fps={30} durationInFrames={540}
  defaultProps={defaultSlideshowProps} />
```

**Notă:** `durationInFrames` în Composition este valoarea pentru Remotion Studio (preview). La render cu `--props`, Remotion folosește `totalFrames` din props dacă componenta îl citește. Pentru ProductShowcase, `durationInFrames` se calculează dinamic pe baza `clips.length` — vezi secțiunea Render Workflow.

---

## 6. SubtitleBlock — Component Shared

Dacă nu există deja `src/components/SubtitleBlock.tsx`, îl creezi:

```typescript
// src/components/SubtitleBlock.tsx

import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

interface SubtitleBlockProps {
  line1: string
  line2: string
  durationInFrames: number
  paddingBottom: number  // height * 0.225 — safe zone Meta
}

const FADE_OUT = 12  // frame-uri înainte de sfârșit

export const SubtitleBlock: React.FC<SubtitleBlockProps> = ({
  line1,
  line2,
  durationInFrames,
  paddingBottom,
}) => {
  const frame = useCurrentFrame()

  // Fade in primele 8 frame-uri
  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  // Fade out ultimele FADE_OUT frame-uri
  const fadeOut = interpolate(
    frame,
    [durationInFrames - FADE_OUT, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const opacity = Math.min(fadeIn, fadeOut)

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom,
        paddingLeft: 40,
        paddingRight: 40,
        pointerEvents: 'none',
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <div style={{
          color: '#FFFFFF',
          fontSize: 48,
          fontWeight: 900,
          fontFamily: 'sans-serif',
          textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 24px rgba(0,0,0,0.6)',
          lineHeight: 1.2,
          marginBottom: 6,
        }}>
          {line1}
        </div>
        <div style={{
          color: '#D4AF37',
          fontSize: 44,
          fontWeight: 900,
          fontFamily: 'sans-serif',
          textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          lineHeight: 1.2,
        }}>
          {line2}
        </div>
      </div>
    </AbsoluteFill>
  )
}
```

---

## 7. Wizard Step 3 — Configurare Completă

### Problema curentă

`StepConfigure.tsx` existent are:
- AssetPicker pentru clips/images/audio — **funcțional**
- Câmpuri `price` și `tagline` — **funcțional**
- **Lipsă:** editor subtitluri (add/edit/delete rows)
- **Lipsă:** câmpuri CTA (discountLabel, deliveryLabel, urgencyText)
- **Lipsă:** indicare ordine clips cu drag reorder

### Ce se adaugă la `StepConfigure.tsx`

#### 7.1 Subtitles Editor

```typescript
// Adaugat în WizardState (VideoWizard.tsx) — subtitles deja existent, nu necesită modificare

// Componenta SubtitleEditor — adăugată în StepConfigure

function SubtitleEditor({
  subtitles,
  onChange,
}: {
  subtitles: WizardState['subtitles']
  onChange: (s: WizardState['subtitles']) => void
}) {
  function addRow() {
    const lastTo = subtitles[subtitles.length - 1]?.to ?? 0
    onChange([
      ...subtitles,
      { from: lastTo + 5, to: lastTo + 95, line1: '', line2: '' },
    ])
  }

  function updateRow(i: number, field: string, value: string | number) {
    const updated = subtitles.map((s, idx) =>
      idx === i ? { ...s, [field]: value } : s
    )
    onChange(updated)
  }

  function deleteRow(i: number) {
    onChange(subtitles.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#1C1917]">
          Subtitluri ({subtitles.length})
        </label>
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
        >
          <Plus className="w-3 h-3" /> Adaugă rând
        </button>
      </div>

      {subtitles.length === 0 ? (
        <p className="text-xs text-[#78716C] bg-[#FAFAF9] border border-dashed border-[#E7E5E4] rounded-lg p-3">
          Niciun subtitlu adăugat. Subtitlurile sunt opționale — dacă nu adaugi,
          video-ul va rula fără text.
        </p>
      ) : (
        <div className="space-y-2">
          {subtitles.map((sub, i) => (
            <div
              key={i}
              className="grid grid-cols-[60px_60px_1fr_1fr_32px] gap-2 items-start
                         bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg p-2"
            >
              {/* From / To în frame-uri */}
              <div className="space-y-1">
                <label className="text-[10px] text-[#78716C]">De la (f)</label>
                <input
                  type="number"
                  value={sub.from}
                  onChange={(e) => updateRow(i, 'from', Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs border border-[#E7E5E4] rounded-md
                             focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[#78716C]">Până la (f)</label>
                <input
                  type="number"
                  value={sub.to}
                  onChange={(e) => updateRow(i, 'to', Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs border border-[#E7E5E4] rounded-md
                             focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Line1 și Line2 */}
              <input
                placeholder="Linie 1 (albă)"
                value={sub.line1}
                onChange={(e) => updateRow(i, 'line1', e.target.value)}
                className="h-8 px-2 text-xs border border-[#E7E5E4] rounded-md w-full
                           focus:outline-none focus:border-[#D4AF37]"
              />
              <input
                placeholder="Linie 2 (aurie)"
                value={sub.line2}
                onChange={(e) => updateRow(i, 'line2', e.target.value)}
                className="h-8 px-2 text-xs border border-[#E7E5E4] rounded-md w-full
                           focus:outline-none focus:border-[#D4AF37]"
                style={{ color: '#92690A' }}
              />

              <button
                onClick={() => deleteRow(i)}
                className="mt-5 w-8 h-8 flex items-center justify-center rounded-md
                           text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper: 30 fps reminder */}
      <p className="text-[10px] text-[#78716C]">
        1 secundă = 30 frame-uri (ex: 0s–3s = f0–f90, 3s–6s = f90–f180)
      </p>
    </div>
  )
}
```

#### 7.2 CTA Config Fields

Adaugă în `WizardState`:
```typescript
discountLabel: string    // ex: "-28% AZI"
deliveryLabel: string    // ex: "✓ Livrare 24h"
urgencyText: string      // ex: "⚡ Stoc limitat"
originalPrice: string    // ex: "599 RON"
```

UI — secțiune colapsabilă `CTA Avansat` cu 4 câmpuri text grid 2×2.

#### 7.3 Ordine Clips (ProductShowcase)

Adaugă butoane `↑` `↓` lângă fiecare clip selectat pentru a reordona array-ul `clips`. Alternativ, afișează clips ca listă ordonată (numbered) și permite drag-and-drop simplu cu `@dnd-kit/core` (deja instalat în alte proiecte Rise, verificați `package.json`).

---

## 8. Wizard Step 4 — Preview Live și Render Commands

### Problema curentă

`StepReview.tsx` are un placeholder static pentru player (`Monitor` icon + "Preview disponibil după render"). Trebuie înlocuit cu `@remotion/player` real.

### Implementare `StepReview.tsx` complet

#### 8.1 Player Live cu @remotion/player

```typescript
'use client'
import { Player } from '@remotion/player'
import { useMemo } from 'react'
// Import template-ul corespunzător
import { ProductShowcase } from '@/../../src/templates/ProductShowcase'
import { BeforeAfter } from '@/../../src/templates/BeforeAfter'
import { Slideshow } from '@/../../src/templates/Slideshow'

// Problema de import: Rise este în rise/ dar template-urile sunt în src/ (root repo)
// Soluție: configurează tsconfig.json cu paths sau symlink
// tsconfig.json în rise/:
// {
//   "compilerOptions": {
//     "paths": {
//       "@remotion-templates/*": ["../src/templates/*"]
//     }
//   }
// }
// Alternativ: next.config.ts cu transpilePackages sau alias webpack

function LivePlayer({
  state,
  activeFormat,
}: {
  state: WizardState
  activeFormat: WizardFormat
}) {
  const FORMAT_DIMS = {
    '9x16': { width: 1080, height: 1920 },
    '4x5':  { width: 1080, height: 1350 },
    '1x1':  { width: 1080, height: 1080 },
    '16x9': { width: 1920, height: 1080 },
  }

  const dims = FORMAT_DIMS[activeFormat]

  // Rezolvă URL-urile presigned pentru preview
  const inputProps = useMemo(() => buildInputProps(state), [state])
  const totalFrames = useMemo(() => calcTotalFrames(state), [state])

  const Component = getComponent(state.template!, activeFormat)

  if (!Component) return <PlayerPlaceholder />

  return (
    <Player
      component={Component}
      inputProps={inputProps}
      durationInFrames={totalFrames}
      compositionWidth={dims.width}
      compositionHeight={dims.height}
      fps={30}
      style={{
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
      }}
      controls
    />
  )
}
```

**Problemă critică — URL-uri R2:** Template-urile Remotion necesită URL-uri HTTPS pentru clipuri/imagini. În wizard, `state.clips` conține R2 keys (prefixate `r2://` sau direct key-ul). Înainte de a pasa la Player, trebuie generate presigned URLs.

```typescript
// hooks/usePresignedUrls.ts
import { useQuery } from '@tanstack/react-query'

export function usePresignedUrls(r2Keys: string[]) {
  return useQuery({
    queryKey: ['presigned', r2Keys],
    queryFn: async () => {
      const res = await fetch('/api/assets/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: r2Keys }),
      })
      return res.json() as Promise<Record<string, string>>  // { key: httpsUrl }
    },
    enabled: r2Keys.length > 0,
    staleTime: 55 * 60 * 1000,  // 55 min (presigned URLs expiră la 60 min)
  })
}
```

`/api/assets/preview` trebuie extins să accepte array de keys (în prezent acceptă single key via GET).

#### 8.2 Comenzi CLI Corecte

`buildRenderCmd` din StepReview actual generează `--props` cu date greșite (placeholder). Trebuie să genereze props complete:

```typescript
function buildRenderCmd(
  state: WizardState,
  formatKey: WizardFormat,
  presignedUrls: Record<string, string>
): string {
  const template = state.template!
  const slug = slugify(state.productName)
  const comp = `${template}-${formatKey}`
  const out = `out/${slug}-${formatKey}.mp4`

  // Construiește props complete cu URL-urile reale
  const props: Record<string, unknown> = {
    productName: state.productName,
    price: state.price,
  }

  if (template === 'ProductShowcase') {
    props.clips = state.clips.map(k => presignedUrls[k] ?? k)
    props.tagline = state.tagline
    props.subtitles = state.subtitles
    if (state.voiceoverUrl) props.voiceover = presignedUrls[state.voiceoverUrl]
    if (state.discountLabel) props.discountLabel = state.discountLabel
    props.totalFrames = state.clips.length * 150 + 180
  } else if (template === 'BeforeAfter') {
    props.beforeClip = presignedUrls[state.beforeClip] ?? state.beforeClip
    props.afterClip = presignedUrls[state.afterClip] ?? state.afterClip
    props.subtitles = state.subtitles
    if (state.voiceoverUrl) props.voiceover = presignedUrls[state.voiceoverUrl]
  } else if (template === 'Slideshow') {
    props.images = state.images.map(k => presignedUrls[k] ?? k)
    props.subtitles = state.subtitles
    if (state.voiceoverUrl) props.music = presignedUrls[state.voiceoverUrl]
  }

  // --props acceptă JSON string sau fișier. Folosim fișier pentru lizibilitate.
  const propsJson = JSON.stringify(props, null, 2)

  return [
    `# Salvează props într-un fișier temporar:`,
    `echo '${propsJson.replace(/'/g, "\\'")}' > /tmp/${slug}-props.json`,
    ``,
    `# Render:`,
    `cd azora-ads`,
    `npx remotion render ${comp} ${out} \\`,
    `  --props=/tmp/${slug}-props.json`,
  ].join('\n')
}
```

**Observație:** URL-urile presigned expiră la 60 min. Documentul CLI afișat în Rise are o notă: "Comanda este valabilă 60 de minute — regenerează dacă expiră."

---

## 9. API Route `POST /api/videos` — Corecție

### Problema curentă

`/api/videos/route.ts` actual încearcă să comunice cu `REMOTION_SERVICE_URL` (microservice inexistent), setează status `RENDERING` sau `FAILED` — dar nu există niciun microservice. Aceasta este un rest din planul original cu microservice.

### Comportamentul corect (Option A — CLI local)

```typescript
// rise/app/api/videos/route.ts — versiune corectată

export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createVideoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }

  const { productId, template, formats, params } = parsed.data

  // Verifică că produsul aparține org-ului
  const product = await db.product.findFirst({
    where: { id: productId, organizationId: orgId },
  })
  if (!product) {
    return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })
  }

  // Creează înregistrarea — status PENDING (render se face local de utilizator)
  const video = await db.productVideo.create({
    data: {
      productId,
      organizationId: orgId,
      template,
      formats,           // array de formate selectate
      params: params as object,
      status: 'PENDING', // rămâne PENDING până utilizatorul uploadează fișierele MP4 manual
    },
  })

  return NextResponse.json({ videoId: video.id }, { status: 201 })
}
```

**Schema actualizată `createVideoSchema`:**

```typescript
const createVideoSchema = z.object({
  productId: z.string().min(1),
  template: z.enum(['ProductShowcase', 'BeforeAfter', 'Slideshow']),
  formats: z.array(z.enum(['9x16', '4x5', '1x1', '16x9'])).min(1),
  params: z.object({
    productName: z.string(),
    price: z.string(),
    clips:       z.array(z.string()).optional(),
    images:      z.array(z.string()).optional(),
    beforeClip:  z.string().optional(),
    afterClip:   z.string().optional(),
    voiceover:   z.string().optional(),
    music:       z.string().optional(),
    subtitles:   z.array(z.object({
      from: z.number(),
      to:   z.number(),
      line1: z.string(),
      line2: z.string(),
    })).optional(),
    tagline:       z.string().optional(),
    discountLabel: z.string().optional(),
    deliveryLabel: z.string().optional(),
    urgencyText:   z.string().optional(),
    originalPrice: z.string().optional(),
    totalFrames:   z.number().optional(),
  }),
})
```

### Pagina `/videos/[id]/page.tsx`

Pagina video detail trebuie să afișeze:
1. Status badge (`PENDING` — galben: "Așteptând render local", `COMPLETED` — verde)
2. Template + formate selectate
3. Comenzile CLI regenerate (aceleași ca StepReview, dar cu presigned URLs fresh)
4. Buton "Marchează ca COMPLETED" — manual, după ce utilizatorul a rendat și a verificat

```typescript
// PATCH /api/videos/[id] — marchează COMPLETED
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const video = await db.productVideo.findFirst({
    where: { id, product: { organizationId: orgId } },
  })
  if (!video) return NextResponse.json({ error: 'Negăsit' }, { status: 404 })

  const body = await req.json()
  const { status, formats } = body  // { status: 'COMPLETED', formats: { '9x16': 'url', '4x5': 'url' } }

  await db.productVideo.update({
    where: { id },
    data: { status, formats },
  })

  return NextResponse.json({ ok: true })
}
```

---

## 10. Video Library — Îmbunătățiri

### Funcționalități de adăugat

Biblioteca actuală (`/videos/library/page.tsx`) are:
- Grid cu `AssetCardShell` (preview static)
- Upload drag&drop (funcțional via `AssetUploader`)
- Taburi de filtrare — UI prezentă dar nefuncționale (sunt Server Components statice)

### 10.1 Taburi funcționale (Client Component)

Transformă secțiunea asset grid în Client Component cu `useState` pentru tab activ:

```typescript
// features/videos/components/LibraryGrid.tsx
'use client'
import { useState } from 'react'
import { VideoAsset } from '@prisma/client'

type TabKey = 'all' | 'VIDEO' | 'IMAGE' | 'AUDIO'

export function LibraryGrid({ assets }: { assets: VideoAsset[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = assets.filter((a) => {
    const matchesTab = activeTab === 'all' || a.assetType === activeTab
    const matchesSearch = !searchQuery ||
      a.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesTab && matchesSearch
  })

  // Tabs + search input + grid
  // ...
}
```

### 10.2 Inline Video Preview

`AssetCardShell` actual afișează un placeholder negru pentru VIDEO. Înlocuiește cu un `<video>` HTML nativ cu presigned URL:

```typescript
// Presigned URL pentru preview — fetch din /api/assets/preview?key=...
function VideoPreviewCard({ asset }: { asset: VideoAsset }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadPreview() {
    if (previewUrl || loading) return
    setLoading(true)
    const res = await fetch(`/api/assets/preview?key=${encodeURIComponent(asset.r2Key)}`)
    const { url } = await res.json()
    setPreviewUrl(url)
    setLoading(false)
  }

  return (
    <div
      className="relative aspect-video bg-[#1C1917] cursor-pointer"
      onMouseEnter={loadPreview}
    >
      {previewUrl ? (
        <video
          src={previewUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          {loading ? (
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#1C1917] ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### 10.3 Delete Asset

Adaugă buton ✕ pe hover în `AssetCardShell`:

```typescript
// DELETE /api/assets/[id] — șterge din DB + R2
async function deleteAsset(assetId: string) {
  await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
  // router.refresh() pentru a reactualiza grid-ul
}
```

Route handler:
```typescript
// rise/app/api/assets/[id]/route.ts
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = await db.videoAsset.findFirst({
    where: { id, organizationId: orgId },
  })
  if (!asset) return NextResponse.json({ error: 'Negăsit' }, { status: 404 })

  // Șterge din R2
  const r2 = getR2Client()
  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: asset.r2Key,
  }))

  // Șterge din DB
  await db.videoAsset.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
```

### 10.4 Tags inline edit

Adaugă un câmp de editare tags la click pe card (input cu virgule, salvat via PATCH):

```typescript
// PATCH /api/assets/[id] — actualizează tags
{ tags: string[] }
```

---

## 11. Integrare cu Campaniile Meta

### Context

Campaniile Meta (Sub-proiect 3) vor permite utilizatorului să creeze o campanie și să selecteze un video de reclamă creat anterior. Legătura se face prin câmpul `videoId` pe modelul `MetaCampaign`.

### 11.1 Schema Prisma — actualizare

```prisma
model MetaCampaign {
  id             String        @id @default(cuid())
  organizationId String
  productId      String?
  videoId        String?       // FK → ProductVideo (opțional)
  name           String
  objective      String
  status         CampaignStatus @default(DRAFT)
  budget         Float?
  // ...
  video          ProductVideo? @relation(fields: [videoId], references: [id])
}
```

### 11.2 Selector Video în Wizard Campanie

La crearea unei campanii noi, adaugă un step (sau câmp inline) "Selectează video reclamă":

```typescript
// features/campaigns/components/VideoSelector.tsx
'use client'
import { useQuery } from '@tanstack/react-query'

export function VideoSelector({
  value,
  onChange,
}: {
  value: string | null
  onChange: (videoId: string | null) => void
}) {
  const { data: videos } = useQuery({
    queryKey: ['videos'],
    queryFn: () => fetch('/api/videos').then(r => r.json()),
  })

  const completed = (videos ?? []).filter(
    (v: { status: string }) => v.status === 'COMPLETED' || v.status === 'PENDING'
  )

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#1C1917]">
        Video reclamă (opțional)
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onChange(null)}
          className={cn(
            'p-3 rounded-lg border text-sm text-left transition-colors',
            !value
              ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#1C1917]'
              : 'border-[#E7E5E4] text-[#78716C] hover:bg-[#FAFAF9]'
          )}
        >
          Fără video (imagine statică)
        </button>
        {completed.map((v: { id: string; product?: { title: string }; template: string; createdAt: string }) => (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={cn(
              'p-3 rounded-lg border text-sm text-left transition-colors',
              value === v.id
                ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#1C1917]'
                : 'border-[#E7E5E4] text-[#78716C] hover:bg-[#FAFAF9]'
            )}
          >
            <p className="font-medium truncate">{v.product?.title ?? 'Produs'}</p>
            <p className="text-xs text-[#78716C]">{v.template} · {formatDate(v.createdAt)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
```

### 11.3 Afișare video în pagina campaniei

Pagina `/campaigns/[id]/page.tsx` afișează dacă campania are un video atașat, cu un link spre detaliile video-ului și comenzile de render:

```typescript
{campaign.video && (
  <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4">
    <p className="text-sm font-semibold text-[#1C1917]">
      Video reclamă: {campaign.video.product?.title}
    </p>
    <p className="text-xs text-[#78716C]">
      Template: {campaign.video.template} ·
      Status: <VideoStatusBadge status={campaign.video.status} />
    </p>
    <Link href={`/videos/${campaign.video.id}`} className="text-xs text-[#D4AF37] hover:underline">
      Detalii și comenzi render →
    </Link>
  </div>
)}
```

---

## 12. Render Workflow Complet — UX

### Flow din perspectiva utilizatorului

1. **Wizard `/videos/new`** — parcurge 4 pași:
   - Step 1: selectează produsul
   - Step 2: alege template (ProductShowcase / BeforeAfter / Slideshow)
   - Step 3: configurează clips/imagini + subtitluri + CTA
   - Step 4: preview live în `@remotion/player` + selectează formatele dorite

2. **Salvare** — click "Salvează configurația" → `POST /api/videos` → redirect la `/videos/{id}`

3. **Pagina video** (`/videos/{id}`) afișează:
   - Status: **PENDING** (galben) — "Configurație salvată. Rulează comenzile de mai jos pentru a genera fișierele MP4."
   - Comenzile CLI complete (cu presigned URLs valide 60 min)
   - Buton "Regenerează comenzi" pentru a reîmprospăta presigned URLs expirate
   - Secțiune "Marchează ca finalizat" după render

4. **Render local** — utilizatorul copiază comanda, deschide Terminal, rulează din `azora-ads/`:
   ```bash
   echo '{ ... }' > /tmp/produs-props.json
   npx remotion render ProductShowcase-4x5 out/produs-4x5.mp4 \
     --props=/tmp/produs-props.json
   ```

5. **Marcare COMPLETED** — după render reușit, utilizatorul apasă "Marchează ca finalizat" → `PATCH /api/videos/{id}` cu `{ status: 'COMPLETED' }`

6. **Atașare campanie** — la crearea campaniei Meta, selectează video-ul completat din dropdown.

### Considerații tehnice pentru render

- Presigned URLs din R2 au valabilitate 60 min — suficient pentru un render tipic
- Pentru clipuri 4K (bear-closeup-4k.mp4 la 120fps), render durează ~8 min pe Mac M-series pentru 27s la 4x5
- `--concurrency=2` recomandat pentru clipuri multiple (reduce RAM utilizat)
- Output în `azora-ads/out/` — gitignored

---

## 13. Import Templates în Rise — Soluție Tehnică

Aceasta este problema cea mai delicată: Rise este în `rise/` cu propriul `package.json`, iar template-urile Remotion sunt în `src/` la root. `@remotion/player` din Rise trebuie să randeze aceleași componente.

### Opțiunea recomandată: Path aliases în next.config.ts

```typescript
// rise/next.config.ts
import path from 'path'

const nextConfig = {
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@remotion-templates': path.resolve(__dirname, '../src/templates'),
      '@remotion-components': path.resolve(__dirname, '../src/components'),
    }
    return config
  },
  // Transpilare necesară — sursa este în afara rise/
  transpilePackages: [],
}
export default nextConfig
```

**Notă:** Next.js 16 (Turbopack) poate necesita `experimental.turbo.resolveAlias` în plus față de webpack alias. Verificați după implementare cu `npm run dev`.

```typescript
// rise/next.config.ts — Turbopack support
experimental: {
  turbo: {
    resolveAlias: {
      '@remotion-templates': '../src/templates',
      '@remotion-components': '../src/components',
    },
  },
},
```

### Import în StepReview.tsx

```typescript
import { ProductShowcase } from '@remotion-templates/ProductShowcase'
import { BeforeAfter } from '@remotion-templates/BeforeAfter'
import { Slideshow } from '@remotion-templates/Slideshow'
```

---

## 14. Checklist de Verificare

### Template-uri Remotion

- [ ] `src/templates/ProductShowcase.tsx` implementat cu timing corect
- [ ] `src/templates/ProductShowcase_4x5.tsx` — objectFit cover, crop natural
- [ ] `src/templates/ProductShowcase_1x1.tsx` — blurred backdrop + coloana portrait
- [ ] `src/templates/ProductShowcase_16x9.tsx` — blurred backdrop + coloana portrait
- [ ] `src/templates/BeforeAfter.tsx` — split-screen reveal funcțional
- [ ] Toate cele 4 variante BeforeAfter implementate
- [ ] `src/templates/Slideshow.tsx` — TransitionSeries fade
- [ ] Toate cele 4 variante Slideshow implementate
- [ ] `src/components/SubtitleBlock.tsx` există și respectă safe zone (height * 0.225)
- [ ] Toate 12 compositions înregistrate în `src/Root.tsx`
- [ ] `npm run dev` pornește Remotion Studio fără erori
- [ ] Preview manual în Studio pentru fiecare template × format (spot check 4 × 3 = 12)

### Wizard Rise

- [ ] Step 3 — SubtitleEditor funcțional (add/edit/delete rows, validare from < to)
- [ ] Step 3 — Câmpuri CTA avansat (discountLabel, deliveryLabel, urgencyText, originalPrice)
- [ ] Step 3 — Ordine clips reordonabilă (ProductShowcase)
- [ ] Step 4 — `@remotion/player` afișează preview live (nu placeholder)
- [ ] Step 4 — Comenzile CLI conțin `--props` cu URL-uri reale (presigned)
- [ ] Notă "comenzile expiră în 60 min" vizibilă
- [ ] `POST /api/videos` nu mai încearcă să contacteze microservice fantomă
- [ ] Redirect corect după save la `/videos/{id}`

### Video Library

- [ ] Taburi Toate / Clipuri / Imagini / Audio funcționale (client-side filter)
- [ ] Search după filename și tags funcțional
- [ ] Hover pe card video → preview inline (video HTML autoPlay muted)
- [ ] Buton delete cu confirmare (dialog)
- [ ] Tags editabile inline

### Pagina Video Detail

- [ ] Status PENDING afișat cu instrucțiuni clare
- [ ] Comenzile CLI complete și corecte
- [ ] Buton "Regenerează comenzi" pentru presigned URLs expirate
- [ ] Buton "Marchează ca finalizat" → PATCH → status COMPLETED
- [ ] `PATCH /api/videos/[id]` implementat cu validare organizationId

### Integrare Campanii

- [ ] Schema Prisma actualizată cu `videoId` pe `MetaCampaign`
- [ ] Migrație Prisma generată și aplicată
- [ ] `VideoSelector` component implementat
- [ ] Wizard campanie include VideoSelector
- [ ] Pagina campanie afișează video atașat cu link

### Import Templates în Rise

- [ ] `next.config.ts` conține alias webpack + turbo pentru `@remotion-templates`
- [ ] `npm run dev` în `rise/` pornește fără erori de import
- [ ] `@remotion/player` randează template-ul corect per format activ

---

## 15. Sugestii de Îmbunătățire — Viitor

### Template-uri suplimentare

| Template              | Descriere                                           | Prioritate |
|-----------------------|-----------------------------------------------------|-----------|
| **TestimonialReel**   | Citat client + headshot + produs                    | Medie      |
| **CountdownOffer**    | Timer animat + produs + preț                        | Medie      |
| **UGC-style**         | Raw footage cu subtitluri imitate testimonial        | Înaltă     |
| **ProductUnboxing**   | Secvențe unboxing + reveal produs                   | Scăzută    |

### AI Subtitle Generation (Sub-proiect 5)

Placeholder deja prezent în Step 3. La implementare:
- Input: descriere produs (din Shopify), durata clipurilor
- Output: array de subtitluri în română, distribuite uniform pe timeline
- Provider: Claude API cu prompt structurat

```typescript
// Placeholder vizibil în StepConfigure:
<div className="border border-dashed rounded-lg p-3 bg-[#FAFAF9]">
  <p className="text-sm font-medium">✨ Generare automată subtitluri</p>
  <p className="text-xs text-[#78716C]">Sub-proiect 5 — AI Hook Generator</p>
</div>
```

### Render Progress Tracking

La Sub-proiect 7 (sau ca extensie), se poate adăuga:
- Un script wrapper `render.sh` care raportează progresul via webhook
- Rise primește webhook-ul și actualizează statusul video în timp real

### Thumbnail Generation

După render, extrage primul frame ca thumbnail JPG (via `ffmpeg -ss 0 -vframes 1`) și salvează în R2. Afișat în Library grid în loc de placeholder.

### Bulk Render

Un buton "Render toate formatele" care generează un script shell cu toate comenzile pentru toate formatele unui video:

```bash
#!/bin/bash
# Generat automat de Rise
for FORMAT in 9x16 4x5 1x1 16x9; do
  npx remotion render ProductShowcase-$FORMAT out/produs-$FORMAT.mp4 \
    --props=/tmp/produs-props.json \
    --concurrency=2
done
```

### Comparare A/B

La Sub-proiect mai avansat: permite crearea a 2 variante ale aceluiași template cu subtitluri diferite și trackuiește performanța Meta (CTR, ROAS) per variantă.

---

## 16. Ordine de Implementare Recomandată

Ordinea minimizează blocaje și permite testarea incrementală:

1. **SubtitleBlock component** — folosit de toate template-urile
2. **Template ProductShowcase (9x16)** — cel mai simplu, format nativ
3. **Înregistrare Root.tsx + preview în Remotion Studio** — verificare vizuală
4. **Variantele 4x5, 1x1, 16x9 ProductShowcase** — iterare rapidă
5. **Template BeforeAfter (9x16 + 3 variante)**
6. **Template Slideshow (9x16 + 3 variante)**
7. **Fix `next.config.ts` alias** — deblocat import în Rise
8. **Step 3 — SubtitleEditor**
9. **Step 4 — Player live** (necesită fix import + presigned URLs batch)
10. **Fix `POST /api/videos`** — elimină microservice fantomă
11. **`PATCH /api/videos/[id]`** + pagina video detail completă
12. **Library — taburi client-side + inline preview + delete**
13. **Integrare campanii** — schema migration + VideoSelector
14. **QA end-to-end** — wizard complet → render → marcare COMPLETED

---

*Document generat: 2026-03-29*
*Autor: Plan Rise Sub-proiect 6 — Video Creation Finalizare*
