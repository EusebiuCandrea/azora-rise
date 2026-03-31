# Azora Facebook Ad Video — Design Spec

**Date:** 2026-03-22
**Product:** Dispozitiv 5-in-1 Modelare Corporală & Lifting Facial (EMS, LED, Masaj Anticelulitic)
**Platform:** Facebook Stories / Reels
**Format:** 1080×1920 (9:16 vertical), 30fps, ~22 secunde (660 frames)

---

## Assets

| Fișier | Locație | Rol |
|--------|---------|-----|
| `A_woman_with_202603221721.mp4` | `public/` | Video background hook + brand |
| `azora-logo-full.png` | `public/` | Logo brand |

Assets se copiază din `/Users/Eusebiu1/Desktop/video/` în `public/`.

---

## Structura Secțiunilor

### 1. Hook (frames 0–90, 0–3s)
- Video full-screen ca fundal (loopat dacă necesar)
- Overlay gradient semi-transparent `rgba(26,5,51,0.55)` peste video
- Text centrat, animat fade-in + translateY:
  - Linie 1: `"CORPUL TĂU."` — alb, bold, 80px
  - Linie 2: `"TRANSFORMAT."` — violet electric `#a855f7`, bold, 80px, apare la frame 20

### 2. Brand (frames 90–150, 3–5s)
- Video continuă în fundal
- Logo Azora fade-in centrat (max-width 300px)
- Tagline mic sub logo: `"Tehnologie profesională. Acasă."` — alb, 28px

### 3. 5 Tehnologii (frames 150–540, 5–18s)
Fiecare tehnologie apare ~2.5s (75 frames), slide-in din dreapta:

| Index | Frames | Icoană | Nume |
|-------|--------|--------|------|
| 0 | 150–225 | ⚡ | EMS Microcurrent |
| 1 | 225–300 | 🌊 | Radiofrecvență RF |
| 2 | 300–375 | 🔥 | Infraroșu Termic |
| 3 | 375–450 | 💡 | Terapie LED |
| 4 | 450–540 | ✨ | Vibrații de Înaltă Frecvență |

Layout fiecare card:
- Fundal card: `rgba(168,85,247,0.15)` cu border `rgba(168,85,247,0.4)`
- Icoană mare (60px) + număr index + text tehnologie
- Animație: `spring()` pentru translateX (dreapta→centru)

### 4. Beneficii (frames 540–600, 18–20s)
3 bullet-uri animate rapid, staggered la fiecare 15 frames:
- `✓ Reduce celulita vizibil`
- `✓ Lifting facial acasă`
- `✓ Tonifiere & fermitate`

Culoare checkmark: `#f59e0b` (auriu)

### 5. Preț + CTA (frames 600–660, 20–22s)
- Preț nou: `"349 RON"` — bold, 72px, auriu `#f59e0b`
- Preț vechi: `"599 RON"` — text tăiat, gri, 40px
- Reducere badge: `"-41%"` — fond violet, text alb
- CTA button: `"Comandă pe azora.ro"` — pulse animation, gradient violet

---

## Paletă Cromatică

| Rol | Culoare |
|-----|---------|
| Background gradient start | `#1a0533` |
| Background gradient end | `#0d1b4b` |
| Accent principal | `#a855f7` (violet electric) |
| Text principal | `#ffffff` |
| Highlight preț | `#f59e0b` (auriu) |
| Card border | `rgba(168,85,247,0.4)` |

---

## Componente Remotion

```
src/
  Root.tsx              — înregistrare composition 1080×1920, 660 frames
  AzoraAd.tsx           — componenta principală, orchestrează secțiunile
  sections/
    HookSection.tsx     — video bg + text hook
    BrandSection.tsx    — logo + tagline
    TechSection.tsx     — showcase 5 tehnologii
    BenefitsSection.tsx — 3 bullet beneficii
    CTASection.tsx      — preț + buton CTA
```

---

## Render Command

```bash
npx remotion render AzoraAd out/azora-facebook-ad.mp4
```
