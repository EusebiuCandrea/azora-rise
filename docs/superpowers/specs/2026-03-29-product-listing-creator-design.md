# Rise — Product Listing Creator

**Date:** 2026-03-29
**Status:** Approved design, ready for implementation planning
**Feature:** Creare automată listing Shopify din URL sursă (Alibaba, AliExpress etc.) cu AI

---

## Problemă

Crearea unui listing nou în Shopify implică 3 pași dureroși:
1. Redactarea descrierii în stilul AZORA (română, emoji, secțiuni standard)
2. Găsit/editat imagini potrivite
3. Completat manual toate câmpurile în Shopify Admin

Fluxul actual: Excel de bază (produs, cantitate, preț achiziție) + research manual pe Alibaba + copy-paste în Shopify Admin.

---

## Soluție

URL-first listing generator: utilizatorul pasează un URL de produs (Alibaba/AliExpress/orice marketplace), Rise extrage datele automat, Claude generează listing-ul complet în stilul AZORA, listingul intră într-un queue de draft-uri pentru review și editare, iar după aprobare se publică direct în Shopify via API.

---

## Flux complet

```
[User] Pasează URL produs (Alibaba, AliExpress etc.)
    ↓
[Firecrawl API] Scrape → JSON structurat:
                titlu, descriere, specificații,
                imagini, preț furnizor
    ↓ (fallback: Jina AI Reader dacă Firecrawl eșuează)
[Claude API] Input: date brute + AZORA Listing Rules (system prompt)
             Output: listing complet în română —
               titlu SEO optimizat
               descriere HTML cu emoji și secțiuni standard
               beneficii, mod utilizare, conținut pachet
               rezultate pe săptămâni (dacă aplicabil)
    ↓
[DB] Salvat ca ProductDraft (status: PENDING_REVIEW)
    ↓
[UI Rise] Editor inline — utilizatorul editează orice câmp,
          înlocuiește imagini, ajustează prețuri
    ↓
[User] Apasă "Publică în Shopify"
    ↓
[Shopify Admin API] Creează produsul ca draft
                    Uploadează imaginile direct din URLs
                    Returnează shopifyProductId
    ↓
[DB] Draft actualizat: status PUBLISHED + shopifyProductId
```

---

## AZORA Listing Rules (system prompt)

Regulile sunt hardcodate în `features/products/services/listing-generator.ts`. Sunt derivate din listingurile reale Azora.ro (Dispozitiv 5 in 1, Bagheta Magica etc.) și documentul intern de reguli.

### Titlu
- Format: `[Nume produs descriptiv] – [Caracteristică cheie] [Beneficiu principal]`
- Include întotdeauna specificații tehnice relevante în titlu (ex: "5 in 1", "1080P", "360 Grade")
- NU include cuvântul "AZORA" în titlu (apare separat ca brand în Shopify)
- Max 120 caractere, optimizat pentru search Shopify/Google

### Ton și limbă
- **Limbă:** Română exclusiv
- **Ton:** Empatic, cald, orientat spre beneficii emoționale și practice — nu spre specificații tehnice
- Vorbește direct clientului: "tu", "corpul tău", "copilul tău"
- Evită jargon tehnic fără explicație imediată

### Structura descrierii — adaptată după tipul produsului

**Secțiune 1 — Hook emoțional** (obligatorie)
- Un singur rând cu emoji mare + beneficiu principal în CAPS
- Ex: `🎉 DISTRACȚIE FĂRĂ LIMITE - SUTE DE BULE MAGICE LA APĂSAREA UNUI BUTON`
- Ex: `💎 Corpul tău merită cel mai bun tratament – AZORA aduce salonul acasă!`

**Secțiune 2 — Problema clientului** (pentru produse beauty/wellness/health)
- 2-3 fraze care validează durerea clientului înainte de a prezenta soluția
- Omisă pentru produse de joacă/distracție/decor

**Secțiunile 3-N — Caracteristici principale** (obligatoriu, 3-6 secțiuni)
- Fiecare secțiune: `[EMOJI] [TITLU CAPS] – [SUBTITLU OPTIONAL]`
- Urmat de descriere scurtă orientată spre beneficiu
- Dacă produsul are mai multe funcții: listă numerotată `1. Funcție – Beneficiu`
- Emoji-uri recomandate: ⚡🌈🔋🧴👆🔄✅🎯💡🏆

**Secțiune Rezultate** (doar pentru produse cu efect progresiv: beauty, fitness, health)
- Format: `✅ REZULTATE DEMONSTRATE`
- Timeline: Săptămâna 2-4 / 4-8 / 8-12 cu beneficii concrete
- Omisă pentru produse fără efect progresiv

**Secțiune Utilizare** (obligatorie pentru dispozitive/aparate)
- `📋 CUM SE FOLOSEȘTE` cu pași numerotați, simpli
- Omisă pentru produse simple (jucării, decorațiuni)

**Secțiune Ocazii / Pentru cine este** (obligatorie)
- Pentru produse de distracție/cadou: `🎈 OCAZII PERFECTE` cu situații concrete
- Pentru produse wellness/beauty: `👥 PENTRU CINE ESTE` cu profiluri de utilizator
- Format: bullet points cu context specific (nu generic)

**Secțiune Siguranță** (dacă relevant)
- `✅ SIGURANȚĂ CERTIFICATĂ` — menționat scurt dacă produsul are certificări sau e pentru copii

**Call to Action** (obligatoriu, penultima secțiune)
- `✨ Comandă acum și [beneficiu imediat]!`
- 1-2 fraze maxim

**Conținut pachet** (obligatoriu, ultima secțiune)
- `📦 CONȚINUT PACHET`
- Listă cu toate elementele din cutie, exacte

### Reguli de formatare
- Fiecare secțiune separată de o linie goală
- Titluri secțiuni: CAPS, fără bold (Shopify nu renderează markdown)
- Bullet points cu `•` sau linie nouă indentată, nu `-` sau `*`
- Fără tabele, fără headings HTML — text simplu cu emoji
- **FĂRĂ diacritice** — română fără ș,ț,ă,î,â (ex: "nastere", "distractie", "magica")

---

## Schema DB

Tabel nou `ProductDraft`:

```prisma
model ProductDraft {
  id               String       @id @default(cuid())
  organizationId   String
  sourceUrl        String       // URL-ul sursă original
  title            String
  descriptionHtml  String       @db.Text
  price            Float        // Preț vânzare RON
  compareAtPrice   Float?       // Preț comparat (barat)
  images           String[]     // URLs imagini (sursă sau uploadate)
  tags             String[]
  shopifyCategory  String?
  status           DraftStatus  @default(PENDING_REVIEW)
  shopifyProductId String?      // Populat după publicare
  errorMessage     String?      // Dacă status = FAILED
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  publishedAt      DateTime?
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, status])
}

enum DraftStatus {
  PENDING_REVIEW
  APPROVED
  PUBLISHED
  FAILED
}
```

---

## APIs externe

| Serviciu | Rol | Plan gratuit |
|----------|-----|-------------|
| **Firecrawl** (`firecrawl.dev`) | Scraping URL → JSON structurat | 500 credite/lună |
| **Jina AI Reader** (`r.jina.ai/<url>`) | Fallback scraping, text simplu | Nelimitat |
| **Claude API** | Generare listing în stilul AZORA | Pay-per-use |
| **Shopify Admin API** | `POST /products.json` + `POST /images.json` | Inclus |

**Strategie fallback scraping:**
1. Încearcă Firecrawl (structurat, imagini incluse)
2. Dacă eșuează → Jina AI Reader (text + URL-uri imagini)
3. Dacă ambele eșuează → eroare cu mesaj clar pentru utilizator

---

## Fișiere noi

```
rise/
├── app/(dashboard)/products/
│   └── new/
│       └── page.tsx                          ← Form URL + stare generare
├── app/api/products/
│   ├── drafts/
│   │   ├── route.ts                          ← POST: scrape + generate + salvează
│   │   └── [id]/
│   │       ├── route.ts                      ← GET/PUT: citire + editare draft
│   │       └── publish/
│   │           └── route.ts                  ← POST: publică în Shopify
└── features/products/
    ├── components/
    │   ├── DraftEditor.tsx                   ← Editor inline draft
    │   ├── DraftList.tsx                     ← Lista draft-uri în /products
    │   └── UrlGeneratorForm.tsx              ← Form URL + loading states
    └── services/
        └── listing-generator.ts              ← Logica Firecrawl + Claude + AZORA rules
```

---

## UI

### `/products/new` — Generator

```
┌─────────────────────────────────────────────┐
│  Produs nou din URL                         │
│                                             │
│  [ https://alibaba.com/product/...        ] │
│  [ ✨ Generează listing                   ] │
│                                             │
│  ── Stare generare ──                       │
│  ✓ Date extrase din sursă                  │
│  ⏳ Se generează listing-ul...              │
└─────────────────────────────────────────────┘
```

### `/products/new?draft=<id>` — Editor draft

```
┌──────────────────────────────────────────────────────┐
│ ← Produse    [DRAFT]           [ Publică în Shopify ]│
├──────────────────────────────────────────────────────┤
│ Titlu                                                │
│ [Dispozitiv 5 in 1 Modelare Corporala – EMS...     ] │
│                                                      │
│ Preț vânzare    Preț comparat    Tags                │
│ [189 RON      ] [279 RON      ]  [beauty, ems, rf]  │
│                                                      │
│ Imagini                                              │
│ [img1] [img2] [img3] [× elimină] [+ Adaugă URL]     │
│                                                      │
│ Descriere                                            │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 💎 Corpul tau merita cel mai bun tratament...    │ │
│ │ ⚡ TEHNOLOGIE 5-IN-1...                          │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Sursă: alibaba.com/product/... (readonly)            │
└──────────────────────────────────────────────────────┘
```

### `/products` — Tab "Draft-uri"

Tab nou lângă "Toate produsele" care listează draft-urile cu status `PENDING_REVIEW`, cu acțiuni rapide "Editează" și "Publică".

---

## Error handling

| Scenariu | Comportament |
|----------|-------------|
| URL invalid / inaccesibil | Eroare imediată cu mesaj clar |
| Firecrawl eșuează | Fallback automat la Jina AI |
| Ambele scraping-uri eșuează | Eroare + sugestie să verifice URL-ul |
| Claude API eroare | Retry 1x, apoi eroare cu buton "Încearcă din nou" |
| Shopify publish eșuează | Draft rămâne `PENDING_REVIEW`, eroare vizibilă în editor |
| Imagine inaccesibilă la publish | Skip imaginea, log warning, publică fără ea |

---

## Out of scope

- Import bulk din Excel (se poate adăuga ulterior)
- Generare automată fără review (mereu draft first)
- Editare produse existente în Shopify (doar creare)
- Variante de produs (culori, mărimi) — Phase 2
- Traducere automată în alte limbi
