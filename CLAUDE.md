@AGENTS.md

# Rise — Platform AI pentru Azora

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase PostgreSQL via Prisma ORM
- **Auth:** NextAuth v5 (Credentials provider, JWT sessions)
- **UI:** shadcn/ui + Tailwind v4
- **State:** React Query (@tanstack/react-query) pentru apeluri client-side
- **Forms:** React Hook Form + Zod
- **Encryption:** AES-256-GCM via `src/lib/crypto.ts`

## Comenzi

```bash
npm run dev          # dev server pe port 3000
npm run build        # build producție
npm run lint         # ESLint
npm run db:migrate   # rulează migrații Prisma (dev)
npm run db:deploy    # aplică migrații (producție)
npm run db:seed      # creează user eusebiu@azora.ro + org Azora
npm run db:studio    # Prisma Studio UI
```

## Structura proiect

```
rise/src/
├── app/
│   ├── (auth)/login/         ← pagina de login
│   ├── (dashboard)/          ← layout cu Sidebar + Header
│   │   ├── layout.tsx
│   │   ├── page.tsx          ← Dashboard overview
│   │   ├── products/         ← lista produse + configurare costuri
│   │   ├── settings/         ← Shopify + Meta integrations
│   │   └── videos/           ← Video creation + library (Sub-proiect 2)
│   ├── api/                  ← API routes
│   └── style-guide/          ← design tokens reference (dev-only)
├── features/                 ← feature-based structure (nu layer-based)
│   ├── auth/helpers.ts       ← getCurrentUser, requireAuth, getCurrentOrgId
│   ├── products/             ← components + hooks
│   └── shopify/              ← client, sync, types
├── components/
│   ├── ui/                   ← shadcn/ui components
│   ├── layout/               ← Sidebar, Header
│   └── common/               ← LoadingSpinner etc.
└── lib/
    ├── db.ts                 ← Prisma singleton
    ├── auth.ts               ← NextAuth config
    ├── crypto.ts             ← encrypt/decrypt AES-256-GCM
    ├── r2.ts                 ← Cloudflare R2 client
    └── hooks/useApiQuery.ts  ← React Query base wrapper (generic)
```

## Patternuri obligatorii

### Multi-tenancy (CRITIC)

**FIECARE query Prisma TREBUIE să includă `where: { organizationId }`** — izolarea tenant este application-layer (nu RLS în Phase 1).

```typescript
// ✅ Corect
const products = await db.product.findMany({
  where: { organizationId },
  include: { cost: true },
})

// ❌ Greșit — lipsă organizationId
const products = await db.product.findMany()
```

### Auth în API routes și Server Components

```typescript
import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'

// În API routes:
const session = await requireAuth()  // redirect /login dacă neautentificat
const orgId = await getCurrentOrgId(session)

// În Server Components:
const session = await requireAuth()
```

### React Query hooks

Hooks stau **în feature folder**, nu în `lib/hooks/`:
```
features/products/hooks/useProducts.ts  ✅
lib/hooks/useProducts.ts               ❌
```

`lib/hooks/useApiQuery.ts` este doar base wrapper generic (React Query + error handling).

### Formulare

```typescript
// React Hook Form + Zod — obligatoriu pentru toate formularele
const schema = z.object({ ... })
const form = useForm({ resolver: zodResolver(schema) })
```

### Token encryption

Tokens Shopify/Meta sunt ENCRYPTED în DB. Folosește întotdeauna:
```typescript
import { encrypt, decrypt } from '@/lib/crypto'
// La salvare: encrypt(plainToken)
// La citire: decrypt(encryptedToken)
```

### Next.js 16 — async APIs

`params`, `searchParams`, `cookies`, `headers`, `draftMode` sunt **async** în Next.js 16:

```typescript
// ✅ Corect
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}

// ❌ Greșit (Next.js 14/15 style)
export default function Page({ params }: { params: { id: string } }) {
  const { id } = params
}
```

### Server Components

Server Components by default. `"use client"` doar când e necesar (interactivitate, hooks React).

### Dimensiune componente

Max 150-200 linii per UI component. Remotion templates sunt excepție.

## Deployment

Dockerfile la `rise/Dockerfile` — builduit cu Dokploy pe Hostinger VPS.
- `output: 'standalone'` în next.config.ts
- `prisma migrate deploy` rulează la startup în CMD

## Deviații intenționate față de spec

| Deviație | Motivație |
|----------|-----------|
| Auth: NextAuth credentials (nu Supabase Auth) | Simplitate Phase 1 single-user |
| Shopify: Custom App token (nu Partner OAuth) | Simplitate Phase 1 single-store — **Phase 2 necesită rebuild** |
| RLS absent | Phase 2. Phase 1 = application-layer filtering Prisma |
| AI Hook Generator absent | Deplasat la Sub-proiect 5 |
| Semantic search (pgvector) absent | Deplasat la Sub-proiect 5. Phase 1 = tags manuale |

## Referință Next.js 16

Citește `node_modules/next/dist/docs/` pentru orice API Next.js 16 înainte de a scrie cod.
