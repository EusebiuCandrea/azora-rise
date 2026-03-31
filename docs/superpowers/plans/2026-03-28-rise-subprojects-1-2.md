# Rise — Sub-proiectele 1 + 2: Platform Core + Video Creation

## Context

Rise este o platformă AI pentru magazine Shopify (video ads + Meta campaigns + profitabilitate). Acest plan acoperă primele două sub-proiecte:
- **Sub-proiect 1 — Platform Core**: Next.js app, auth, DB, Shopify sync, pagini de bază, deployment pe Hostinger cu Dokploy
- **Sub-proiect 2 — Video Creation**: Template system, `@remotion/player` browser preview, video library UI, CLI render command generator (Option A — fără microservice)

**Repo:** `azora-ads` (existent) — se adaugă `rise/` ca subdirector cu propriul `package.json`. Codul Remotion existent rămâne neatins.

**Referințe folosite:**
- `docs/superpowers/specs/2026-03-28-rise-platform-design.md` — design aprobat
- `~/Downloads/CLAUDE.md` — patternuri Next.js (React Query hooks, feature-based structure, component anatomy)
- `~/Downloads/SKILL 1.md` — scaffolding steps pentru Next.js

**IMPORTANT — Referințele externe (`~/Downloads/CLAUDE.md`, `~/Downloads/SKILL 1.md`) nu sunt în repo. Patternurile relevante trebuie inlinuate în `rise/CLAUDE.md` înainte de implementare.**

---

## Deviații intenționate de la spec

Următoarele puncte diferă de `2026-03-28-rise-platform-design.md` prin decizie explicită:

| Deviație | Spec | Plan | Motivație |
|----------|------|------|-----------|
| **Auth** | Supabase Auth + RLS | NextAuth v5 credentials + Prisma User table | Simplitate Phase 1 single-user. **RLS deplasat la Phase 2.** Phase 1: izolare prin application-layer filtering Prisma — fiecare query TREBUIE să includă `where: { organizationId }`. |
| **Deployment** | Docker Compose + Nginx | Dokploy (deja instalat pe VPS) | Dokploy gestionează SSL (Let's Encrypt), reverse proxy și deployment automat. Funcționalitate echivalentă, operare mai simplă. |
| **Shopify** | Partner App (OAuth) | Custom App (token permanent, pastat manual) | Simplitate Phase 1 single-store. **Phase 2 necesită rewriting la Partner App OAuth — nu e o schimbare de config, ci rebuild complet.** |
| **AI Hook Generator** | În flow-ul video creation (Sub-project 2) | Deplasat la Sub-project 5 | Reduce scope Phase 1. Wizard-ul va avea un placeholder vizibil "Hook Generator (Sub-project 5)". |
| **Semantic search (pgvector)** | În Video Library (Sub-project 2) | Deplasat la Sub-project 5 | Phase 1 = tags manuale. Sub-project 5 = analiză Claude Vision + embeddings. Necesită migrație Supabase + backfill la momentul respectiv. |
| **subscriptions table** | În data model | Omis din schema Phase 1 | Phase 2 (SaaS). Marcat ca `// Subscription model — Phase 6 (SaaS), see spec` în schema.prisma. |
| **Structura proiect** | `app/` + `api/` la root repo | Totul în `rise/` subdirectory | Izolează Next.js de Remotion — `package.json` separate, fără conflicte de dependențe. |
| **n8n** | Menționat în deployment stack | Nu face parte din acest plan | n8n se deployează separat pe același VPS, nu e componentă Rise. |
| **Remotion render** | Server-side (microservice + BullMQ + Chrome pe VPS) | Option A: `@remotion/player` browser preview + CLI local | VPS 4GB RAM nu suportă Chrome headless stabil. Render local pe Mac = calitate maximă, cost zero. Rise = interfață configurare + preview. |

---

## Structura finală `rise/`

```
azora-ads/
├── src/                    ← Remotion (neatins)
├── public/                 ← Remotion assets (neatins)
├── rise/                   ← EXISTENT: Next.js 16 app (deja scaffolded)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx          ← Sidebar + Header
│   │   │   │   ├── page.tsx            ← Dashboard overview
│   │   │   │   ├── products/
│   │   │   │   │   ├── page.tsx        ← Product list (synced din Shopify)
│   │   │   │   │   └── [id]/page.tsx   ← Product detail + cost config
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx        ← Integrations (Shopify, Meta status)
│   │   │   ├── api/
│   │   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   │   ├── shopify/
│   │   │   │   │   ├── connect/route.ts    ← POST: validează + salvează token
│   │   │   │   │   ├── sync/route.ts       ← POST: enqueue sync job (async)
│   │   │   │   │   └── webhook/route.ts    ← POST: update produse (HMAC obligatoriu)
│   │   │   │   └── products/
│   │   │   │       ├── route.ts            ← GET: list
│   │   │   │       └── [id]/
│   │   │   │           ├── route.ts        ← GET/PUT
│   │   │   │           └── cost/route.ts   ← PUT: salvează cost config
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css
│   │   │   └── style-guide/page.tsx    ← design tokens reference (dev-only)
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   └── helpers.ts          ← getCurrentUser(), requireAuth(), getCurrentOrgId()
│   │   │   ├── products/
│   │   │   │   ├── components/
│   │   │   │   │   ├── ProductList.tsx
│   │   │   │   │   ├── ProductCard.tsx
│   │   │   │   │   └── ProductCostForm.tsx
│   │   │   │   └── hooks/
│   │   │   │       └── useProducts.ts  ← React Query hook (singurul loc pt hooks produse)
│   │   │   └── shopify/
│   │   │       ├── client.ts           ← Shopify Admin API client (cu validare shopDomain)
│   │   │       ├── sync.ts             ← sync logic cu cursor pagination loop
│   │   │       └── types.ts
│   │   ├── components/
│   │   │   ├── ui/                     ← shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   └── common/
│   │   │       └── LoadingSpinner.tsx
│   │   └── lib/
│   │       ├── db.ts                   ← Prisma singleton
│   │       ├── auth.ts                 ← NextAuth config
│   │       ├── crypto.ts              ← encrypt/decrypt tokens (AES-256-GCM)
│   │       └── hooks/
│   │           └── useApiQuery.ts     ← React Query base wrapper (generic)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── Dockerfile
└── rise/src/
    └── app/(dashboard)/
        └── videos/
            ├── page.tsx              ← lista video-uri create
            ├── library/page.tsx      ← upload + lista assets
            └── new/page.tsx          ← wizard + @remotion/player preview + CLI command
```

**NOTĂ:** NU se creează `remotion-service/` sau `docker-compose.yml` — arhitectura Option A elimină microservice-ul complet. Dokploy deployează doar Rise. Redis/BullMQ nu sunt necesare pentru video.

---

## Pașii de implementare

### Pasul 0 — Pregătire: citește Next.js 16 docs

**OBLIGATORIU înainte de orice cod App Router:**

```bash
# rise/ este deja scaffolded cu Next.js 16.2.1
# NU rula create-next-app — directorul există
cd azora-ads/rise

# Citește breaking changes Next.js 16:
# node_modules/next/dist/docs/
```

**Breaking changes critice Next.js 16 (vs. 15):**
- `params`, `searchParams`, `cookies`, `headers`, `draftMode` sunt **async** — trebuie `await`-uite
- `middleware.ts` se numește acum `proxy.ts`
- Verifică orice API schimbat în docs înainte de a scrie cod

**Instalează dependențele lipsă** (scaffold-ul nu le include):
```bash
cd rise
npm install zod @tanstack/react-query react-hook-form @hookform/resolvers
npm install next-auth@beta @auth/prisma-adapter
npm install @prisma/client bcryptjs
npm install -D prisma @types/bcryptjs
npx prisma init    # creează rise/prisma/ cu schema.prisma
npx shadcn@latest init --defaults
npx shadcn@latest add button input label card badge separator textarea form dialog table dropdown-menu --yes
```

**Adaugă scripturile lipsă în `rise/package.json`:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "npx prisma db seed",
    "db:studio": "npx prisma studio"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Setează `output: 'standalone'` în `rise/next.config.ts`:**
```typescript
const nextConfig = {
  output: 'standalone',
}
export default nextConfig
```

---

### Pasul 1 — Design tokens (globals.css + layout.tsx)

Brand colors Rise (inspirat din Azora + SaaS dark theme):

```css
/* rise/src/app/globals.css */
@theme inline {
  --color-primary: #4A1B6D;        /* brand purple */
  --color-primary-foreground: #ffffff;
  --color-accent: #D4AF37;         /* brand gold */
  --color-background: #0f0a1a;     /* dark bg */
  --color-foreground: #f5f0ff;
  --color-card: #1a1030;
  --color-card-foreground: #f5f0ff;
  --color-muted: #2a1f45;
  --color-muted-foreground: #9585b8;
  --color-border: #2d1f4a;
  --color-sidebar: #120d26;
  --font-sans: var(--font-inter);
  --radius: 0.5rem;
}
```

Font: Inter (din next/font/google) — standard SaaS dashboard.

---

### Pasul 2 — Prisma Schema

**Fișier:** `rise/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id          String               @id @default(cuid())
  email       String               @unique
  password    String
  name        String?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  memberships OrganizationMember[]
}

model Organization {
  id                String             @id @default(cuid())
  name              String
  slug              String             @unique
  incomeTaxType     IncomeTaxType      @default(MICRO_1)
  shopifyFeeRate    Float              @default(0.02)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  members           OrganizationMember[]
  shopifyConnection ShopifyConnection?
  metaConnection    MetaConnection?
  products          Product[]
  videoAssets       VideoAsset[]
  productVideos     ProductVideo[]
  campaigns         Campaign[]
}

model OrganizationMember {
  id             String       @id @default(cuid())
  organizationId String
  userId         String
  role           MemberRole   @default(VIEWER)
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
}

model ShopifyConnection {
  id                    String       @id @default(cuid())
  organizationId        String       @unique
  shopDomain            String       // e.g. "azora.myshopify.com" — validat regex ^[a-z0-9-]+\.myshopify\.com$
  accessTokenEncrypted  String       // AES-256-GCM encrypted — decrypt via lib/crypto.ts
  webhookSecret         String       // NON-nullable — obligatoriu pentru HMAC verification
  isSyncing             Boolean      @default(false)  // lock pentru sync concurente
  lastSyncedAt          DateTime?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  organization          Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model MetaConnection {
  id                    String       @id @default(cuid())
  organizationId        String       @unique
  adAccountId           String
  pageId                String?
  pixelId               String?
  accessTokenEncrypted  String       // AES-256-GCM encrypted
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  organization          Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model Product {
  id             String        @id @default(cuid())
  organizationId String
  shopifyId      String
  title          String
  handle         String
  price          Float
  compareAtPrice Float?
  imageUrl       String?
  status         String        @default("active")
  shopifyData    Json?         // doar câmpurile necesare, nu raw Shopify response
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  cost           ProductCost?
  videos         ProductVideo[]
  @@unique([organizationId, shopifyId])
  @@index([organizationId])
  @@index([organizationId, status])
}

model ProductCost {
  id                    String   @id @default(cuid())
  productId             String   @unique
  cogs                  Float    @default(0)
  supplierVatDeductible Boolean  @default(false)
  shippingCost          Float    @default(0)
  packagingCost         Float    @default(0)
  vatRate               Float    @default(0.19)
  returnRate            Float    @default(0.05)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  product               Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ProductVideo {
  id             String       @id @default(cuid())
  productId      String
  organizationId String
  template       String
  status         RenderStatus @default(PENDING)
  formats        Json?        // { "9x16": "url", "4x5": "url", "1x1": "url", "16x9": "url" }
  params         Json?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  product        Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([productId])
}

model VideoAsset {
  id             String     @id @default(cuid())
  organizationId String
  filename       String
  url            String
  type           AssetType  @default(CLIP)
  analysis       Json?
  tags           String[]
  durationSeconds Float?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
}

model Campaign {
  id             String         @id @default(cuid())
  organizationId String
  metaCampaignId String?
  name           String
  status         CampaignStatus @default(DRAFT)
  budget         Float
  objective      String         @default("OUTCOME_SALES")
  startDate      DateTime?
  endDate        DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  metrics        CampaignMetrics[]
  @@index([organizationId])
}

model CampaignMetrics {
  id          String   @id @default(cuid())
  campaignId  String
  date        DateTime
  spend       Float    @default(0)
  impressions Int      @default(0)
  clicks      Int      @default(0)
  purchases   Int      @default(0)
  roas        Float?
  cpm         Float?
  ctr         Float?
  createdAt   DateTime @default(now())
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  @@unique([campaignId, date])
}

// Subscription model — Phase 6 (SaaS), see spec 2026-03-28-rise-platform-design.md
// model Subscription { ... }

enum MemberRole    { OWNER ADMIN VIEWER }
enum IncomeTaxType { MICRO_1 MICRO_3 PROFIT_16 }
enum RenderStatus  { PENDING PROCESSING COMPLETED FAILED }
enum AssetType     { CLIP IMAGE AUDIO }
enum CampaignStatus { DRAFT ACTIVE PAUSED COMPLETED }
```

**Diferențe față de versiunea anterioară:**
- `accessToken` → `accessTokenEncrypted` pe `ShopifyConnection` și `MetaConnection`
- `webhookSecret` non-nullable (obligatoriu)
- `isSyncing` flag pe `ShopifyConnection` (previne race conditions la sync)
- `ProductVideo` are acum `@relation` la `Organization` cu `onDelete: Cascade`
- `@@index([organizationId])` pe toate tabelele cu foreign key
- `@@index([organizationId, status])` pe `Product` (query frecvent)
- `@@index([userId])` pe `OrganizationMember`
- Comentariu explicit pentru `Subscription` model (Phase 6)

---

### Pasul 3 — Token Encryption (lib/crypto.ts)

**Fișier:** `rise/src/lib/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'base64') // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decrypt(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(dataB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

Folosit în `POST /api/shopify/connect` la salvare și în `features/shopify/client.ts` la citire.

---

### Pasul 4 — NextAuth v5 (credentials provider)

**Fișier:** `rise/src/lib/auth.ts`

```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),  // min 12 chars (NIST SP 800-63B)
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const result = loginSchema.safeParse(credentials)
        if (!result.success) return null  // safeParse, nu parse — nu aruncă ZodError
        const { email, password } = result.data
        const user = await db.user.findUnique({ where: { email } })
        if (!user) return null
        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null
        // Resolve organizationId la login — stocăm în JWT
        const membership = await db.organizationMember.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },  // deterministic ordering
        })
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: membership?.organizationId ?? null,
        }
      }
    })
  ],
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.organizationId = (user as any).organizationId
      }
      return token
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      if (token.organizationId) (session as any).organizationId = token.organizationId as string
      return session
    }
  }
})
```

**Diferențe față de versiunea anterioară:**
- `loginSchema.safeParse()` în loc de `parse()` — returnează null pe eroare, nu aruncă ZodError
- Password min 12 chars (NIST SP 800-63B)
- `organizationId` rezolvat la login și stocat în JWT — elimină extra DB round-trip per request
- `orderBy: { createdAt: 'asc' }` pentru ordering deterministic (nu "primul random")

**Helper:** `rise/src/features/auth/helpers.ts`
- `getCurrentUser()` — returnează userul din sesiune (server component / API route)
- `requireAuth()` — redirect la /login dacă nu e autentificat
- `getCurrentOrgId()` — citește `organizationId` din session JWT (NU din DB). Validează că userul e membru al org-ului.

**Seed:** `rise/prisma/seed.ts` — creează userul Eusebiu + organizația Azora. ASSERT că `SEED_PASSWORD` este setat și >= 12 chars.

---

### Pasul 5 — Shopify Private App Connection

Shopify Private App (nu Partner OAuth) — mai simplu pentru Phase 1:
1. User merge în Shopify Admin → Settings → Apps → Develop apps
2. Creează Custom App, acordă scopes: `read_products`, `write_products`, `read_orders`
3. Copiază Admin API access token → îl introduce în Rise Settings

**IMPORTANT Phase 2:** Custom App nu poate fi instalat pe alt magazin. Phase 2 multi-store necesită rebuild complet la Partner App OAuth.

**Fișier:** `rise/src/features/shopify/client.ts`
```typescript
import { decrypt } from '@/lib/crypto'

const SHOP_DOMAIN_REGEX = /^[a-z0-9-]+\.myshopify\.com$/

export function validateShopDomain(domain: string): boolean {
  return SHOP_DOMAIN_REGEX.test(domain)
}

export function createShopifyClient(shopDomain: string, accessTokenEncrypted: string) {
  if (!validateShopDomain(shopDomain)) {
    throw new Error(`Invalid Shopify domain: ${shopDomain}`)
  }
  const accessToken = decrypt(accessTokenEncrypted)
  const baseUrl = `https://${shopDomain}/admin/api/2025-01`

  return {
    async getProducts(limit = 250, pageInfo?: string) {
      const params = new URLSearchParams({
        limit: String(limit),
        fields: 'id,title,handle,variants,images,status'
      })
      if (pageInfo) params.set('page_info', pageInfo)
      const res = await fetch(`${baseUrl}/products.json?${params}`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      })
      if (!res.ok) throw new Error(`Shopify API error: ${res.status}`)
      const linkHeader = res.headers.get('Link')
      const nextPageInfo = parseLinkHeader(linkHeader)
      return { data: await res.json(), nextPageInfo }
    },

    /** Validare rapidă: token funcționează? */
    async verifyConnection() {
      const res = await fetch(`${baseUrl}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      })
      return res.ok
    },

    async getOrders(sinceId?: string) {
      // Stub — Sub-proiect 3 (Profitability). Aruncă eroare dacă e apelat accidental.
      throw new Error('getOrders() not implemented — see Sub-project 3')
    }
  }
}

function parseLinkHeader(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/<[^>]*page_info=([^&>]*).*?>;\s*rel="next"/)
  return match?.[1] ?? null
}
```

**Fișier:** `rise/src/features/shopify/sync.ts`
- `syncProducts(orgId)` — **cursor pagination loop**: preia pagini de 250 produse, continuă cât timp `nextPageInfo` e non-null, upsert fiecare pagină în DB
- Verifică `isSyncing` flag pe `ShopifyConnection` înainte de start (previne race conditions). Setează `true` la start, `false` la finish (inclusiv pe eroare via try/finally).
- Câmpuri sincronizate: `shopifyId`, `title`, `handle`, `price`, `compareAtPrice`, `imageUrl`, `status`
- `shopifyData` conține DOAR câmpurile necesare (variants, images), nu raw Shopify response complet
- Returnează `{ synced: number, updated: number, errors: string[] }`
- Produse cu `variants` lipsă sau malformate sunt skipuite cu log în `errors[]`

**API Routes:**
- `POST /api/shopify/connect` — body: `{ shopDomain, accessToken }`:
  1. Validează `shopDomain` cu regex `^[a-z0-9-]+\.myshopify\.com$` (previne SSRF)
  2. Apelează `verifyConnection()` — respinge dacă token-ul nu funcționează
  3. Encriptează `accessToken` cu `encrypt()` din `lib/crypto.ts`
  4. Salvează `ShopifyConnection` cu `accessTokenEncrypted`
  5. Enqueue sync job în BullMQ (async, nu blocking)
- `POST /api/shopify/sync` — enqueue sync job în BullMQ, returnează `{ jobId }` imediat (NU blocking)
- `POST /api/shopify/webhook` — preia updates de produse:
  1. Verifică `X-Shopify-Hmac-SHA256` header cu `webhookSecret` (non-nullable)
  2. Respinge ORICE request fără HMAC valid

---

### Pasul 6 — Pagini UI

**IMPORTANT Next.js 16:** Toate paginile cu `params` sau `searchParams` trebuie `await`:
```typescript
// ✅ Corect în Next.js 16
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // ...
}
```

**Dashboard (`/`)**: Cards cu stats — produse active, campanii active, spend luna curentă (placeholder pentru Phase 3).

**Products (`/products`)**:
- Server component: citește produse din DB cu Prisma, **include cost relation** (`include: { cost: true }`) — previne N+1 queries
- `ProductList` → `ProductCard` (imagine + titlu + preț + status cost: configurat/neconfigurat)
- Link spre `/products/[id]` pentru configurare costuri

**Product Detail (`/products/[id]`)**:
- Afișează datele produsului (sync din Shopify)
- `ProductCostForm` — React Hook Form + Zod: COGS, TVA, transport, ambalaj, rata retur
- Salvează via `PUT /api/products/[id]/cost`

**Settings (`/settings`)**:
- Card "Shopify": status conectat + shop domain + buton "Sync Now" + formular conectare (shopDomain + accessToken)
- Card "Meta": status "Neconectat" (placeholder pentru Sub-proiect 3)

**Login (`/login`)**:
- Form simplu email + parolă → NextAuth `signIn()`

**NOTĂ:** Toate API routes TREBUIE să apeleze `requireAuth()` și să filtreze cu `organizationId` din session. Niciun query fără `where: { organizationId }`.

---

### Pasul 7 — Deployment cu Dokploy (Hostinger VPS Ubuntu)

Dokploy este deja instalat pe VPS-ul Hostinger. Gestionează SSL, reverse proxy și deployments automat — **NU se creează `docker-compose.yml` sau `nginx.conf`**.

**Fișier: `rise/Dockerfile`**

```dockerfile
FROM node:20-bullseye-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

**Diferențe față de versiunea anterioară:**
- `node:20-bullseye-slim` în loc de `node:20-alpine`
- `COPY . .` ÎNAINTE de `npx prisma generate` (build stage copiază tot, apoi generează)
- `prisma migrate deploy` rulează la startup (aplică migrații automat)
- `USER nextjs` — container rulează ca non-root
- Copiază `prisma/` dir + `@prisma` modules pentru runtime migrations

**Setup în Dokploy (o singură dată, manual în browser):**
1. Dokploy UI → New Application → tip: Docker
2. Source: GitHub repo `azora-ads`, branch `main`, Dockerfile path: `rise/Dockerfile`
3. Domain: `rise.azora.ro` → Dokploy generează SSL automat (Let's Encrypt)
4. Environment Variables: adaugă toate variabilele din `.env.example`
5. Deploy → Dokploy build + rulează containerul

**Redeploy automat (opțional):** GitHub webhook → la fiecare push pe `main`, Dokploy re-deployează automat.

---

### Pasul 8 — CLAUDE.md pentru Rise

Creează `rise/CLAUDE.md` cu:
- Stack: Next.js 16, Prisma, Supabase PostgreSQL, NextAuth v5, shadcn/ui, React Query, Zod
- `npm run dev` — dev server pe port 3000
- `npm run db:migrate` — rulează migrații Prisma
- `npm run db:seed` — creează user + org Azora
- `npm run db:studio` — Prisma Studio
- Patternuri obligatorii:
  - Feature-based structure (nu layer-based)
  - React Query hooks pentru toate apelurile client-side — hooks stau **în feature folder** (ex: `features/products/hooks/useProducts.ts`), nu în `lib/hooks/`
  - `lib/hooks/useApiQuery.ts` este doar base wrapper generic (React Query + error handling)
  - React Hook Form + Zod pentru toate formularele
  - Server Components by default, `"use client"` doar când e necesar
  - `getCurrentUser()` / `requireAuth()` în toate rutele protejate
  - **FIECARE query Prisma TREBUIE să includă `where: { organizationId }`** — izolarea tenant este application-layer (nu RLS)
  - Max 150-200 linii per UI component (Remotion templates sunt excepție — nu se aplică)
  - Tokens Shopify/Meta sunt ENCRYPTED — folosește `encrypt()`/`decrypt()` din `lib/crypto.ts`
  - `params`, `searchParams`, `cookies`, `headers` sunt async în Next.js 16 — trebuie `await`-uite
- **Referință:** Citește `node_modules/next/dist/docs/` pentru orice API Next.js 16

---

### Pasul 9 — Environment Variables

**Fișier:** `rise/.env.example`
```env
# Database (Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"  # schimbă în https://rise.azora.ro pentru production

# Token encryption (generate: openssl rand -base64 32)
TOKEN_ENCRYPTION_KEY="generate-with-openssl-rand-base64-32"

# Seed (min 12 chars)
SEED_PASSWORD="change-me-min-12-chars"

# Shopify (completat din Settings UI, nu hardcodat)
# SHOPIFY_WEBHOOK_SECRET="..."

# Cloudflare R2
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="rise-assets"

# Remotion Service (internal)
RENDER_SERVICE_URL="http://localhost:3001"
RENDER_WEBHOOK_SECRET="generate-with-openssl-rand-base64-32"

# Redis (BullMQ)
REDIS_URL="redis://localhost:6379"

# Claude API (Sub-proiect 5)
# ANTHROPIC_API_KEY="..."
```

---

---

# Sub-proiect 2 — Video Creation (Option A: Browser Preview + Local Render)

## Arhitectură

**Decizie de design:** Rise nu renderizează video pe server. Arhitectura este:

1. **`@remotion/player`** în Rise (Next.js) — preview live în browser, gratuit, fără server
2. **CLI Command Generator** — Rise generează comanda `npx remotion render` cu props corecte
3. **Local render pe Mac** — utilizatorul rulează comanda local pentru export MP4

**Avantaje față de microservice:**
- Zero cost infrastructură suplimentară (fără Redis, BullMQ, Chrome pe VPS)
- Fără timeout/memory issues pe VPS 4GB RAM
- Preview instantaneu în browser (Remotion player = React în timp real)
- Export MP4 calitate maximă pe mașina locală

## Structura adăugată

```
azora-ads/
├── src/                        ← Remotion original (neatins — SINGLE SOURCE OF TRUTH)
│   ├── components/             ← CTAOverlay, DynamicWatermark, SubtitleBlock
│   ├── scenes/
│   └── sections/
└── rise/src/
    └── app/(dashboard)/
        └── videos/
            ├── page.tsx              ← lista video-uri configurate
            ├── library/page.tsx      ← upload + lista assets
            └── new/page.tsx          ← wizard + @remotion/player preview + CLI command
```

---

## Pasul 10 — Template System (în root src/)

Template-urile Remotion se adaugă în root `src/templates/` — același loc ca componentele existente, fără directoare noi.

### Interfețe TypeScript

**`src/templates/index.ts`** — exportă toate interfețele și componentele:
```typescript
export { ProductShowcase } from './ProductShowcase'
export { BeforeAfter } from './BeforeAfter'
export { Slideshow } from './Slideshow'
export type { ProductShowcaseProps, BeforeAfterProps, SlideshowProps } from './types'
```

**`src/templates/types.ts`**:
```typescript
export interface ProductShowcaseProps {
  productName: string
  price: string
  tagline: string
  clips: string[]          // HTTPS URLs (din R2 presigned)
  subtitles: Array<{
    from: number           // frame start
    to: number             // frame end
    line1: string
    line2: string
  }>
  voiceover?: string
  discountLabel?: string
  deliveryLabel?: string
  totalFrames: number      // calculat de Rise din subtitles + clips
}

export interface BeforeAfterProps {
  productName: string
  price: string
  beforeClip: string
  afterClip: string
  beforeLabel?: string     // default "Inainte"
  afterLabel?: string      // default "Dupa"
  subtitles: Array<{ from: number; to: number; line1: string; line2: string }>
  voiceover?: string
  splitDurationFrames?: number  // default 150 (5s per side)
  totalFrames: number
}

export interface SlideshowProps {
  productName: string
  price: string
  images: string[]          // HTTPS URLs (min 3, max 10)
  subtitles: Array<{ from: number; to: number; line1: string; line2: string }>
  music?: string
  slideDurationFrames?: number  // default 90 (3s per slide)
  transitionFrames?: number    // default 15 (0.5s fade)
  totalFrames: number
}
```

**Root.tsx** se actualizează cu cele 12 composition-uri noi (3 templates × 4 formate):
```typescript
// Exemple — se adaugă lângă BearGiftAd, FacebookAd etc.
<Composition id="ProductShowcase-9x16" component={ProductShowcase} width={1080} height={1920} fps={30} durationInFrames={defaultFrames} defaultProps={defaultProductShowcaseProps} />
<Composition id="ProductShowcase-4x5"  component={ProductShowcase} width={1080} height={1350} fps={30} durationInFrames={defaultFrames} defaultProps={defaultProductShowcaseProps} />
<Composition id="ProductShowcase-1x1"  component={ProductShowcase} width={1080} height={1080} fps={30} durationInFrames={defaultFrames} defaultProps={defaultProductShowcaseProps} />
<Composition id="ProductShowcase-16x9" component={ProductShowcase} width={1920} height={1080} fps={30} durationInFrames={defaultFrames} defaultProps={defaultProductShowcaseProps} />
// ... identic pentru BeforeAfter și Slideshow
```

---

## Pasul 11 — @remotion/player în Rise

### Instalare

```bash
cd rise
npm install @remotion/player remotion
# remotion și react sunt peer deps — versiunile trebuie să fie identice cu root azora-ads/
```

**IMPORTANT:** Verifică că `remotion` version în `rise/package.json` este identică cu cea din root `package.json`. `@remotion/player` necesită același `remotion` version în aceeași aplicație.

### Component VideoPreview

**`rise/src/features/videos/components/VideoPreview.tsx`** (`"use client"`):

```typescript
'use client'
import { Player } from '@remotion/player'
import type { ComponentType } from 'react'

interface VideoPreviewProps {
  compositionId: string
  component: ComponentType<any>
  inputProps: Record<string, unknown>
  totalFrames: number
  width: number    // ex: 1080
  height: number   // ex: 1920
}

export function VideoPreview({ component, inputProps, totalFrames, width, height }: VideoPreviewProps) {
  return (
    <Player
      component={component}
      inputProps={inputProps}
      durationInFrames={totalFrames}
      fps={30}
      compositionWidth={width}
      compositionHeight={height}
      style={{ width: '100%', aspectRatio: `${width}/${height}` }}
      controls
      loop
    />
  )
}
```

**Cum se importă componentele Remotion în Rise:**

Rise este un Next.js app separat în `rise/`. Componentele Remotion sunt în root `src/`. Două opțiuni:
1. **Simplu (recomandat Phase 1):** Copiază interfețele și folosește `dynamic import` cu path relativ (`../../src/templates`)
2. **Elegant:** Configurează `tsconfig.json` în Rise cu path alias `@templates` → `../src/templates`

Alege opțiunea 2 — adaugă în `rise/tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@templates/*": ["../src/*"]
    }
  }
}
```

Și în `rise/next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  // ... existing config
  experimental: {
    serverComponentsExternalPackages: ['remotion', '@remotion/player'],
  },
}
```

---

## Pasul 12 — R2: Asset Upload (Server-side Proxy)

**Upload-ul se face prin server Next.js (nu direct browser → R2)** — evită complet problemele de CORS.

**`rise/src/app/api/assets/upload/route.ts`** — deja creat, acceptă `FormData` cu `file`, uploadează server-side cu `PutObjectCommand`.

**`rise/src/app/api/assets/preview/route.ts`** — deja creat, generează presigned download URL, returnează 307 redirect.

### Structura bucket R2

```
rise-assets/
├── {orgId}/
│   ├── clips/          ← video-uri uploadate de user
│   ├── audio/          ← voiceover-uri uploadate
│   └── images/         ← imagini produse
```

**NOTĂ:** Nu mai există `renders/` în R2 — MP4-urile se generează local și se distribuie direct (nu se stochează în R2 Phase 1).

---

## Pasul 13 — Video Library UI (`/videos/library`)

**Funcționalitate:**
- Grid cu assets uploadate (clipuri, audio, imagini)
- Upload drag & drop → `POST /api/assets/upload` (multipart) → salvează în DB
- Preview: `<video>` inline pentru clipuri (via `/api/assets/preview?key=...`), icon pentru audio/imagini
- Fiecare asset: filename, durată, tags manuale

**Componente:**
- `AssetGrid` — grid responsive
- `AssetUploader` — drag & drop + progress indicator
- `AssetCard` — preview + metadata + tags

**Schema DB — `VideoAsset`** (deja în schema.prisma):
- `r2Key` — cheia în R2 (ex: `orgId/clips/fisier.mp4`)
- `assetType` — `VIDEO | IMAGE | AUDIO`
- `tags` — `String[]` pentru filtrare manuală

---

## Pasul 14 — Video Creation Wizard (`/videos/new`)

**Flow în 4 pași:**

```
Step 1: Selectează produs
  → dropdown produse Shopify sync-ate
  → afișează: imagine, titlu, preț

Step 2: Alege template
  → 3 carduri: ProductShowcase / BeforeAfter / Slideshow
  → Preview static (screenshot) per template
  → "🤖 Hook Generator — Sub-project 5" (placeholder vizibil)

Step 3: Configurează
  → Clips: selectează din library (modal cu AssetGrid)
  → Subtitles: liste de { from, to, line1, line2 } editabile
  → Voiceover: selectează audio din library
  → CTA: tagline, prețuri, label-uri
  → totalFrames: calculat automat (ultimul subtitle.to + 180 frames CTA)

Step 4: Preview + Export
  → @remotion/player afișează preview live cu props configurate
  → Format picker: 9x16 / 4x5 / 1x1 / 16x9
  → Buton "Generează comanda render" → afișează CLI command
  → Salvează configurația în DB (ProductVideo cu status DRAFT)
```

**State management:**
- Wizard state în `useState` (nu server) — totul client-side
- La Step 4, `POST /api/videos` salvează configurația în DB

**`rise/src/app/api/videos/route.ts`** — POST: salvează `ProductVideo` cu `status: 'DRAFT'`, `params: JSON`

---

## Pasul 15 — CLI Command Generator

**Componenta `RenderCommand`** (`rise/src/features/videos/components/RenderCommand.tsx`):

```typescript
'use client'
import { useState } from 'react'

interface RenderCommandProps {
  compositionId: string  // ex: "ProductShowcase-4x5"
  inputProps: Record<string, unknown>
  outputFile: string     // ex: "out/product-4x5.mp4"
}

export function RenderCommand({ compositionId, inputProps, outputFile }: RenderCommandProps) {
  const [copied, setCopied] = useState(false)
  const propsJson = JSON.stringify(inputProps).replace(/'/g, "\\'")
  const command = `npx remotion render ${compositionId} ${outputFile} --props='${propsJson}'`

  return (
    <div className="bg-muted rounded p-4 font-mono text-sm">
      <pre className="whitespace-pre-wrap break-all">{command}</pre>
      <button onClick={() => { navigator.clipboard.writeText(command); setCopied(true) }}>
        {copied ? 'Copiat!' : 'Copiază comanda'}
      </button>
    </div>
  )
}
```

**UX pe pagina Step 4:**

```
┌─────────────────────────────────────────────────────┐
│  Preview live                                        │
│  [Remotion Player — 9x16]                           │
│                                                      │
│  Format: [9x16] [4x5] [1x1] [16x9]                 │
│                                                      │
│  Render local:                                       │
│  npx remotion render ProductShowcase-4x5            │
│  out/product-showcase-4x5.mp4 --props='...'         │
│  [📋 Copiază comanda]                               │
│                                                      │
│  Rulează din: azora-ads/ (directorul principal)     │
└─────────────────────────────────────────────────────┘
```

**Notă importantă pentru utilizator:** Comanda se rulează din directorul root `azora-ads/` (nu din `rise/`), unde există `package.json`-ul cu Remotion.

---

## Fișiere critice — Sub-proiect 1 + 2

| Fișier | Acțiune | Notă |
|--------|---------|------|
| `rise/next.config.ts` | Modifică | Adaugă `output: 'standalone'` |
| `rise/package.json` | Modifică | Adaugă scripts db:*, prisma seed config |
| `rise/prisma/schema.prisma` | Creat (după `prisma init`) | Schema completă (Pasul 2) |
| `rise/prisma/seed.ts` | Creat | User + org Azora, ASSERT SEED_PASSWORD |
| `rise/src/lib/auth.ts` | Creat | NextAuth config (Pasul 4) |
| `rise/src/lib/db.ts` | Creat | Prisma singleton |
| `rise/src/lib/crypto.ts` | Creat | AES-256-GCM encrypt/decrypt (Pasul 3) |
| `rise/src/lib/hooks/useApiQuery.ts` | Creat | React Query base wrapper (generic) |
| `rise/src/features/auth/helpers.ts` | Creat | getCurrentUser, requireAuth, getCurrentOrgId (din JWT) |
| `rise/src/features/shopify/client.ts` | Creat | Shopify API + SSRF validation + pagination |
| `rise/src/features/shopify/sync.ts` | Creat | Sync cu cursor loop + isSyncing lock |
| `rise/src/app/(auth)/login/page.tsx` | Creat | Login page |
| `rise/src/app/(dashboard)/layout.tsx` | Creat | Sidebar layout |
| `rise/src/app/(dashboard)/page.tsx` | Creat | Dashboard |
| `rise/src/app/(dashboard)/products/page.tsx` | Creat | Products list (include: { cost: true }) |
| `rise/src/app/(dashboard)/products/[id]/page.tsx` | Creat | Product detail (await params) |
| `rise/src/app/(dashboard)/settings/page.tsx` | Creat | Integrations |
| `rise/src/app/api/shopify/connect/route.ts` | Creat | Validare SSRF + encrypt token + async sync |
| `rise/src/app/api/shopify/sync/route.ts` | Creat | Enqueue BullMQ job (nu blocking) |
| `rise/src/app/api/shopify/webhook/route.ts` | Creat | HMAC obligatoriu |
| `rise/src/lib/r2.ts` | Creat | R2 client + presigned URLs cu validare |
| `rise/src/app/api/assets/upload/route.ts` | Creat | Server-side proxy upload (evită CORS) |
| `rise/src/app/api/assets/preview/route.ts` | Creat | Presigned download URL (307 redirect) |
| `rise/src/app/api/videos/route.ts` | Creat | Salvează config video (ProductVideo DRAFT) |
| `rise/src/features/videos/components/VideoPreview.tsx` | Creat | @remotion/player wrapper |
| `rise/src/features/videos/components/RenderCommand.tsx` | Creat | CLI command generator + copy button |
| `rise/src/app/(dashboard)/videos/library/page.tsx` | Creat | Asset library (upload + grid + preview) |
| `rise/src/app/(dashboard)/videos/new/page.tsx` | Creat | Wizard 4 pași + player preview + CLI command |
| `rise/src/app/globals.css` | Modifică | Rise brand tokens |
| `rise/src/app/style-guide/page.tsx` | Creat | Design reference (dev-only) |
| `rise/Dockerfile` | Creat | Bullseye + prisma migrate deploy + non-root |
| `rise/CLAUDE.md` | Creat/Modifică | Next.js 16 instructions + patterns |
| `rise/.env.example` | Creat | Toate variabilele documentate |
| `src/templates/types.ts` | Creat | TypeScript interfaces pentru toate template-urile |
| `src/templates/ProductShowcase.tsx` | Creat | Template principal |
| `src/templates/BeforeAfter.tsx` | Creat | Template beauty/wellness |
| `src/templates/Slideshow.tsx` | Creat | Template imagini |
| `src/templates/index.ts` | Creat | Export toate template-urile |
| `src/Root.tsx` | Modifică | Adaugă 12 composition-uri noi (3 templates × 4 formate) |

---

## Verificare

1. `cd rise && npm run dev` → `http://localhost:3000` se deschide
2. `/login` → autentificare cu Eusebiu (seeded)
3. `/settings` → introduci shopDomain + accessToken → "Connect" → verify + encrypt + async sync
4. `/products` → produsele Azora apar (sync din Shopify, toate paginile)
5. `/products/[id]` → salvezi COGS + TVA → se salvează în DB
6. **Teste security:** unauthenticated requests la fiecare API route → 401
7. **Teste webhook:** POST fabricat la `/api/shopify/webhook` fără HMAC valid → 401
8. `/videos/library` → upload clip test → apare în grid cu preview video
9. `/videos/new` → wizard: selectează produs → template → configurează → Step 4: @remotion/player afișează preview live
10. Step 4: `RenderCommand` afișează comanda `npx remotion render ...` cu props corecte
11. Rulează comanda din `azora-ads/` local → MP4 generat în `out/`
12. Dokploy: deploy Rise (singur) → `https://rise.azora.ro` funcțional end-to-end (fără remotion-service)

---

## Note

- **Auth**: Single user Phase 1. Seed-ul creează user `eusebiu@azora.ro` cu parolă din `SEED_PASSWORD` env var (min 12 chars). `organizationId` stocat în JWT.
- **Shopify**: Private app (token permanent, encriptat cu AES-256-GCM). Validare SSRF pe shopDomain. Sync async (direct, fără BullMQ) cu cursor pagination și isSyncing lock.
- **Multi-tenancy**: Schema are `organizationId` pe toate tabelele + `@@index`. Phase 1 are 1 org (Azora). **Izolarea este application-layer Prisma, nu RLS.** Fiecare query TREBUIE să includă `where: { organizationId }`.
- **Tailwind v4**: Rise folosește același Tailwind v4 ca Remotion, dar cu config separată în `rise/`.
- **Next.js 16**: `params`, `searchParams`, `cookies`, `headers` sunt async — trebuie `await`-uite. `middleware.ts` devine `proxy.ts`.
- **Remotion (Option A)**: Fără microservice. `@remotion/player` în Rise pentru preview browser. Template-uri în root `src/templates/`. Export MP4 = `npx remotion render` rulat local de utilizator. Rise generează comanda cu props corecte.
- **Redis/BullMQ**: Nu este necesar în Phase 1 video. Shopify sync se face direct (blocking pentru Phase 1 single-user — coadă se poate adăuga în Phase 2 dacă e nevoie).
- **Tokens**: ENCRYPTED la rest (AES-256-GCM). `encrypt()`/`decrypt()` din `lib/crypto.ts`. Cheia în `TOKEN_ENCRYPTION_KEY` env var.
- **Webhooks**: Toate endpoint-urile webhook (Shopify + render) verifică HMAC-SHA256 obligatoriu.
- **Docker**: Bullseye-slim (nu Alpine). Chrome Stable (nu Chromium). Non-root user. `prisma migrate deploy` la startup.

---

---

# Sub-proiect 2B — Product Listing Creator ⚠️ DEPLASAT

**Status:** Deplasat la un sub-proiect viitor (după Sub-proiect 6 — Subscripții).

**Motivație:** Funcționalitatea de generare automată a listing-urilor cu AI (Firecrawl + Claude) va fi o funcționalitate premium, disponibilă doar utilizatorilor cu abonament activ. Se implementează după ce sistemul de subscripții este funcțional.

**Spec de referință:** `docs/superpowers/specs/2026-03-29-product-listing-creator-design.md` — spec aprobat, rămâne valid pentru implementarea viitoare.

**Pașii 18-23 (Prisma model, listing-generator.ts, API routes, UI) sunt omisi din acest plan și se vor implementa într-un sub-proiect dedicat după ce subscripțiile sunt funcționale.**

Spec-ul complet rămâne în `docs/superpowers/specs/2026-03-29-product-listing-creator-design.md`.

---

## [DEPLASAT] Pasul 18 — Prisma: model ProductDraft

Adaugă în `rise/prisma/schema.prisma`:

```prisma
model ProductDraft {
  id               String       @id @default(cuid())
  organizationId   String
  sourceUrl        String
  title            String
  descriptionHtml  String       @db.Text
  price            Float
  compareAtPrice   Float?
  images           String[]
  tags             String[]
  shopifyCategory  String?
  status           DraftStatus  @default(PENDING_REVIEW)
  shopifyProductId String?
  errorMessage     String?
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

Adaugă relația inversă în `Organization`:
```prisma
productDrafts ProductDraft[]
```

Rulează: `npm run db:migrate`

---

## [DEPLASAT] Pasul 19 — Environment Variables noi

Adaugă în `.env.local` și `.env.example`:

```env
# Firecrawl (scraping URL → JSON structurat)
# Plan gratuit: 500 credite/lună — https://firecrawl.dev
FIRECRAWL_API_KEY="fc-..."

# Anthropic Claude API (generare listing)
ANTHROPIC_API_KEY="sk-ant-..."
```

**Jina AI Reader** nu necesită API key — folosit ca fallback gratuit via `https://r.jina.ai/<url>`.

---

## [DEPLASAT] Pasul 20 — Listing Generator Service

**Fișier:** `rise/features/products/services/listing-generator.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

/**
 * Pasul 1: Scrape URL cu Firecrawl, fallback Jina AI
 */
export async function scrapeProductUrl(url: string): Promise<ScrapedProduct> {
  // Încearcă Firecrawl (JSON structurat cu imagini)
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'extract'],
          extract: {
            schema: {
              title: 'string',
              description: 'string',
              specifications: 'string',
              images: 'array',
              price: 'string',
            }
          }
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return normalizeFirecrawlResponse(data)
      }
    } catch (_) {}
  }

  // Fallback: Jina AI Reader (text simplu, gratuit)
  const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!jinaRes.ok) throw new Error('Nu pot accesa URL-ul furnizat')
  const jinaData = await jinaRes.json()
  return normalizeJinaResponse(jinaData)
}

/**
 * Pasul 2: Generează listing AZORA cu Claude
 */
export async function generateAzoraListing(
  scraped: ScrapedProduct,
  targetPrice: number,
  compareAtPrice?: number
): Promise<GeneratedListing> {
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: AZORA_LISTING_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generează un listing complet pentru Shopify bazat pe aceste informații despre produs:

URL sursă: ${scraped.sourceUrl}
Titlu original: ${scraped.title}
Descriere sursă: ${scraped.description}
Specificații: ${scraped.specifications}
Preț vânzare AZORA: ${targetPrice} RON
${compareAtPrice ? `Preț comparat (barat): ${compareAtPrice} RON` : ''}
Imagini disponibile: ${scraped.images.join(', ')}

Returnează JSON cu structura:
{
  "title": "titlu SEO optimizat fara diacritice",
  "descriptionHtml": "descriere completa HTML cu sectiuni AZORA",
  "tags": ["tag1", "tag2"],
  "shopifyCategory": "categoria Shopify potrivita"
}`
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Răspuns neașteptat de la Claude')

  // Extrage JSON din răspuns
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude nu a returnat JSON valid')

  return JSON.parse(jsonMatch[0])
}

// AZORA Listing Rules — system prompt complet
const AZORA_LISTING_SYSTEM_PROMPT = `Ești un specialist în copywriting pentru e-commerce românesc, expert în stilul AZORA.

REGULI OBLIGATORII:
1. Limba: Romana fara diacritice (fara ș,ț,ă,î,â — scrie "nastere", "distractie", "magica")
2. Ton: Empatic, orientat spre beneficii emotionale si practice, nu spre specificatii tehnice
3. Vorbeste direct clientului: "tu", "corpul tau", "copilul tau"

STRUCTURA DESCRIERE (adaptata dupa tipul produsului):

[SECTIUNE 1 - HOOK - obligatorie]
Emoji mare + beneficiu principal in CAPS
Ex: "🎉 DISTRACTIE FARA LIMITE - SUTE DE BULE MAGICE LA APASAREA UNUI BUTON"
Ex: "💎 Corpul tau merita cel mai bun tratament – AZORA aduce salonul acasa!"

[SECTIUNE 2 - PROBLEMA - doar pentru beauty/wellness/health]
2-3 fraze care valideaza durerea clientului inainte de solutie
Omisa pentru produse de joaca/distractie/decor

[SECTIUNILE 3-N - CARACTERISTICI - 3-6 sectiuni]
Format: EMOJI TITLU CAPS – SUBTITLU OPTIONAL
Descriere scurta orientata spre beneficiu
Daca produsul are mai multe functii: lista numerotata "1. Functie – Beneficiu"
Emoji-uri recomandate: ⚡🌈🔋🧴👆🔄✅🎯💡🏆

[REZULTATE - doar pentru produse cu efect progresiv: beauty, fitness, health]
"✅ REZULTATE DEMONSTRATE"
Timeline: Saptamana 2-4 / 4-8 / 8-12 cu beneficii concrete
Omisa pentru produse fara efect progresiv

[UTILIZARE - obligatorie pentru dispozitive/aparate]
"📋 CUM SE FOLOSESTE" cu pasi numerotati simpli
Omisa pentru produse simple (jucarii, decoratiuni)

[OCAZII / PENTRU CINE ESTE - obligatorie]
Pentru produse de distractie/cadou: "🎈 OCAZII PERFECTE" cu situatii concrete
Pentru produse wellness/beauty: "👥 PENTRU CINE ESTE" cu profiluri utilizator

[CTA - obligatorie, penultima]
"✨ Comanda acum si [beneficiu imediat]!"
1-2 fraze maxim

[CONTINUT PACHET - obligatorie, ultima]
"📦 CONTINUT PACHET"
Lista exacta cu toate elementele din cutie

REGULI FORMATARE:
- Fiecare sectiune separata de linie goala
- Titluri sectiuni: CAPS, fara bold (Shopify nu rendereaza markdown)
- Fara tabele, fara headings HTML
- Fara diacritice in tot textul

TITLU:
- Format: [Nume produs descriptiv] – [Caracteristica cheie] [Beneficiu principal]
- Include specificatii tehnice in titlu (ex: "5 in 1", "1080P", "360 Grade")
- NU include cuvantul "AZORA" in titlu
- Max 120 caractere, fara diacritice

Returneaza DOAR JSON valid, fara text inainte sau dupa.`
```

**Pachete necesare:**
```bash
cd rise && npm install @anthropic-ai/sdk
```

---

## [DEPLASAT] Pasul 21 — API Routes

**`rise/app/api/products/drafts/route.ts`** — POST: scrape + generate + salvează

```typescript
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, price, compareAtPrice } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL lipsă' }, { status: 400 })

  try {
    // 1. Scrape URL
    const scraped = await scrapeProductUrl(url)

    // 2. Generează listing cu Claude
    const listing = await generateAzoraListing(scraped, price, compareAtPrice)

    // 3. Salvează draft în DB
    const draft = await db.productDraft.create({
      data: {
        organizationId: orgId,
        sourceUrl: url,
        title: listing.title,
        descriptionHtml: listing.descriptionHtml,
        price,
        compareAtPrice: compareAtPrice ?? null,
        images: scraped.images.slice(0, 10), // max 10 imagini
        tags: listing.tags,
        shopifyCategory: listing.shopifyCategory ?? null,
        status: 'PENDING_REVIEW',
      },
    })

    return NextResponse.json({ draftId: draft.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Eroare necunoscuta'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const drafts = await db.productDraft.findMany({
    where: { organizationId: orgId, status: { not: 'PUBLISHED' } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(drafts)
}
```

**`rise/app/api/products/drafts/[id]/route.ts`** — GET + PUT (editare)

```typescript
// GET: citire draft
// PUT: actualizare câmpuri (title, descriptionHtml, price, compareAtPrice, images, tags)
// Ambele verifică organizationId — nu pot accesa draft-uri din alte org-uri
```

**`rise/app/api/products/drafts/[id]/publish/route.ts`** — POST: publică în Shopify

```typescript
export async function POST(req: NextRequest) {
  // 1. Citește draft + verifică organizationId
  // 2. Preia ShopifyConnection pentru org
  // 3. POST la Shopify Admin API /products.json:
  //    - title, body_html (descriptionHtml), tags, status: 'draft'
  //    - variants: [{ price, compare_at_price }]
  //    - images: [{ src: imageUrl }] pentru fiecare URL din draft.images
  // 4. Actualizează draft: status = PUBLISHED, shopifyProductId = id returnat de Shopify
  // 5. Return { shopifyProductId, shopifyAdminUrl }
}
```

---

## [DEPLASAT] Pasul 22 — UI Pages

**`rise/app/(dashboard)/products/new/page.tsx`** — Generator URL

```
'use client'

Stări UI:
- idle: form cu input URL + câmpuri preț
- scraping: spinner "Se extrag datele din sursă..."
- generating: spinner "Se generează listing-ul AZORA..."
- done: redirect automat la /products/new?draft=<id>
- error: mesaj eroare + buton retry

Form fields:
- URL produs (required)
- Preț vânzare RON (required)
- Preț comparat RON (optional — prețul barat)
```

**`rise/app/(dashboard)/products/new/page.tsx?draft=<id>`** — Draft Editor

```
Server component: citește draft din DB via params.searchParams.draft

Layout:
- Header: breadcrumb + badge status [DRAFT] + buton "Publică în Shopify"
- Secțiunea Titlu: input editabil
- Secțiunea Prețuri: două inputuri (vânzare + comparat)
- Secțiunea Imagini: grid imagini cu X pe fiecare + buton "Adaugă URL"
- Secțiunea Descriere: textarea mare (editabil inline, HTML preview toggle)
- Secțiunea Tags: input tags
- Footer: URL sursă (readonly) + timestamp generare

Salvare automată la blur pe câmpuri (PUT /api/products/drafts/[id])
```

**`rise/app/(dashboard)/products/page.tsx`** — actualizare cu tab Draft-uri

Adaugă tab "Draft-uri (N)" lângă "Toate produsele". Lista draft-urilor cu:
- Titlu + URL sursă
- Status badge
- Butoane rapide: "Editează" → `/products/new?draft=<id>` | "Publică"

**Sidebar** — adaugă link "Produs nou" (`/products/new`) sub "Produse":
```typescript
{ href: '/products/new', label: 'Produs nou', icon: '+', indent: true },
```

---

## [DEPLASAT] Pasul 23 — Fișiere noi Sub-proiect 2B

| Fișier | Acțiune |
|--------|---------|
| `rise/prisma/schema.prisma` | Modifică — adaugă `ProductDraft` + `DraftStatus` enum |
| `rise/features/products/services/listing-generator.ts` | Creat — scrape + Claude generate |
| `rise/app/api/products/drafts/route.ts` | Creat — POST generate, GET list |
| `rise/app/api/products/drafts/[id]/route.ts` | Creat — GET + PUT draft |
| `rise/app/api/products/drafts/[id]/publish/route.ts` | Creat — POST publish în Shopify |
| `rise/app/(dashboard)/products/new/page.tsx` | Creat — URL form + draft editor |
| `rise/features/products/components/DraftEditor.tsx` | Creat — editor inline draft |
| `rise/features/products/components/UrlGeneratorForm.tsx` | Creat — form URL + loading states |
| `rise/features/products/components/DraftList.tsx` | Creat — lista draft-uri |
| `rise/components/layout/Sidebar.tsx` | Modifică — adaugă "Produs nou" |

---

## [DEPLASAT] Verificare Sub-proiect 2B

1. `.env.local` are `FIRECRAWL_API_KEY` + `ANTHROPIC_API_KEY`
2. `npm run db:migrate` — tabelul `ProductDraft` creat
3. `/products/new` — form URL se afișează
4. Pasezi URL Alibaba + preț → spinner → draft generat → redirect la editor
5. Editor: modifici titlu/descriere → salvare automată la blur
6. Apăsă "Publică în Shopify" → produs apare ca draft în Shopify Admin
7. `/products` → tab "Draft-uri" listează draft-urile pending
8. **Test securitate:** POST `/api/products/drafts` fără auth → 401
9. **Test fallback:** dezactivează `FIRECRAWL_API_KEY` → Jina AI preia și generează listing valid

---

---

# Sub-proiect 1B — Cost Structure Refactoring

## Context și motivație

Pe parcursul implementării Sub-proiectului 1, `ProductCostForm` conținea câmpuri care logic aparțin magazinului (store-level), nu produsului individual:

- **`returnRate`** — rata de retur nu variază per produs, ci este un indicator global al magazinului. Mai mult, valoarea corectă trebuie calculată automat din comenzile Shopify (Sub-proiect 3), nu introdusă manual.
- **`packagingCost`** — deși rămâne per produs (variază cu dimensiunea/greutatea), are nevoie de o **valoare implicită la nivel de magazin** care pre-completează produsele noi (pattern "Handling" din Profitario).
- **`incomeTaxType`** și **`shopifyFeeRate`** — existau deja pe modelul `Organization` în Prisma, dar nu erau expuse în UI.

**Inspirație din Profitario** (aplicație Shopify de profitabilitate): separă clar costurile per-produs (COG + Handling per unitate) de costurile la nivel de magazin (Shipping, Taxes, Transaction Fees, Expenses). Rise adoptă același principiu.

---

## Structura finală după refactoring

**Per-produs (`ProductCost`):**

| Câmp | Tip | Note | Status |
|------|-----|------|--------|
| `cogs` | `Float` | Cost of goods — rămâne per produs | ✅ |
| `shippingCost` | `Float` | Transport per unitate — rămâne per produs | ✅ |
| `packagingCost` | `Float` | Ambalare per unitate — rămâne per produs (variază cu dimensiunea) | ✅ |
| `supplierVatDeductible` | `Boolean` | TVA furnizor deductibil — rămâne per produs | ✅ |
| `vatRate` | `Float` | 19% standard / 9% medical+food / 5% cărți — rămâne per produs | ✅ |
| ~~`returnRate`~~ | ~~`Float`~~ | **ELIMINAT din UI** — câmpul rămâne în schema DB momentan; eliminat din `ProductCostForm` | ⚠️ |

> ⚠️ `returnRate` există încă în `ProductCost` schema (nu s-a rulat migrația de drop). Se va elimina în Sub-proiect 3 odată cu sincronizarea comenzilor.

**Store-level (`Organization`) — câmpuri noi adăugate (migrare `20260329111233_add_org_cost_defaults`):**

| Câmp | Tip | Default | Descriere | Status |
|------|-----|---------|-----------|--------|
| `packagingCostDefault` | `Float` | `0` | Pre-completează `packagingCost` la produse noi | ✅ |
| `returnRateDefault` | `Float` | `0.05` | Fallback până la auto-calc din Orders (Sub-proiect 3) | ✅ |
| `shopifyMonthlyFee` | `Float` | `140` | Abonament Shopify lunar (RON) — Basic ~140, Shopify ~280 | ✅ |
| `packagingMonthlyBudget` | `Float` | `0` | Buget lunar cumpărare ambalaje (cutii, folie, bandă) | ✅ |

**Store-level (`Organization`) — câmpuri existente, acum cu UI:**

| Câmp | Tip | Default | Status |
|------|-----|---------|--------|
| `shopifyFeeRate` | `Float` | `0.02` | ✅ UI în Settings |
| `incomeTaxType` | `IncomeTaxType` | `MICRO_1` | ✅ UI în Settings |

---

## Logica `returnRate` — auto-calcul din Orders

Odată ce Sub-proiect 3 sincronizează comenzile Shopify, rata de retur se calculează automat:

- **Retur complet**: comandă anulată după confirmare
- **Retur parțial / colet refuzat**: comandă `fulfilled` + AWB adăugat + ulterior anulată
- **Formula**: `returnRate = returOrders / totalOrders` (per produs dacă există date, altfel `Organization.returnRateDefault`)

Până la sincronizarea comenzilor: se afișează `"—"` în UI cu nota *"se va calcula automat după sincronizarea comenzilor"*, iar calculele de profitabilitate folosesc `returnRateDefault`.

---

## Prisma schema changes

**✅ IMPLEMENTAT** — migrare `20260329111233_add_org_cost_defaults` rulată la 2026-03-29.

```prisma
// Adăugat în modelul Organization:
packagingCostDefault   Float  @default(0)     // RON per produs — pre-completat la produse noi
returnRateDefault      Float  @default(0.05)  // % — până la auto-calcul din comenzi
shopifyMonthlyFee      Float  @default(140)   // RON/lună — abonament Shopify Basic (~29 USD)
packagingMonthlyBudget Float  @default(0)     // RON/lună — buget cumpărare ambalaje

// În modelul ProductCost — returnRate NU a fost eliminat din DB (câmpul există)
// Se va elimina în Sub-proiect 3; în UI este ascuns și înlocuit cu returnRateDefault din org.
```

**Utilizarea cheltuielilor lunare fixe în calcule profitabilitate (Sub-proiect 3):**
- `shopifyMonthlyFee + packagingMonthlyBudget` = overhead lunar fix
- Se împarte la numărul de comenzi din luna curentă → cost overhead per comandă
- Se include în calculul `netProfit` per comandă

---

## API — endpoint

**✅ IMPLEMENTAT** — `rise/app/api/organizations/settings/route.ts`

```typescript
// GET — returnează setările curente
// Response: { shopifyFeeRate, incomeTaxType, packagingCostDefault, returnRateDefault,
//             shopifyMonthlyFee, packagingMonthlyBudget }

// PUT — actualizează setările
// Body: { shopifyFeeRate, incomeTaxType, packagingCostDefault, returnRateDefault,
//         shopifyMonthlyFee, packagingMonthlyBudget }
// Validare Zod: shopifyFeeRate între 0–1, returnRateDefault între 0–1, restul >= 0
// Auth: requireAuth() — organizationId din sesiune
```

---

## Settings page — UI

**✅ IMPLEMENTAT** — `rise/app/(dashboard)/settings/SettingsClient.tsx`

Settings refactorizat în server component (`page.tsx`) + client component (`SettingsClient.tsx`). Cardul **"Configurare Magazin"** conține:

```
┌─────────────────────────────────────────────┐
│ Configurare Magazin                         │
│ Setări de cost aplicabile tuturor produselor│
├─────────────────────────────────────────────┤
│ Tip impozitare         Taxa Shopify %       │
│ [MICRO_1 ▼]           [2.0      ] %        │
│                        Comision per tranzacție
│ Cost ambalare implicit Rată retur implicită │
│ [0.00     ] RON        [5.0     ] %        │
│ Pre-completat produse  Se calc automat...   │
│                                             │
│ ── Cheltuieli lunare fixe ──────────────    │
│ Abonament Shopify      Buget ambalaje       │
│ [140.00   ] RON/lună   [0.00   ] RON/lună  │
│ Basic ~140 · Shopify ~280                   │
│                                 [Salvează]  │
└─────────────────────────────────────────────┘
```

**Dropdown tip impozitare:**
- `MICRO_1` → "Micro 1%"
- `MICRO_3` → "Micro 3%"
- `PROFIT_16` → "Impozit Profit 16%"

---

## ProductCostForm — modificări UI

**Fișier:** `rise/features/products/components/ProductCostForm.tsx`

**Elimină:**
- Slider/input `returnRate` (câmp eliminat din schema)
- Dropdown `incomeTaxType` / Tip impozitare (mutat în Settings)

**Adaugă:**
- Label informativ sub câmpul `packagingCost`: *"Implicit magazin: X.XX RON (din setări magazin)"*
- Secțiune read-only "Rată retur": afișează valoarea calculată din Orders când disponibilă, sau `"{returnRateDefault}% (implicit magazin)"` cu link către Settings

**Păstrează:**
- `cogs`, `shippingCost`, `packagingCost`, `vatRate`, `supplierVatDeductible`

---

## Fișiere modificate — Sub-proiect 1B

| Fișier | Acțiune | Status |
|--------|---------|--------|
| `rise/prisma/schema.prisma` | Adăugat 4 câmpuri noi pe `Organization` | ✅ |
| `rise/prisma/migrations/20260329111233_add_org_cost_defaults/` | Migrare aplicată | ✅ |
| `rise/app/api/organizations/settings/route.ts` | Creat — GET + PUT toate câmpurile | ✅ |
| `rise/app/(dashboard)/settings/page.tsx` | Refactorizat în server component | ✅ |
| `rise/app/(dashboard)/settings/SettingsClient.tsx` | Creat — client component cu toate câmpurile + Shopify UI | ✅ |
| `rise/app/(dashboard)/products/[id]/page.tsx` | Fetch org data + pass `orgSettings` cu toate câmpurile | ✅ |
| `rise/features/products/components/ProductCostForm.tsx` | Eliminat `returnRate` + `incomeTaxType`; `packagingCost` default din org | ✅ |
| `rise/app/api/products/[id]/cost/route.ts` | Eliminat `returnRate` din validarea Zod | ⏳ Pending |
| `returnRate` în `ProductCost` DB schema | Drop coloana | ⏳ Pending — se face în Sub-proiect 3 |

---

## Verificare Sub-proiect 1B

| # | Test | Status |
|---|------|--------|
| 1 | Migrare `20260329111233_add_org_cost_defaults` aplicată — 4 câmpuri noi pe `Organization` | ✅ |
| 2 | `GET /api/organizations/settings` → returnează toate 6 câmpuri inclusiv `shopifyMonthlyFee`, `packagingMonthlyBudget` | ✅ |
| 3 | `PUT /api/organizations/settings` cu body valid → 200 OK, valorile persistate | ✅ |
| 4 | `/settings` → card "Configurare Magazin" cu 4 câmpuri + secțiunea "Cheltuieli lunare fixe" | ✅ |
| 5 | Salvezi valori noi → persistă după refresh | ✅ |
| 6 | `/products/[id]` → `ProductCostForm` nu mai are câmpul `returnRate` | ✅ |
| 7 | `ProductCostForm` pre-completează `packagingCost` cu `packagingCostDefault` din org | ✅ |
| 8 | `npx tsc --noEmit` — fără erori noi (eroarea pre-existentă în `assets/upload/route.ts` ignorată) | ✅ |
| 9 | Eliminat `returnRate` din `ProductCost` DB schema | ⏳ Pending Sub-proiect 3 |
| 10 | `rise/app/api/products/[id]/cost/route.ts` — eliminat `returnRate` din Zod | ⏳ Pending |

---

---

# Sub-proiect 3 — Profitability Dashboard cu Ad Spend

## Context și decizie de design

Scopul: pagina `/products` arată profitabilitatea reală a magazinului — incluzând costurile produselor **și** cheltuielile de publicitate (Meta Ads), cu date din comenzile Shopify reale (nu estimări).

**Decizii cheie:**
- **Sursă comenzi:** Shopify Orders API (sync periodic) → model `Order` + `OrderItem` în Prisma
- **Sursă ad spend:** `CampaignMetrics` deja în schema (din Meta API)
- **Atribuire spend per produs:** proporțional cu revenue-ul produsului din total revenue magazin în perioada selectată
- **Metrica primară per produs:** ROAS necesar = `1 / marja_bruta_%` — nu necesită atribuire, e standardul industrial
- **Metrica secundară:** spend atribuit + net profit per produs (cu Orders reale)
- **Perioadă:** dropdown selectabil (7z / 30z / 90z)

**De ce Orders din Shopify (nu doar CampaignMetrics):**
- `CampaignMetrics.revenue` = revenue atribuit de Meta (attribution window 7-day click) — nu egal cu comenzile reale
- Fără Orders, nu avem unități vândute per produs → nu putem calcula profit real per produs
- Cu Orders avem: revenue per produs, COGS total, profit real, spend atribuit precis

---

## Pasul SP3-1 — Prisma: modele Order + OrderItem

Adaugă în `rise/prisma/schema.prisma`:

```prisma
model Order {
  id           String      @id @default(cuid())
  organizationId String
  shopifyOrderId String
  totalPrice   Decimal
  processedAt  DateTime
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  items        OrderItem[]

  @@unique([organizationId, shopifyOrderId])
  @@index([organizationId])
  @@index([organizationId, processedAt])
}

model OrderItem {
  id         String   @id @default(cuid())
  orderId    String
  productId  String?  // null dacă produsul a fost șters din Shopify
  shopifyProductId String?
  title      String   // snapshot la momentul comenzii
  quantity   Int
  price      Decimal
  createdAt  DateTime @default(now())
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product    Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([productId])
}
```

Adaugă relațiile inverse în modelele existente:

```prisma
// În model Organization:
orders        Order[]

// În model Product:
orderItems    OrderItem[]
```

Rulează: `npm run db:migrate`

---

## Pasul SP3-2 — Shopify Orders Sync

**Fișier:** `rise/src/features/shopify/sync-orders.ts`

```typescript
import { createShopifyClient } from './client'
import { db } from '@/lib/db'

/**
 * Sincronizează comenzile Shopify pentru o organizație.
 * Preia doar comenzile mai noi decât ultima comandă sync-ată (incremental).
 */
export async function syncOrders(orgId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await db.shopifyConnection.findUnique({
    where: { organizationId: orgId },
  })
  if (!connection) throw new Error('No Shopify connection found')

  const client = createShopifyClient(connection.shopDomain, connection.accessTokenEncrypted)

  // Găsește cea mai recentă comandă sync-ată
  const lastOrder = await db.order.findFirst({
    where: { organizationId: orgId },
    orderBy: { processedAt: 'desc' },
    select: { shopifyOrderId: true, processedAt: true },
  })

  const sinceDate = lastOrder?.processedAt
    ? new Date(lastOrder.processedAt.getTime() - 24 * 60 * 60 * 1000) // -1 zi buffer
    : new Date('2024-01-01')

  const orders = await client.getOrders({ sinceDate })
  const errors: string[] = []
  let synced = 0

  for (const order of orders) {
    try {
      await db.$transaction(async (tx) => {
        const created = await tx.order.upsert({
          where: {
            organizationId_shopifyOrderId: {
              organizationId: orgId,
              shopifyOrderId: String(order.id),
            },
          },
          create: {
            organizationId: orgId,
            shopifyOrderId: String(order.id),
            totalPrice: order.total_price,
            processedAt: new Date(order.processed_at),
          },
          update: {
            totalPrice: order.total_price,
            processedAt: new Date(order.processed_at),
          },
        })

        // Upsert order items
        for (const item of order.line_items) {
          // Găsim productId local din shopifyProductId
          const product = item.product_id
            ? await tx.product.findUnique({
                where: {
                  organizationId_shopifyId: {
                    organizationId: orgId,
                    shopifyId: String(item.product_id),
                  },
                },
                select: { id: true },
              })
            : null

          await tx.orderItem.upsert({
            where: {
              // Nu avem @unique pe OrderItem — folosim findFirst + create/update manual
              // Simplificare: delete + recreate items la fiecare order upsert
              id: `${created.id}_${item.id}`,
            },
            create: {
              id: `${created.id}_${item.id}`,
              orderId: created.id,
              productId: product?.id ?? null,
              shopifyProductId: item.product_id ? String(item.product_id) : null,
              title: item.title,
              quantity: item.quantity,
              price: item.price,
            },
            update: {
              productId: product?.id ?? null,
              quantity: item.quantity,
              price: item.price,
            },
          })
        }
      })
      synced++
    } catch (err) {
      errors.push(`Order ${order.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { synced, errors }
}
```

**Actualizează `rise/src/features/shopify/client.ts`** — implementează `getOrders()` (era stub):

```typescript
async getOrders({ sinceDate }: { sinceDate: Date }) {
  const params = new URLSearchParams({
    limit: '250',
    status: 'any',
    processed_at_min: sinceDate.toISOString(),
    fields: 'id,total_price,processed_at,line_items',
  })
  const res = await fetch(`${baseUrl}/orders.json?${params}`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  })
  if (!res.ok) throw new Error(`Shopify Orders API error: ${res.status}`)
  const { orders } = await res.json()
  return orders
}
```

**Scopuri Shopify necesare** — actualizează documentația din Pasul 5:
- Adaugă `read_orders` la lista de scopes necesare în Settings

**API Route:** `rise/src/app/api/shopify/sync-orders/route.ts`
```typescript
// POST: declanșează sync comenzi (similar cu sync-products)
// Returnează { synced, errors } — poate fi apelat manual sau periodic
```

---

## Pasul SP3-3 — API: Date profitabilitate

**Fișier:** `rise/src/app/api/analytics/profitability/route.ts`

```typescript
// GET /api/analytics/profitability?period=30
// Returnează:
// {
//   storeSummary: { totalRevenue, totalSpend, actualRoas, netProfit, period },
//   products: [
//     {
//       id, title, imageUrl, price,
//       unitsSold, revenue, cogs, grossMargin, grossMarginPct,
//       attributedSpend, netProfitWithAds,
//       requiredRoas,  // = 1 / grossMarginPct
//     }
//   ]
// }
```

**Logica de calcul:**

```typescript
// 1. Perioada
const days = parseInt(searchParams.get('period') ?? '30')
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

// 2. Ad spend total din CampaignMetrics
const metricsAgg = await db.campaignMetrics.aggregate({
  where: { campaign: { organizationId: orgId }, date: { gte: since } },
  _sum: { spend: true, revenue: true },
})
const totalSpend = metricsAgg._sum.spend ?? 0
const totalMetaRevenue = metricsAgg._sum.revenue ?? 0 // Meta-attributed (pt. ROAS actual)
const actualRoas = totalSpend > 0 ? totalMetaRevenue / totalSpend : null

// 3. Revenue per produs din Orders reale
const orderItems = await db.orderItem.findMany({
  where: {
    order: { organizationId: orgId, processedAt: { gte: since } },
    productId: { not: null },
  },
  include: { product: { include: { cost: true } } },
})

// 4. Agregare per produs
const productMap = new Map<string, ProductStats>()
for (const item of orderItems) {
  if (!item.product) continue
  const entry = productMap.get(item.productId!) ?? initProductStats(item.product)
  entry.unitsSold += item.quantity
  entry.revenue += Number(item.price) * item.quantity
  productMap.set(item.productId!, entry)
}

// 5. Calcule per produs
const totalRevenue = [...productMap.values()].reduce((s, p) => s + p.revenue, 0)

for (const [, p] of productMap) {
  const cost = p.product.cost
  if (!cost) continue
  const costPerUnit = cost.cogs + cost.shippingCost + cost.packagingCost
  p.cogs = costPerUnit * p.unitsSold
  p.grossMargin = p.revenue - p.cogs
  p.grossMarginPct = p.revenue > 0 ? p.grossMargin / p.revenue : 0
  p.requiredRoas = p.grossMarginPct > 0 ? 1 / p.grossMarginPct : null
  // Spend atribuit proporțional cu revenue
  p.attributedSpend = totalRevenue > 0 ? totalSpend * (p.revenue / totalRevenue) : 0
  p.netProfitWithAds = p.grossMargin - p.attributedSpend
}
```

---

## Pasul SP3-4 — UI: KPI Banner în pagina Produse

**Fișier:** `rise/src/features/products/components/ProfitabilityBanner.tsx`

Banner deasupra tabelului de produse, cu 4 carduri și selector perioadă:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Perioadă: 30 zile ▼]                                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │ Cheltuieli   │  │ Venituri     │  │ ROAS actual  │  │ Profit   ││
│  │ reclame      │  │ atribuite    │  │              │  │ net est. ││
│  │ 1.240 RON    │  │ 5.820 RON    │  │ 4.7×         │  │ ~2.100   ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

- Dropdown: `7 zile / 30 zile / 90 zile` — state local, trimis ca query param la API
- Card ROAS: verde dacă > 2, galben dacă 1-2, roșu dacă < 1
- Card Profit net: verde dacă pozitiv, roșu dacă negativ
- Loading state: skeleton cards (clasa `.skeleton` din globals.css)

---

## Pasul SP3-5 — UI: Coloane noi în tabelul produselor

**Coloane finale:** Produs | Preț | Cost | Marjă | **ROAS necesar** | Status

**Coloana "ROAS necesar":**
- Valoare: `requiredRoas` (ex: `2.38×`)
- Sub-text mic: `"Marjă: 42%"`
- Culoare indicator:
  - Verde: `actualRoas > requiredRoas` → produs profitabil cu reclamele actuale
  - Portocaliu: `actualRoas` în range `[requiredRoas - 0.5, requiredRoas]` → limită
  - Roșu: `actualRoas < requiredRoas - 0.5` → neprofitabil
  - Gri: lipsesc date (fără ProductCost configurat sau fără comenzi în perioadă)

**Tooltip on hover** (opțional Phase 1, adaugă dacă e simplu de implementat):
```
Spend atribuit: 87 RON
Profit net cu ads: +143 RON
Unități vândute: 12
```

**Actualizare `rise/src/app/(dashboard)/products/page.tsx`:**
- Adaugă `ProfitabilityBanner` deasupra `ProductList`
- Pasează `period` ca prop la ambele componente
- Fetch date din `/api/analytics/profitability?period={period}` via React Query

---

## Fișiere noi — Sub-proiect 3

| Fișier | Acțiune |
|--------|---------|
| `rise/prisma/schema.prisma` | Modifică — adaugă `Order`, `OrderItem`, relații inverse |
| `rise/src/features/shopify/sync-orders.ts` | Creat — sync incremental comenzi |
| `rise/src/features/shopify/client.ts` | Modifică — implementează `getOrders()` (era stub) |
| `rise/src/app/api/shopify/sync-orders/route.ts` | Creat — POST trigger sync comenzi |
| `rise/src/app/api/analytics/profitability/route.ts` | Creat — GET date profitabilitate |
| `rise/src/features/products/components/ProfitabilityBanner.tsx` | Creat — KPI banner 4 carduri |
| `rise/src/app/(dashboard)/products/page.tsx` | Modifică — adaugă banner + coloana ROAS necesar |

---

## Verificare Sub-proiect 3

1. `npm run db:migrate` — tabelele `Order`, `OrderItem` create
2. `POST /api/shopify/sync-orders` → sync comenzi reale din Shopify
3. `GET /api/analytics/profitability?period=30` → returnează JSON cu `storeSummary` + `products[]`
4. `/products` → banner cu 4 KPI carduri apare deasupra tabelului
5. Dropdown "30 zile" → schimbă perioada → datele se actualizează
6. Coloana "ROAS necesar" apare în tabel cu culori corecte
7. Produse fără `ProductCost` configurat → coloana arată gri ("—")
8. Produse fără comenzi în perioadă → ROAS necesar afișat, spend 0
9. **Test securitate:** GET `/api/analytics/profitability` fără auth → 401
