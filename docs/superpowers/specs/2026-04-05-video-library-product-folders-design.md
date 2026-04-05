# Video Library — Product → Ad → Resources Structure

**Date:** 2026-04-05  
**Status:** Approved

## Overview

Refactorizare a bibliotecii de resurse video pentru o structură ierarhică pe 3 niveluri:
**Produs → Reclamă → Resurse**

"Reclama" este un folder logic cu nume liber creat de user, care grupează resursele sursă pentru un video distinct. Un produs poate avea multiple reclame, fiecare cu resurse proprii.

---

## 1. Modificări DB (Prisma)

### Model nou: `VideoAd`

```prisma
model VideoAd {
  id             String       @id @default(cuid())
  organizationId String
  productId      String
  name           String       // ex: "reclama-vara", "black-friday"
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  product        Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  assets         VideoAsset[]

  @@index([organizationId])
  @@index([productId])
  @@unique([productId, name])  // nume unic per produs
}
```

### `VideoAsset` — câmp nou `adId`

```prisma
model VideoAsset {
  // câmpuri existente...
  adId  String?    // NOU — null = asset neasignat
  ad    VideoAd?   @relation(fields: [adId], references: [id], onDelete: SetNull)

  @@index([organizationId, adId])  // index nou
}
```

### `Product` — relație nouă

```prisma
model Product {
  // ...
  videoAds    VideoAd[]   // NOU
}
```

- `adId` pe `VideoAsset` este opțional — backward compatible
- `onDelete: SetNull` pe VideoAsset — dacă reclama e ștearsă, resursele devin neasignate
- `onDelete: Cascade` pe VideoAd — dacă produsul e șters, reclamele lui se șterg

---

## 2. R2 Key Pattern

| Situație | Pattern |
|----------|---------|
| Cu produs + reclamă | `{orgId}/assets/{productSlug}/{adSlug}/{sanitizedFilename}` |
| Neasignat | `{orgId}/assets/_unassigned/{sanitizedFilename}` |

- `productSlug` = din `product.title` (lowercase, spații → `-`, caractere speciale eliminate)
- `adSlug` = din `videoAd.name` (același sanitize)

**Backward compat:** Asset-urile existente (`{orgId}/clips/...`) rămân neatinse în R2. Primesc `adId: null` în DB.

---

## 3. API Changes

### `POST /api/assets/upload-url`

**Body:**
```typescript
{
  filename: string
  contentType: string
  sizeBytes?: number
  adId?: string  // NOU — ID-ul reclamei selectate
}
```

**Logică:**
1. Dacă `adId` prezent → verifică că `videoAd.organizationId === orgId` (securitate multi-tenant)
2. Rezolvă `productSlug` și `adSlug` din DB
3. Construiește R2 key: `{orgId}/assets/{productSlug}/{adSlug}/{sanitized}`
4. Salvează `adId` pe `VideoAsset`

### `POST /api/video-ads` — NOU

Creează o reclamă nouă.

```typescript
// Request
{ productId: string, name: string }

// Response
{ id: string, name: string, productId: string }
```

- Validare: `name` min 1, max 100 caractere
- Verificare ownership: `product.organizationId === orgId`
- Unique constraint: dacă există deja `(productId, name)` → returnează eroare 409

---

## 4. Upload Flow (UI)

### Modal în 3 pași

**Pasul 1 — Selectează produsul:**
- Lista produse cu search
- Buton "Continuă"

**Pasul 2 — Selectează / creează reclama:**
- Lista reclamelor existente pentru produsul ales
- Câmp "Reclamă nouă" cu input de nume + buton "Creează"
- Reclamele nou create apar imediat în listă
- Buton "Continuă"

**Pasul 3 — Upload fișier:**
- Drag & drop / selectează fișier
- Breadcrumb deasupra: "📦 Bear Gift → 🎬 reclama-vara"
- Upload trimite `adId` la API

**Componente noi:**
- `UploadModal` — modal wrapper, gestionează cei 3 pași + state
- `ProductPicker` — pasul 1 (refolosește stilul `StepProduct.tsx`)
- `AdPicker` — pasul 2, lista reclame + creare nouă
- `AssetUploader` — modificat să primească `adId` prop

---

## 5. Library UI

### Layout 3 niveluri

```
┌─────────────────────────────────────────────────────────┐
│  Biblioteca                        [Încarcă fișiere]    │
├──────────────┬──────────────────────────────────────────┤
│ Toate        │  Bear Gift / reclama-vara    [Upload]    │
│              │  ──────────────────────────────────────  │
│ 📦 Bear Gift │  Tabs: Toate / Video / Imagini / Audio   │
│   ▼ expanded │                                          │
│   🎬 rec-1   │  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│   🎬 rec-2   │  │    │ │    │ │    │ │    │            │
│              │  └────┘ └────┘ └────┘ └────┘            │
│ 📦 EP-2011   │                                          │
│   ▶ collapsed│                                          │
│              │                                          │
│ 📁 Neasignate│                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Navigare via URL (`searchParams`)

- Fără param → "Toate"
- `?product={productId}` → toate reclamele produsului
- `?ad={adId}` → resursele unei reclame specifice
- `?unassigned=1` → assets fără reclamă

### Server Component flow

```typescript
// library/page.tsx
const { product: productFilter, ad: adFilter, unassigned } = await searchParams

// Sidebar: produse cu count de reclame
const products = await db.product.findMany({
  where: { organizationId: orgId },
  include: {
    videoAds: {
      include: { _count: { select: { assets: true } } }
    }
  }
})

// Assets filtrate
const assets = await db.videoAsset.findMany({
  where: {
    organizationId: orgId,
    ...(adFilter ? { adId: adFilter } : {}),
    ...(productFilter ? { ad: { productId: productFilter } } : {}),
    ...(unassigned ? { adId: null } : {}),
  },
  orderBy: { createdAt: 'desc' }
})
```

### Componente noi/modificate

| Componentă | Schimbare |
|------------|-----------|
| `library/page.tsx` | Refactorizat complet: layout 2 col, searchParams 3 niveluri |
| `LibrarySidebar` | NOU — produse expandabile cu reclame sub ele |
| `AssetUploaderSection` | Modificat — folosește `UploadModal` |
| `UploadModal` | NOU — modal 3 pași |
| `ProductPicker` | NOU — pasul 1 |
| `AdPicker` | NOU — pasul 2 cu creare reclamă inline |
| `AssetUploader` | Modificat — primește `adId` prop |

---

## 6. Ce NU se schimbă

- Wizard creare video (`VideoWizard`, `StepProduct`, etc.) — neatins
- `ProductVideo` model — neatins
- Logica rendering Remotion — neatinsă
- API routes existente pentru videos — neatinse
