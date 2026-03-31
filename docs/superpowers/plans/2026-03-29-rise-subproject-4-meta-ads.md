# Rise — Sub-proiectul 4: Meta Ads Integration

**Data:** 2026-03-29
**Status:** Plan de implementare
**Autor:** Product Manager + Meta Ads Specialist
**Scope:** Conectare Meta Marketing API, CRUD campanii, sync metrici zilnic, alerte de bază

---

## Cuprins

1. [Overview și obiective](#1-overview-și-obiective)
2. [Decizii de arhitectură](#2-decizii-de-arhitectură)
3. [Setup Meta Developer App](#3-setup-meta-developer-app)
4. [MetaConnection flow — UI Settings](#4-metaconnection-flow--ui-settings)
5. [Schema Prisma extinsă](#5-schema-prisma-extinsă)
6. [Meta API Client](#6-meta-api-client)
7. [Sync campanii și metrici](#7-sync-campanii-și-metrici)
8. [API Routes](#8-api-routes)
9. [UI Pages](#9-ui-pages)
10. [Research piața română](#10-research-piața-română)
11. [Sincronizare automată metrici](#11-sincronizare-automată-metrici)
12. [Sistem de alerte](#12-sistem-de-alerte)
13. [Structura de fișiere completă](#13-structura-de-fișiere-completă)
14. [Checklist verificare](#14-checklist-verificare)
15. [Sugestii de îmbunătățire](#15-sugestii-de-îmbunătățire)

---

## 1. Overview și obiective

### Ce rezolvă Sub-proiectul 4

Rise devine inutilizabil fără date din Meta — utilizatorul nu știe cât a cheltuit, câte vânzări a generat fiecare campanie, sau dacă bugetul e irosit pe campanii nerentabile. Sub-proiectul 4 conectează Rise direct la Meta Marketing API și aduce toate aceste date în interfața platformei.

### Obiective principale

| # | Obiectiv | Rezultat așteptat |
|---|----------|-------------------|
| 1 | **Conectare Meta Ad Account** | Utilizatorul lipește System User token din Settings, Rise validează și stochează criptat |
| 2 | **Sync campanii din Meta** | Campanii existente din Meta apar automat în Rise fără introducere manuală |
| 3 | **Creare campanie din Rise** | Wizard simplu → campanie creată în Meta (status PAUSED, gata de review) |
| 4 | **Metrici zilnice** | spend, impressions, clicks, purchases, ROAS, CPM, CTR — sincronizate zilnic |
| 5 | **Dashboard campanii** | Tabel + grafice per campanie, overview profit vs. spend |
| 6 | **Alerte de bază** | ROAS scăzut, spend depășit, CTR mic — notificări în-app |

### Ce NU face Sub-proiectul 4 (deplasat la Sub-proiect 5 sau 6)

- **Auto-generare ad creative** (text, imagini) — Sub-proiect 5 (AI)
- **Audience builder** (Lookalike, Custom Audiences) — Sub-proiect 5
- **Multi-ad-account** (mai multe magazine) — Sub-proiect 6 (SaaS multi-tenant)
- **Billing Meta / facturat în Rise** — nu intră în scope
- **Facebook Pixel setup** — manual de către utilizator, Rise îl citește doar

### Dependențe față de sub-proiectele anterioare

- **Sub-proiect 1** (Platform Core): `MetaConnection`, `Campaign`, `CampaignMetrics` modele deja în schema Prisma ✓
- **Sub-proiect 1**: `Settings` page cu placeholder "Meta: Neconectat" ✓
- **Sub-proiect 3** (Profitabilitate): calculul `profit_campanie = profit_produs * purchases - spend` refolosește costurile din `ProductCost` — deja disponibil

---

## 2. Decizii de arhitectură

### 2.1 System User Token vs. OAuth flow

**Decizie: System User Token (long-lived), nu OAuth.**

Motivație:
- Rise este single-tenant Phase 1 — un singur utilizator, un singur ad account
- Token-ul personal expiră la 60 de zile și necesită re-autentificare
- System User token nu expiră niciodată — zero întreruperi în sync automat
- OAuth flow (Meta Login) necesită app review dacă app-ul e public — Rise e privat

Consecință: utilizatorul generează manual token-ul din Meta Business Suite și îl lipește în Settings. UI-ul Rise ghidează pas cu pas.

### 2.2 AdSet și Ad — se adaugă în schema Prisma?

**Decizie: DA, dar cu scope redus (Phase 1 = read-only sync, nu create din Rise).**

Argumentare:

**Pro adăugare:**
- Meta returnează metrici la nivel de AdSet și Ad (nu doar Campaign) — fără modele, pierdem granularitate
- Profitabilitatea reală = per ad creative (care ad vizual performează?)
- Structura Campaign → AdSet → Ad este fundamentală în Meta — a o ignora înseamnă a reconstrui modele mai târziu cu migrații costisitoare

**Contra adăugare:**
- Complexity: un ad account cu 10 campanii poate avea 50+ ad sets și 200+ ads
- Phase 1 nu are UI pentru gestiunea Ad/AdSet — ar fi date sincronizate dar neafișate

**Compromis adoptat:**
- Adăugăm `AdSet` și `Ad` cu câmpurile esențiale (ID Meta + metrics snapshot)
- Sync zilnic aduce datele în DB
- UI Phase 1 afișează metrici doar la nivel Campaign (agregat)
- UI Phase 2 poate drilla-down la AdSet/Ad fără migrații schema

### 2.3 Cron job vs. on-demand sync

**Decizie: Vercel Cron Jobs (dacă deploy pe Vercel) sau endpoint `/api/meta/sync` cu un cron extern (cURL din n8n/Dokploy).**

Motivație: Rise este deployat pe Dokploy (VPS Hostinger). Vercel Cron nu e disponibil. Se folosește un endpoint protejat cu `CRON_SECRET` apelat dintr-un cron job al Dokploy-ului (sau n8n dacă e instalat pe același VPS).

### 2.4 Criptare token Meta

Token-ul System User se stochează în `MetaConnection.accessTokenEncrypted` cu AES-256-GCM. Cheia de criptare = `META_TOKEN_ENCRYPTION_KEY` (32 bytes hex) din `.env`. Același pattern ca pentru `ShopifyConnection.accessTokenEncrypted` din Sub-proiect 1.

---

## 3. Setup Meta Developer App

### Pas cu pas — ghid pentru Azora.ro

Această secțiune este ghidul complet pe care utilizatorul îl urmează o singură dată, la conectarea inițială. Rise afișează acest ghid in-app (collapsible în Settings page).

---

#### 3.1 Creare Meta Developer App

1. Accesează [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Alege tipul: **Business**
3. Completează:
   - **App Name**: `Azora Rise` (sau orice denumire internă)
   - **App Contact Email**: emailul tău de business
   - **Business Account**: selectează contul Azora din Business Suite
4. Click **Create App**
5. În dashboard-ul aplicației → **Add Products** → caută **Marketing API** → click **Set Up**
6. Notează **App ID** și **App Secret** (Settings → Basic) — nu sunt necesare pentru System User flow, dar utile pentru debug

**Rezultat**: App creat cu Marketing API activat.

---

#### 3.2 Creare System User în Business Suite

1. Accesează [business.facebook.com/settings](https://business.facebook.com/settings)
2. Coloana stângă → **Users** → **System Users** → **Add**
3. Completează:
   - **System User Name**: `azora-rise-system`
   - **System User Role**: **Admin** (necesar pentru creare campanii)
4. Click **Create System User**

**De ce Admin și nu Employee?**
Employee System User nu poate crea sau modifica campanii — poate doar citi. Rise are nevoie să creeze campanii (Sub-proiect 4) și eventual să publisheze creative-uri (Sub-proiect 5).

---

#### 3.3 Acordare acces la Ad Account

1. În Business Settings → **Accounts** → **Ad Accounts**
2. Selectează ad account-ul Azora → **Assign Partners** sau **Add People**
3. Selectează System User-ul creat (`azora-rise-system`)
4. Bifează: **Manage campaigns**, **View performance**, **Manage creative**
5. Salvează

**De ce Full Control?**
Granularitatea permisiunilor Meta la nivel de System User este limitată. "Full Control" este echivalentul "Admin" pe ad account și include toate operațiunile de care Rise are nevoie.

---

#### 3.4 Generare token System User

1. Business Settings → **System Users** → selectează `azora-rise-system`
2. Click **Generate New Token**
3. Selectează aplicația creată (`Azora Rise`)
4. Bifează permisiunile necesare:
   - ✅ `ads_management` — creare/editare campanii, ad sets, ads
   - ✅ `ads_read` — citire campanii și metrici
   - ✅ `pages_read_engagement` — citire pagini Facebook
   - ✅ `pages_manage_ads` — publicare ads pe pagini
   - ✅ `read_insights` — acces la Insights API (metrici detaliate)
5. **Expiry**: selectează **Never** (System User tokens pot fi permanent)
6. Click **Generate Token**
7. **Copiază token-ul imediat** — nu va mai fi afișat după ce închizi fereastra

**IMPORTANT**: Token-ul este echivalentul parolei tale Meta. Nu îl posta pe GitHub, Discord sau în email. Rise îl criptează AES-256-GCM înainte de stocare în DB.

---

#### 3.5 Găsire Ad Account ID și Page ID

**Ad Account ID:**
1. [business.facebook.com/adsmanager](https://business.facebook.com/adsmanager)
2. URL conține `act_XXXXXXXXX` — acesta este Ad Account ID-ul
3. Alternativ: Meta Business Suite → Settings → Ad Accounts → ID afișat

**Page ID (Facebook Page):**
1. Accesează pagina ta de Facebook (ex: facebook.com/azora.ro)
2. About → Page ID (afișat în secțiunea "More Info")
3. Alternativ: Graph API Explorer → `GET /me/accounts` → caută pagina dorită

**Pixel ID (opțional pentru Phase 1):**
1. Events Manager → caută pixelul asociat domeniului azora.ro
2. ID afișat în listă (format: număr de 16 cifre)

---

#### 3.6 Testare conexiune înainte de configurare Rise

```bash
# Înlocuiește TOKEN și ACT_ID cu valorile tale
curl -X GET \
  "https://graph.facebook.com/v21.0/act_XXXXXXXXX/campaigns?fields=id,name,status&access_token=TOKEN"
```

Răspuns așteptat: JSON cu lista campaniilor existente. Dacă primești `error: Invalid OAuth access token`, token-ul nu e valid.

---

## 4. MetaConnection flow — UI Settings

### 4.1 State machine conexiune

```
DISCONNECTED → [user pastes token] → VALIDATING → CONNECTED
                                                  ↓ (token invalid)
                                              VALIDATION_ERROR
```

### 4.2 Settings Page — secțiunea Meta

**Fișier:** `rise/src/features/meta/components/MetaConnectionCard.tsx`

```tsx
// MetaConnectionCard — afișat în /settings
// State: connected | disconnected | validating | error

interface MetaConnectionCardProps {
  connection: MetaConnection | null;
}

// Dacă connection = null → formular conectare
// Dacă connection exists → status card cu buton Disconnect
```

**UI când e deconectat:**

```
┌─────────────────────────────────────────────────────────┐
│  Meta Ads                                    [!] Neconectat │
│                                                            │
│  Conectează contul Meta pentru a sincroniza campanii       │
│  și metrici de performanță.                                │
│                                                            │
│  [▼ Cum obții token-ul System User? ]                      │
│                                                            │
│  System User Token *                                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Lipește token-ul aici...                             │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Ad Account ID *          Facebook Page ID (opțional)     │
│  ┌──────────────────┐     ┌──────────────────────────────┐ │
│  │ act_123456789    │     │ 123456789012345              │ │
│  └──────────────────┘     └──────────────────────────────┘ │
│                                                            │
│  Pixel ID (opțional)                                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 1234567890123456                                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│                              [Conectează Meta]             │
└─────────────────────────────────────────────────────────┘
```

**UI când e conectat:**

```
┌─────────────────────────────────────────────────────────┐
│  Meta Ads                                   ✓ Conectat   │
│                                                          │
│  Ad Account: act_123456789                               │
│  Pagină: Azora.ro (ID: 123456789012345)                  │
│  Pixel: 1234567890123456                                 │
│  Ultima sincronizare: Azi, 06:00                         │
│                                                          │
│  [Sincronizează acum]        [Deconectează]              │
└─────────────────────────────────────────────────────────┘
```

### 4.3 API Route — POST /api/meta/connect

```typescript
// rise/src/app/api/meta/connect/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/features/auth/helpers";
import { validateMetaToken } from "@/features/meta/client";
import { encryptToken } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { organizationId } = await requireAuth();
  const { accessToken, adAccountId, pageId, pixelId } = await req.json();

  // Validare format Ad Account ID
  if (!adAccountId.startsWith("act_")) {
    return NextResponse.json(
      { error: "Ad Account ID trebuie să înceapă cu 'act_'" },
      { status: 400 }
    );
  }

  // Validare token cu Meta API (call real)
  const validation = await validateMetaToken(accessToken, adAccountId);
  if (!validation.valid) {
    return NextResponse.json(
      { error: `Token invalid: ${validation.reason}` },
      { status: 400 }
    );
  }

  // Criptare + upsert
  const accessTokenEncrypted = encryptToken(accessToken);

  await prisma.metaConnection.upsert({
    where: { organizationId },
    create: {
      organizationId,
      adAccountId,
      pageId: pageId || null,
      pixelId: pixelId || null,
      accessTokenEncrypted,
    },
    update: {
      adAccountId,
      pageId: pageId || null,
      pixelId: pixelId || null,
      accessTokenEncrypted,
    },
  });

  // Trigger sync inițial (campanii existente)
  // Fire-and-forget — nu blochează răspunsul
  syncCampaignsFromMeta(organizationId).catch(console.error);

  return NextResponse.json({ success: true, adAccountId });
}
```

### 4.4 DELETE /api/meta/connect — Deconectare

```typescript
export async function DELETE(req: NextRequest) {
  const { organizationId } = await requireAuth();

  await prisma.metaConnection.delete({
    where: { organizationId },
  });

  return NextResponse.json({ success: true });
}
```

---

## 5. Schema Prisma extinsă

### 5.1 Modele noi: AdSet și Ad

```prisma
// rise/prisma/schema.prisma
// Adăugate în Sub-proiectul 4

model AdSet {
  id              String   @id @default(cuid())
  organizationId  String
  campaignId      String
  metaAdSetId     String   @unique  // ID-ul real din Meta
  name            String
  status          String           // ACTIVE | PAUSED | DELETED
  dailyBudget     Float?           // în RON (dacă budget e la ad set level)
  targeting       Json?            // snapshot targeting din Meta (read-only)
  bidStrategy     String?          // LOWEST_COST_WITHOUT_CAP | COST_CAP etc.
  startTime       DateTime?
  stopTime        DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  ads             Ad[]
  metrics         AdSetMetrics[]

  @@index([campaignId])
  @@index([organizationId])
}

model Ad {
  id              String   @id @default(cuid())
  organizationId  String
  adSetId         String
  metaAdId        String   @unique  // ID-ul real din Meta
  name            String
  status          String           // ACTIVE | PAUSED | DELETED | DISAPPROVED
  creativeType    String?          // IMAGE | VIDEO | CAROUSEL
  creativeUrl     String?          // URL preview thumbnail
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  adSet           AdSet    @relation(fields: [adSetId], references: [id], onDelete: Cascade)
  metrics         AdMetrics[]

  @@index([adSetId])
  @@index([organizationId])
}

model AdSetMetrics {
  id           String   @id @default(cuid())
  adSetId      String
  date         DateTime @db.Date
  spend        Float    @default(0)
  impressions  Int      @default(0)
  clicks       Int      @default(0)
  purchases    Int      @default(0)
  roas         Float?
  cpm          Float?
  ctr          Float?

  adSet        AdSet    @relation(fields: [adSetId], references: [id], onDelete: Cascade)

  @@unique([adSetId, date])
  @@index([adSetId])
}

model AdMetrics {
  id           String   @id @default(cuid())
  adId         String
  date         DateTime @db.Date
  spend        Float    @default(0)
  impressions  Int      @default(0)
  clicks       Int      @default(0)
  purchases    Int      @default(0)
  roas         Float?
  cpm          Float?
  ctr          Float?

  ad           Ad       @relation(fields: [adId], references: [id], onDelete: Cascade)

  @@unique([adId, date])
  @@index([adId])
}
```

### 5.2 Extindere model Campaign existent

```prisma
// Adăugări la modelul Campaign existent
model Campaign {
  // ... câmpuri existente ...

  // Nou în Sub-proiect 4:
  adSets      AdSet[]
  alerts      CampaignAlert[]
  lastSyncAt  DateTime?    // ultima dată sincronizat cu Meta
}
```

### 5.3 Model Alert

```prisma
model CampaignAlert {
  id             String      @id @default(cuid())
  organizationId String
  campaignId     String
  type           AlertType
  message        String
  isRead         Boolean     @default(false)
  isResolved     Boolean     @default(false)
  triggeredAt    DateTime    @default(now())
  resolvedAt     DateTime?
  metadata       Json?       // { roas: 0.8, threshold: 1.5, daysBelow: 3 }

  campaign       Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([organizationId, isRead])
  @@index([campaignId])
}

enum AlertType {
  ROAS_LOW           // ROAS sub threshold timp de N zile
  SPEND_EXCEEDED     // spend zilnic > budget * 1.1
  CTR_LOW            // CTR sub 0.8% după 1000 impresii
  CPM_HIGH           // CPM > 40 RON
  AUTO_PAUSED        // campanie oprită automat (ROAS < 0.8 pentru 5 zile)
  LEARNING_PHASE     // campanie în learning phase (< 50 conversii/săpt)
  BUDGET_ENDING      // buget aproape epuizat (< 20% rămas)
}
```

### 5.4 Migrație Prisma

```bash
cd rise
npx prisma migrate dev --name add-adset-ad-alerts
npx prisma generate
```

---

## 6. Meta API Client

### 6.1 Client principal

```typescript
// rise/src/features/meta/client.ts

const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  objective: string;
  daily_budget?: string;  // Meta returnează string (în cenți/bani)
  start_time?: string;    // ISO 8601
  stop_time?: string;
  created_time: string;
}

export interface MetaAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  daily_budget?: string;
  targeting?: object;
  bid_strategy?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAd {
  id: string;
  adset_id: string;
  name: string;
  status: string;
  creative?: {
    id: string;
    thumbnail_url?: string;
  };
}

export interface MetaInsights {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

export interface TokenValidation {
  valid: boolean;
  reason?: string;
  adAccountName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMetaBudget(budgetStr?: string): number {
  // Meta returnează bugetul în moneda contului, înmulțit cu 100 (cenți)
  // act_RO: RON × 100 → împărțim la 100
  if (!budgetStr) return 0;
  return parseInt(budgetStr, 10) / 100;
}

function parsePurchases(insights: MetaInsights): number {
  const purchaseAction = insights.actions?.find(
    (a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return purchaseAction ? parseInt(purchaseAction.value, 10) : 0;
}

function parsePurchaseValue(insights: MetaInsights): number {
  const purchaseValue = insights.action_values?.find(
    (a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return purchaseValue ? parseFloat(purchaseValue.value) : 0;
}

async function metaFetch<T>(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${META_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API Error ${data.error.code}: ${data.error.message}`);
  }

  return data as T;
}

// ─── Validare token ───────────────────────────────────────────────────────────

export async function validateMetaToken(
  accessToken: string,
  adAccountId: string
): Promise<TokenValidation> {
  try {
    // Testăm că token-ul are acces la ad account-ul specificat
    const data = await metaFetch<{ id: string; name: string; currency: string }>(
      adAccountId,
      accessToken,
      { fields: "id,name,currency,account_status" }
    );

    // account_status: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_REVIEW
    return {
      valid: true,
      adAccountName: data.name,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "Token invalid sau lipsă acces",
    };
  }
}

// ─── Campanii ─────────────────────────────────────────────────────────────────

export async function fetchCampaigns(
  accessToken: string,
  adAccountId: string
): Promise<MetaCampaign[]> {
  const fields = "id,name,status,objective,daily_budget,start_time,stop_time,created_time";
  const data = await metaFetch<{ data: MetaCampaign[] }>(
    `${adAccountId}/campaigns`,
    accessToken,
    {
      fields,
      limit: "500",
      // Excludem campaniile șterse (opțional, poți include cu filtering)
      effective_status: '["ACTIVE","PAUSED","ARCHIVED"]',
    }
  );
  return data.data;
}

export async function createCampaign(
  accessToken: string,
  adAccountId: string,
  params: {
    name: string;
    objective: string;
    dailyBudget: number;  // în RON
    startDate?: string;   // YYYY-MM-DD
    endDate?: string;
  }
): Promise<{ id: string }> {
  const url = new URL(`${META_API_BASE}/${adAccountId}/campaigns`);
  url.searchParams.set("access_token", accessToken);

  const body = new URLSearchParams({
    name: params.name,
    objective: params.objective,
    status: "PAUSED",  // ÎNTOTDEAUNA PAUSED la creare — utilizatorul activează manual
    daily_budget: String(Math.round(params.dailyBudget * 100)),  // RON → cenți
    special_ad_categories: "[]",
  });

  if (params.startDate) {
    body.set("start_time", new Date(params.startDate).toISOString());
  }
  if (params.endDate) {
    body.set("stop_time", new Date(params.endDate).toISOString());
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    body,
  });
  const data = await response.json();

  if (data.error) {
    throw new Error(`Eroare creare campanie: ${data.error.message}`);
  }

  return { id: data.id };
}

export async function updateCampaignStatus(
  accessToken: string,
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED" | "DELETED"
): Promise<void> {
  const url = new URL(`${META_API_BASE}/${metaCampaignId}`);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams({ status }),
  });
  const data = await response.json();

  if (data.error) {
    throw new Error(`Eroare update status: ${data.error.message}`);
  }
}

export async function updateCampaignBudget(
  accessToken: string,
  metaCampaignId: string,
  dailyBudget: number  // în RON
): Promise<void> {
  const url = new URL(`${META_API_BASE}/${metaCampaignId}`);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams({
      daily_budget: String(Math.round(dailyBudget * 100)),
    }),
  });
  const data = await response.json();

  if (data.error) {
    throw new Error(`Eroare update buget: ${data.error.message}`);
  }
}

// ─── AdSets ───────────────────────────────────────────────────────────────────

export async function fetchAdSets(
  accessToken: string,
  campaignId: string
): Promise<MetaAdSet[]> {
  const fields = "id,campaign_id,name,status,daily_budget,targeting,bid_strategy,start_time,stop_time";
  const data = await metaFetch<{ data: MetaAdSet[] }>(
    `${campaignId}/adsets`,
    accessToken,
    { fields, limit: "200" }
  );
  return data.data;
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

export async function fetchAds(
  accessToken: string,
  adSetId: string
): Promise<MetaAd[]> {
  const fields = "id,adset_id,name,status,creative{thumbnail_url}";
  const data = await metaFetch<{ data: MetaAd[] }>(
    `${adSetId}/ads`,
    accessToken,
    { fields, limit: "200" }
  );
  return data.data;
}

// ─── Insights (metrici) ───────────────────────────────────────────────────────

export async function fetchCampaignInsights(
  accessToken: string,
  adAccountId: string,
  dateFrom: string,  // YYYY-MM-DD
  dateTo: string,    // YYYY-MM-DD
  level: "campaign" | "adset" | "ad" = "campaign"
): Promise<MetaInsights[]> {
  const fields = [
    "campaign_id",
    "adset_id",
    "ad_id",
    "date_start",
    "date_stop",
    "spend",
    "impressions",
    "clicks",
    "cpm",
    "ctr",
    "actions",
    "action_values",
  ].join(",");

  const data = await metaFetch<{ data: MetaInsights[] }>(
    `${adAccountId}/insights`,
    accessToken,
    {
      fields,
      level,
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: "1",  // metrici zilnice (nu aggregate)
      limit: "2000",
    }
  );

  return data.data;
}

// ─── Funcție utilă: metrici agregate pentru o campanie (ultimele N zile) ──────

export async function fetchCampaignMetricsSummary(
  accessToken: string,
  metaCampaignId: string,
  days: number = 30
): Promise<{
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  avgRoas: number;
  avgCpm: number;
  avgCtr: number;
}> {
  const dateTo = new Date().toISOString().split("T")[0];
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const fields = "spend,impressions,clicks,cpm,ctr,actions,action_values";

  const data = await metaFetch<{ data: MetaInsights[] }>(
    `${metaCampaignId}/insights`,
    accessToken,
    {
      fields,
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      // Fără time_increment = aggregate pentru tot intervalul
      limit: "1",
    }
  );

  const insight = data.data[0];
  if (!insight) {
    return {
      totalSpend: 0, totalImpressions: 0, totalClicks: 0,
      totalPurchases: 0, avgRoas: 0, avgCpm: 0, avgCtr: 0,
    };
  }

  const spend = parseFloat(insight.spend || "0");
  const purchases = parsePurchases(insight);
  const revenue = parsePurchaseValue(insight);
  const roas = spend > 0 ? revenue / spend : 0;

  return {
    totalSpend: spend,
    totalImpressions: parseInt(insight.impressions || "0", 10),
    totalClicks: parseInt(insight.clicks || "0", 10),
    totalPurchases: purchases,
    avgRoas: roas,
    avgCpm: parseFloat(insight.cpm || "0"),
    avgCtr: parseFloat(insight.ctr || "0"),
  };
}
```

---

## 7. Sync campanii și metrici

### 7.1 Sync campanii (upsert în DB)

```typescript
// rise/src/features/meta/campaigns-sync.ts

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import {
  fetchCampaigns,
  fetchAdSets,
  fetchAds,
  fetchCampaignInsights,
  MetaInsights,
} from "./client";

// ─── Sync complet: campanii + ad sets + ads + metrici ─────────────────────────

export async function syncCampaignsFromMeta(organizationId: string): Promise<{
  campaignsSynced: number;
  adSetsSynced: number;
  adsSynced: number;
  error?: string;
}> {
  // 1. Obține conexiunea Meta pentru organizație
  const connection = await prisma.metaConnection.findUnique({
    where: { organizationId },
  });

  if (!connection) {
    throw new Error("Meta connection not found for organizationId: " + organizationId);
  }

  const accessToken = decryptToken(connection.accessTokenEncrypted);
  const adAccountId = connection.adAccountId;

  try {
    // 2. Fetch campanii din Meta
    const metaCampaigns = await fetchCampaigns(accessToken, adAccountId);

    let adSetsSynced = 0;
    let adsSynced = 0;

    // 3. Upsert campanii în DB
    for (const mc of metaCampaigns) {
      const campaign = await prisma.campaign.upsert({
        where: {
          // Folosim metaCampaignId ca identifier unic
          metaCampaignId: mc.id,
        },
        create: {
          organizationId,
          metaCampaignId: mc.id,
          name: mc.name,
          status: mapMetaStatus(mc.status),
          budget: parseMetaBudget(mc.daily_budget),
          objective: mc.objective,
          startDate: mc.start_time ? new Date(mc.start_time) : null,
          endDate: mc.stop_time ? new Date(mc.stop_time) : null,
          lastSyncAt: new Date(),
        },
        update: {
          name: mc.name,
          status: mapMetaStatus(mc.status),
          budget: parseMetaBudget(mc.daily_budget),
          startDate: mc.start_time ? new Date(mc.start_time) : null,
          endDate: mc.stop_time ? new Date(mc.stop_time) : null,
          lastSyncAt: new Date(),
        },
      });

      // 4. Fetch + upsert AdSets pentru fiecare campanie
      const metaAdSets = await fetchAdSets(accessToken, mc.id);
      for (const mas of metaAdSets) {
        const adSet = await prisma.adSet.upsert({
          where: { metaAdSetId: mas.id },
          create: {
            organizationId,
            campaignId: campaign.id,
            metaAdSetId: mas.id,
            name: mas.name,
            status: mas.status,
            dailyBudget: parseMetaBudget(mas.daily_budget),
            targeting: mas.targeting ?? undefined,
            bidStrategy: mas.bid_strategy ?? null,
            startTime: mas.start_time ? new Date(mas.start_time) : null,
            stopTime: mas.stop_time ? new Date(mas.stop_time) : null,
          },
          update: {
            name: mas.name,
            status: mas.status,
            dailyBudget: parseMetaBudget(mas.daily_budget),
            targeting: mas.targeting ?? undefined,
          },
        });
        adSetsSynced++;

        // 5. Fetch + upsert Ads pentru fiecare AdSet
        const metaAds = await fetchAds(accessToken, mas.id);
        for (const ma of metaAds) {
          await prisma.ad.upsert({
            where: { metaAdId: ma.id },
            create: {
              organizationId,
              adSetId: adSet.id,
              metaAdId: ma.id,
              name: ma.name,
              status: ma.status,
              creativeType: null,
              creativeUrl: ma.creative?.thumbnail_url ?? null,
            },
            update: {
              name: ma.name,
              status: ma.status,
              creativeUrl: ma.creative?.thumbnail_url ?? null,
            },
          });
          adsSynced++;
        }
      }
    }

    return {
      campaignsSynced: metaCampaigns.length,
      adSetsSynced,
      adsSynced,
    };
  } catch (error) {
    console.error("[Meta Sync] Error:", error);
    return {
      campaignsSynced: 0,
      adSetsSynced: 0,
      adsSynced: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── Sync metrici zilnice ─────────────────────────────────────────────────────

export async function syncDailyMetrics(
  organizationId: string,
  date?: string  // YYYY-MM-DD, default = ieri
): Promise<{ metricsUpserted: number; error?: string }> {
  const targetDate = date ?? getYesterday();

  const connection = await prisma.metaConnection.findUnique({
    where: { organizationId },
  });
  if (!connection) throw new Error("No Meta connection");

  const accessToken = decryptToken(connection.accessTokenEncrypted);

  // Fetch metrici la nivel campaign (zilnic)
  const insights = await fetchCampaignInsights(
    accessToken,
    connection.adAccountId,
    targetDate,
    targetDate,
    "campaign"
  );

  let metricsUpserted = 0;

  for (const insight of insights) {
    if (!insight.campaign_id) continue;

    // Găsim campania locală după metaCampaignId
    const campaign = await prisma.campaign.findFirst({
      where: { organizationId, metaCampaignId: insight.campaign_id },
    });
    if (!campaign) continue;

    const spend = parseFloat(insight.spend || "0");
    const purchases = parsePurchasesFromInsight(insight);
    const purchaseValue = parsePurchaseValueFromInsight(insight);
    const impressions = parseInt(insight.impressions || "0", 10);
    const clicks = parseInt(insight.clicks || "0", 10);
    const cpm = parseFloat(insight.cpm || "0");
    const ctr = parseFloat(insight.ctr || "0");
    const roas = spend > 0 ? purchaseValue / spend : null;

    await prisma.campaignMetrics.upsert({
      where: {
        campaignId_date: {
          campaignId: campaign.id,
          date: new Date(targetDate),
        },
      },
      create: {
        campaignId: campaign.id,
        date: new Date(targetDate),
        spend,
        impressions,
        clicks,
        purchases,
        roas,
        cpm,
        ctr,
      },
      update: { spend, impressions, clicks, purchases, roas, cpm, ctr },
    });

    metricsUpserted++;
  }

  return { metricsUpserted };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapMetaStatus(status: string): "ACTIVE" | "PAUSED" | "COMPLETED" | "DRAFT" {
  switch (status) {
    case "ACTIVE": return "ACTIVE";
    case "PAUSED": return "PAUSED";
    case "ARCHIVED":
    case "DELETED": return "COMPLETED";
    default: return "DRAFT";
  }
}

function parseMetaBudget(budgetStr?: string): number {
  if (!budgetStr) return 0;
  return parseInt(budgetStr, 10) / 100;
}

function parsePurchasesFromInsight(insight: MetaInsights): number {
  const action = insight.actions?.find(
    (a) => a.action_type === "purchase" ||
           a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return action ? parseInt(action.value, 10) : 0;
}

function parsePurchaseValueFromInsight(insight: MetaInsights): number {
  const actionValue = insight.action_values?.find(
    (a) => a.action_type === "purchase" ||
           a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return actionValue ? parseFloat(actionValue.value) : 0;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
```

---

## 8. API Routes

### 8.1 Structura completă routes Meta

```
rise/src/app/api/
├── meta/
│   ├── connect/
│   │   └── route.ts          POST: conectare, DELETE: deconectare
│   ├── sync/
│   │   └── route.ts          POST: trigger sync manual
│   ├── sync-metrics/
│   │   └── route.ts          POST: sync metrici (apelat de cron)
│   └── campaigns/
│       ├── route.ts          GET: list, POST: creare
│       └── [id]/
│           ├── route.ts      GET: detalii, PATCH: update, DELETE: ștergere
│           ├── metrics/
│           │   └── route.ts  GET: metrici cu filtru dată
│           └── pause/
│               └── route.ts  POST: PAUSED în Meta
```

### 8.2 GET /api/meta/campaigns

```typescript
// rise/src/app/api/meta/campaigns/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/features/auth/helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { organizationId } = await requireAuth();

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId },
    include: {
      metrics: {
        orderBy: { date: "desc" },
        take: 30,  // ultimele 30 zile de metrici
      },
      _count: { select: { adSets: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Calculăm metrici agregate pentru fiecare campanie
  const enriched = campaigns.map((campaign) => {
    const totalSpend = campaign.metrics.reduce((sum, m) => sum + m.spend, 0);
    const totalPurchases = campaign.metrics.reduce((sum, m) => sum + m.purchases, 0);
    const latestRoas = campaign.metrics[0]?.roas ?? null;
    const avgRoas = campaign.metrics.length > 0
      ? campaign.metrics.reduce((sum, m) => sum + (m.roas ?? 0), 0) / campaign.metrics.length
      : null;

    return {
      ...campaign,
      summary: {
        totalSpend,
        totalPurchases,
        latestRoas,
        avgRoas,
        adSetsCount: campaign._count.adSets,
      },
    };
  });

  return NextResponse.json({ campaigns: enriched });
}

export async function POST(req: NextRequest) {
  const { organizationId } = await requireAuth();
  const body = await req.json();

  const { name, objective, dailyBudget, startDate, endDate } = body;

  // Validare input
  if (!name || !objective || !dailyBudget) {
    return NextResponse.json(
      { error: "Câmpuri obligatorii: name, objective, dailyBudget" },
      { status: 400 }
    );
  }

  // Obține conexiunea Meta
  const connection = await prisma.metaConnection.findUnique({
    where: { organizationId },
  });
  if (!connection) {
    return NextResponse.json(
      { error: "Meta neconectat. Configurează conexiunea în Settings." },
      { status: 400 }
    );
  }

  const { decryptToken } = await import("@/lib/encryption");
  const { createCampaign } = await import("@/features/meta/client");
  const accessToken = decryptToken(connection.accessTokenEncrypted);

  // Creare campanie în Meta (status PAUSED)
  const { id: metaCampaignId } = await createCampaign(
    accessToken,
    connection.adAccountId,
    { name, objective, dailyBudget, startDate, endDate }
  );

  // Salvare în Rise DB
  const campaign = await prisma.campaign.create({
    data: {
      organizationId,
      metaCampaignId,
      name,
      objective,
      budget: dailyBudget,
      status: "PAUSED",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
```

### 8.3 PATCH /api/meta/campaigns/[id]

```typescript
// rise/src/app/api/meta/campaigns/[id]/route.ts

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { organizationId } = await requireAuth();
  const { status, dailyBudget, name } = await req.json();

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, organizationId },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!campaign.metaCampaignId) {
    return NextResponse.json({ error: "Campanie fără ID Meta" }, { status: 400 });
  }

  const connection = await prisma.metaConnection.findUnique({
    where: { organizationId },
  });
  const accessToken = decryptToken(connection!.accessTokenEncrypted);

  // Propagă modificările în Meta
  if (status) {
    await updateCampaignStatus(accessToken, campaign.metaCampaignId, status);
  }
  if (dailyBudget) {
    await updateCampaignBudget(accessToken, campaign.metaCampaignId, dailyBudget);
  }

  // Actualizează în DB
  const updated = await prisma.campaign.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(dailyBudget && { budget: dailyBudget }),
      ...(name && { name }),
    },
  });

  return NextResponse.json({ campaign: updated });
}
```

### 8.4 POST /api/meta/sync — sync manual

```typescript
// rise/src/app/api/meta/sync/route.ts

import { syncCampaignsFromMeta } from "@/features/meta/campaigns-sync";

export async function POST(req: NextRequest) {
  const { organizationId } = await requireAuth();

  const result = await syncCampaignsFromMeta(organizationId);

  return NextResponse.json({
    success: true,
    ...result,
    syncedAt: new Date().toISOString(),
  });
}
```

### 8.5 POST /api/meta/sync-metrics — cron endpoint

```typescript
// rise/src/app/api/meta/sync-metrics/route.ts
// Protejat cu CRON_SECRET — nu necesită sesiune NextAuth

import { syncDailyMetrics } from "@/features/meta/campaigns-sync";
import { checkAlertsForOrganization } from "@/features/meta/alerts";

export async function POST(req: NextRequest) {
  // Validare cron secret
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { organizationId, date } = body;

  // Dacă nu se specifică organizationId, sync pentru toate organizațiile
  const orgIds = organizationId
    ? [organizationId]
    : await prisma.metaConnection.findMany({ select: { organizationId: true } })
        .then((conns) => conns.map((c) => c.organizationId));

  const results = [];
  for (const orgId of orgIds) {
    const result = await syncDailyMetrics(orgId, date);
    // Verifică alerte după sync
    await checkAlertsForOrganization(orgId);
    results.push({ organizationId: orgId, ...result });
  }

  return NextResponse.json({ success: true, results });
}
```

---

## 9. UI Pages

### 9.1 /campaigns — Lista campanii

**Fișier:** `rise/src/app/(dashboard)/campaigns/page.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Campanii Meta Ads                                [+ Campanie nouă]      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 🔴 Alertă: "EP-2011 LED - Vanzari" are ROAS = 0.9 (3 zile)  [x]  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Filtre: [Toate ▼]  [Perioadă: 30 zile ▼]           [Sincronizează]     │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Campanie               Status    Buget/zi  Spend   ROAS   Achiziții  │ │
│  ├──────────────────────────────────────────────────────────────────────┤ │
│  │ EP-2011 - Vanzari...  ● ACTIV    50 RON   847 RON  3.2x   12        │ │
│  │ Cadou Ursulet - Conv  ○ PAUZAT   30 RON   0 RON    -      0         │ │
│  │ Azora - Retargeting   ● ACTIV    25 RON   312 RON  4.8x   7         │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Total cheltuieli (30 zile): 1.159 RON  |  Total achiziții: 19          │
│  ROAS mediu: 3.7x  |  CPA mediu: 61 RON                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Componente necesare:**

```
rise/src/features/meta/components/
├── CampaignsTable.tsx       ← tabel cu sorting + filtering
├── CampaignStatusBadge.tsx  ← badge colorat ACTIV/PAUZAT/DRAFT
├── RoasBadge.tsx            ← badge ROAS cu culoare (roșu < 1.5, verde > 3)
├── MetaAlertBanner.tsx      ← banner alertă fixat sus
├── CampaignsSummaryBar.tsx  ← totaluri la baza paginii
└── SyncButton.tsx           ← buton sync cu loading state
```

**Hook React Query:**

```typescript
// rise/src/features/meta/hooks/useCampaigns.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/meta/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,  // 5 minute cache
  });
}

export function useSyncCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; dailyBudget?: number }) => {
      const res = await fetch(`/api/meta/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
```

### 9.2 /campaigns/[id] — Detalii campanie + grafice

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Înapoi  |  EP-2011 Dispozitiv LED - Vanzari - Femei 25-45 - Mar2026  │
│                                                         [Pauză] [Editează]│
│                                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Cheltuieli  │ │ ROAS        │ │ Achiziții   │ │ CTR         │       │
│  │ 847 RON     │ │ 3.2x        │ │ 12          │ │ 1.8%        │       │
│  │ (30 zile)   │ │ ↑ față de   │ │             │ │             │       │
│  │             │ │ săpt. trecută│ │             │ │             │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Evoluție ROAS + Spend (30 zile)                                 │   │
│  │  [Grafic linie dublu - recharts LineChart]                       │   │
│  │  Axa stânga: ROAS (0-5x), Axa dreapta: Spend RON               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Metrici zilnice                                                 │   │
│  │  Data | Spend | Impresii | Clicks | CTR | CPM | Achiziții | ROAS│   │
│  │  29 Mar | 42 RON | 1.840 | 33 | 1.8% | 22.8 | 1 | 3.1x       │   │
│  │  28 Mar | 38 RON | 1.620 | 28 | 1.7% | 23.5 | 1 | 3.4x       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Ad Sets (3)                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Femei 25-45 Romania Broad  ● ACTIV  25 RON/zi  ROAS: 3.5x       │   │
│  │ Retargeting Vizitatori 30d ● ACTIV  15 RON/zi  ROAS: 4.2x       │   │
│  │ Lookalike 1% Cumpărători   ○ PAUZAT 10 RON/zi  -                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Grafic implementare (recharts):**

```typescript
// rise/src/features/meta/components/CampaignMetricsChart.tsx

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

interface Props {
  metrics: Array<{
    date: string;
    spend: number;
    roas: number | null;
  }>;
}

export function CampaignMetricsChart({ metrics }: Props) {
  const data = metrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString("ro-RO", { day: "2-digit", month: "short" }),
    spend: m.spend,
    roas: m.roas ? parseFloat(m.roas.toFixed(2)) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a0533" />
        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <YAxis yAxisId="left" tick={{ fill: "#9ca3af" }} label={{ value: "ROAS (x)", angle: -90 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af" }} label={{ value: "RON", angle: 90 }} />
        <Tooltip
          contentStyle={{ background: "#1a0533", border: "1px solid #4A1B6D" }}
          formatter={(value: number, name: string) =>
            name === "roas" ? [`${value}x`, "ROAS"] : [`${value} RON`, "Spend"]
          }
        />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="roas" stroke="#D4AF37" strokeWidth={2} dot={false} name="ROAS" />
        <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#4A1B6D" strokeWidth={2} dot={false} name="Spend" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### 9.3 /campaigns/new — Wizard creare campanie

**Fișier:** `rise/src/app/(dashboard)/campaigns/new/page.tsx`

**Wizard în 3 pași:**

```
Pas 1: Informații de bază
├── Nume campanie (cu template auto-fill: "[Produs] - [Obiectiv] - [Audiență] - [Lună]")
├── Obiectiv: OUTCOME_SALES | OUTCOME_LEADS | OUTCOME_TRAFFIC | OUTCOME_AWARENESS
├── Buget zilnic (RON) — cu ghid: "Recomandat: 20-30 RON pentru testing"
├── Data start
└── Data end (opțional)

Pas 2: Review campanie
├── Preview denumire campanie
├── Estimare reach Meta (dacă disponibil din API)
├── Estimare cost per achiziție (bazat pe ROAS mediu din contul tău)
└── Warning: "Campania va fi creată PAUZATĂ. O vei activa manual din Meta Ads Manager."

Pas 3: Confirmare
└── Buton "Creează campanie în Meta"
```

**Componente:**

```typescript
// rise/src/features/meta/components/CampaignNameTemplate.tsx
// Generare automată denumire după pattern recomandat

const OBJECTIVES_RO: Record<string, string> = {
  OUTCOME_SALES: "Vanzari",
  OUTCOME_LEADS: "LeadGen",
  OUTCOME_TRAFFIC: "Trafic",
  OUTCOME_AWARENESS: "Awareness",
};

export function generateCampaignName(
  product: string,
  objective: string,
  audience: string,
  date: Date = new Date()
): string {
  const month = date.toLocaleDateString("ro-RO", { month: "short", year: "numeric" })
    .replace(" ", "")
    .replace(".", "");
  const obj = OBJECTIVES_RO[objective] ?? objective;
  return `${product} - ${obj} - ${audience} - ${month}`;
}
```

---

## 10. Research piața română

### 10.1 Convenții de denumire campanii

Pe piața românească de e-commerce, denumirea campaniilor Meta Ads trebuie să fie **descriptivă, standardizată și ușor filtrabilă** în Ads Manager. Recomandarea generală:

**Format standard:**
```
[Produs/Categorie] - [Obiectiv] - [Audiență] - [Perioadă/Sezon]
```

**Exemple concrete pentru Azora.ro:**

| Tip campanie | Denumire recomandată |
|---|---|
| Produs nou - vânzări | `EP-2011 Dispozitiv LED - Vanzari - Femei 25-45 - Mar2026` |
| Cadou sezonier | `Cadou Ursulet Trandafir - Conversii - Cupluri - Paste2026` |
| Retargeting general | `Azora - Retargeting - Vizitatori30zile - Apr2026` |
| Retargeting coș | `Azora - Retargeting - AbandCoș - Continuu` |
| Lookalike | `EP-2011 - Lookalike1% - Cumpărători - Apr2026` |
| Categorie produse | `Beauty Devices - Trafic - Femei 22-55 - Q2-2026` |
| Awareness brand | `Azora - Brand Awareness - Romania - Continuu` |

**Reguli de denumire:**
- Nu folosi diacritice în denumiri (ș, ț, ă, â, î) — pot cauza probleme în export CSV și API
- Maxim 150 caractere (limita Meta)
- Evită spațiile duble sau caracterele speciale (paranteze, slash, ghilimele)
- Folsește liniuță ` - ` ca separator, nu slash sau punct
- Data în format `LunăAn` (Mar2026, Paste2026, Q2-2026) — ușor de sortat

**Variante de structurare a campaniilor:**

| Abordare | Când se folosește | Exemplu |
|---|---|---|
| Per produs | Produse cu margine mare (>200 RON) sau cu volum mare | 1 campanie = EP-2011 |
| Per categorie | Produse sub 100 RON sau gamă largă | 1 campanie = "Beauty Devices" |
| Per sezon | Campanii temporare (Crăciun, 8 Martie, Paște) | Durata campaniei = 3-4 săpt. |
| Per audiență | Test split pe segmente diferite | Broad vs. Retargeting = campanii separate |

**Recomandare Azora Phase 1:** structură per produs. Azora are 2-5 produse vedete (EP-2011, Ursulet, dispozitive wellness) cu marjă mare. O campanie per produs permite vizibilitate clară pe ROAS și profit.

---

### 10.2 Bugete zilnice recomandate pentru România

**Context piață:** România este una dintre piețele cu CPM printre cele mai mici din Europa (10-25 EUR CPM față de 30-60 EUR în Germania/Franța). Avantajul este că poți testa campanii cu bugete mici și obține date statistice relevante.

**Framework bugete:**

| Faza | Buget zilnic | Obiectiv | Criterii trecere la faza următoare |
|---|---|---|---|
| **Testing** | 20-30 RON/zi | Minim 5-10 conversii în 7 zile | ROAS > 1.5 constant 7 zile |
| **Validat** | 50-100 RON/zi | Ieșire din learning phase | ROAS > 2 constant 14 zile |
| **Scale lent** | 150-300 RON/zi | Creștere volum, ROAS stabil | Scalare cu max 20-30% la 3-5 zile |
| **Scale agresiv** | 500+ RON/zi | Produse dovedite, margine mare | ROAS > 3, stabil 30 zile |

**Regula 20-30% la scalare:**
Meta Ads folosește un algoritm de optimizare (delivery system) care recompensează conturile cu istoricul cel mai bun. O creștere bruscă a bugetului (ex: de la 50 la 500 RON în o zi) resetează algoritmul, forțând campania să reintre în learning phase. Creșterea graduală de 20-30% la fiecare 3-5 zile permite algoritmului să se adapteze.

**Learning Phase — ce înseamnă pentru România:**
- Meta necesită **50 de eventi de optimizare** per ad set în 7 zile pentru a ieși din learning
- La un buget de 30 RON/zi și un CPA de 60 RON → 3-4 conversii/zi = 21-28 conversii/săptămână
- Pentru ieșire din learning: buget minim recomandat = **50-70 RON/zi** (dacă CPA < 70 RON)
- Dacă produsul are CPA ridicat (>150 RON), nu poți ieși din learning cu buget mic → necesari 150+ RON/zi

**Bugete specifice pentru Azora.ro:**

| Produs | Preț RON | Margine estimată | Buget testing | ROAS breakeven |
|---|---|---|---|---|
| EP-2011 LED | ~350-500 RON | ~50% | 50 RON/zi | 2.0x |
| Ursulet cadou | ~150-250 RON | ~60% | 30 RON/zi | 1.7x |
| Dispozitive wellness | ~200-400 RON | ~45% | 40 RON/zi | 2.2x |

**Calcul ROAS breakeven:**
```
ROAS_breakeven = 1 / marja_neta
Ex: margine 50% → ROAS_breakeven = 1 / 0.50 = 2.0x
Sub 2.0x pierzi bani, peste 2.0x ești profitabil
```

---

### 10.3 Structura de campanie recomandată pentru Azora

**Structura optimă (testată pe e-commerce românesc):**

```
CAMPANIE: EP-2011 - Vanzari - Mar2026
├── Ad Set 1: Broad - Femei 22-55 Romania (buget: 30 RON/zi)
│   ├── Ad 1: Video 9:16 (TikTok-style hook)
│   ├── Ad 2: Video 4:5 (Feed style)
│   └── Ad 3: Imagine statică cu produs
│
├── Ad Set 2: Retargeting - Vizitatori 30 zile (buget: 15 RON/zi)
│   ├── Ad 1: Video cu testimonial/dovadă socială
│   └── Ad 2: Carousel cu beneficii
│
└── Ad Set 3: Retargeting - Abandonare coș (buget: 10 RON/zi)
    ├── Ad 1: Imagine cu urgency ("Stoc limitat")
    └── Ad 2: Video scurt 15s
```

**De ce această structură:**
- **Broad audience** primește cel mai mare buget — lasa algoritmul Meta să găsească cumpărătorii
- **Retargeting** are ROAS mai mare dar volum mic — buget mic, eficiență mare
- **Abandonare coș** = publicul cel mai hot — ROAS 5-10x dar volum foarte mic

**Regula A/B test creative:**
- 2-4 variante per ad set în primele 2 săptămâni
- După 7 zile: oprești toate ad-urile cu CTR < 0.8% sau CPA > 2x target
- Meta optimizează automat delivery-ul spre cele mai bune creative-uri

---

### 10.4 Alerte și reguli automate

**Praguri recomandate piață română:**

| Metrică | Prag alertă | Acțiune recomandată |
|---|---|---|
| ROAS | < 1.5 timp de 3 zile consecutive | Notificare + sugestie: verifică creative, audiență, pagina produs |
| ROAS | < 0.8 timp de 5 zile | Pauză automată + notificare urgentă |
| Spend zilnic | > budget * 1.1 | Alertă imediată — possibil bid scăpat de sub control |
| CTR | < 0.8% după 1.000 impresii | Sugestie schimbare creative — ad-ul nu captează atenția |
| CPM | > 40 RON (≈8 EUR) | Audiența e prea scumpă sau concurența e ridicată |
| CPA | > preț_produs * 0.4 | Nu mai ești profitabil — recalculează targeting |
| Learning Phase | Dacă după 7 zile nu ai 50 conversii | Sugestie mărire buget sau schimbare eveniment optimizare |

**Context CPM România:**
- CPM normal: 10-25 RON (2-5 EUR) pentru audiențe largi
- CPM ridicat (>40 RON): apare la audiențe very narrow, în perioadele aglomerate (Crăciun, Paște, Black Friday) sau dacă ad-ul are relevance score mic
- Sezonalitate: CPM crește cu 30-50% în oct-dec față de ian-mar

---

### 10.5 Integrare UTM și atribuire vânzări

**Schema UTM recomandată pentru Azora:**

```
utm_source=facebook
utm_medium=paid_social
utm_campaign=[campaign_name_slug]  ← ex: ep-2011-vanzari-mar2026
utm_content=[ad_name_slug]         ← ex: video-9x16-hook
utm_term=[adset_name_slug]         ← ex: femei-25-45-broad
```

**Atribuire comenzi Shopify:**
1. Shopify Orders conțin `referring_site` și `landing_site` cu UTM parameters
2. Rise poate fetcha comenzile prin Shopify API și le poate filtra după `utm_source=facebook`
3. `revenue_atribuibil = SUM(order.total_price WHERE utm_source=facebook AND utm_campaign=X)`
4. ROAS calculat în Rise = `revenue_atribuibil / spend_meta`

**IMPORTANT — Discrepanțe de atribuire:**
Meta și Shopify folosesc ferestre de atribuire diferite:
- Meta: default 7-day click + 1-day view attribution
- Shopify: last-click attribution

Rise ar trebui să afișeze ambele ROAS-uri: cel raportat de Meta și cel calculat din Shopify. Discrepanța tipică = 15-30%, normală. Dacă diferența > 50%, pixelul e prost configurat.

---

## 11. Sincronizare automată metrici

### 11.1 Strategie sync

**Frecvența recomandată:**
- **Metrici zilnice**: o dată pe zi, dimineața la 06:00 — Meta finalizează raportarea cu 2-3h întârziere față de end of day
- **Sync campanii** (structura, status): de 2 ori pe zi (06:00 și 18:00) — detectează modificări făcute manual în Meta Ads Manager
- **Metrici live (opțional)**: nu recomandat — Meta rate limit = 200 calls/oră per token, datele live oricum nu sunt finalizate

**De ce sync la 06:00 (nu la 00:00):**
Meta procesează datele din ziua precedentă și le finalizează în general până la 02:00-03:00. Un sync la 06:00 garantează că datele pentru `ieri` sunt complete.

### 11.2 Implementare cron cu Dokploy

```yaml
# Pe VPS-ul Dokploy, în secțiunea Cron Jobs a aplicației Rise:
# Sau configurabil printr-un shell script rulat cu crontab

# 06:00 zilnic — sync metrici ieri + verificare alerte
0 6 * * * curl -X POST https://rise.azora.ro/api/meta/sync-metrics \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' >> /var/log/rise-cron.log 2>&1

# 06:05 zilnic — sync campanii (structura)
5 6 * * * curl -X POST https://rise.azora.ro/api/meta/sync \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' >> /var/log/rise-cron.log 2>&1

# 18:00 zilnic — sync campanii (al doilea sync pentru modificări din ziua curentă)
0 18 * * * curl -X POST https://rise.azora.ro/api/meta/sync \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' >> /var/log/rise-cron.log 2>&1
```

**Variabile de environment necesare:**

```bash
# rise/.env
CRON_SECRET=<random-256-bit-hex>        # openssl rand -hex 32
META_TOKEN_ENCRYPTION_KEY=<32-bytes-hex> # openssl rand -hex 32
```

### 11.3 Retry logic și error handling

```typescript
// rise/src/features/meta/sync-utils.ts

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

// Logging sync events în DB
export async function logSyncEvent(
  organizationId: string,
  type: "CAMPAIGNS" | "METRICS",
  status: "SUCCESS" | "PARTIAL" | "FAILED",
  details: object
) {
  // Poți stoca în tabelul SyncLog (opțional, Phase 2)
  // Phase 1: log în consolă + Sentry dacă e configurat
  console.log(`[Meta Sync] ${type} ${status}`, {
    organizationId,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
```

### 11.4 Rate Limiting Meta API

Meta Marketing API aplică rate limits la nivel de app:
- **Standard tier**: 200 API calls / oră per ad account
- **Development tier** (app neaprobat pentru Marketing API Standard Access): mai restrictiv

**Calculul consumului Rise:**
- 1 sync campanii: 1 call (fetch campaigns) + N_campaigns × 2 calls (ad sets + ads) = ~20-30 calls per sync
- 1 sync metrici: 1 call (insights batch) = 1 call
- Total zilnic: ~60-65 calls → bine sub limita de 200/oră

**Recomandare:** aplică pentru `Marketing API Standard Access` în Meta App Review. Procesul durează 3-5 zile lucrătoare și ridică limitele semnificativ.

---

## 12. Sistem de alerte

### 12.1 Logica de verificare alerte

```typescript
// rise/src/features/meta/alerts.ts

import { prisma } from "@/lib/prisma";
import { AlertType } from "@prisma/client";

interface AlertConfig {
  roasLowThreshold: number;      // default: 1.5
  roasLowDays: number;           // default: 3
  roasAutoPauseDays: number;     // default: 5
  roasAutoPauseThreshold: number;// default: 0.8
  spendExceededRatio: number;    // default: 1.1 (110% din budget)
  ctrLowThreshold: number;       // default: 0.8 (procent)
  ctrMinImpressions: number;     // default: 1000
  cpmHighThreshold: number;      // default: 40 RON
}

const DEFAULT_CONFIG: AlertConfig = {
  roasLowThreshold: 1.5,
  roasLowDays: 3,
  roasAutoPauseDays: 5,
  roasAutoPauseThreshold: 0.8,
  spendExceededRatio: 1.1,
  ctrLowThreshold: 0.8,
  ctrMinImpressions: 1000,
  cpmHighThreshold: 40,
};

export async function checkAlertsForOrganization(
  organizationId: string,
  config: AlertConfig = DEFAULT_CONFIG
): Promise<void> {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: {
      metrics: {
        orderBy: { date: "desc" },
        take: 7,  // ultimele 7 zile
      },
    },
  });

  for (const campaign of campaigns) {
    await checkRoasAlert(campaign, config, organizationId);
    await checkSpendAlert(campaign, config, organizationId);
    await checkCtrAlert(campaign, config, organizationId);
    await checkCpmAlert(campaign, config, organizationId);
  }
}

async function checkRoasAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const recentMetrics = campaign.metrics.filter((m) => m.roas !== null);
  if (recentMetrics.length === 0) return;

  // Verifică ROAS scăzut pentru N zile consecutive
  const lowRoasDays = recentMetrics.filter(
    (m) => m.roas !== null && m.roas < config.roasLowThreshold
  );

  if (lowRoasDays.length >= config.roasLowDays) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.ROAS_LOW, {
      roas: lowRoasDays[0].roas,
      threshold: config.roasLowThreshold,
      daysBelow: lowRoasDays.length,
      message: `ROAS sub ${config.roasLowThreshold}x timp de ${lowRoasDays.length} zile consecutive`,
    });
  }

  // Verifică auto-pauză: ROAS < 0.8 timp de 5 zile
  const autoPauseDays = recentMetrics.filter(
    (m) => m.roas !== null && m.roas < config.roasAutoPauseThreshold
  );

  if (autoPauseDays.length >= config.roasAutoPauseDays) {
    // Pauze campania automat
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId },
    });

    if (connection && campaign.metaCampaignId) {
      const { decryptToken } = await import("@/lib/encryption");
      const { updateCampaignStatus } = await import("./client");
      const accessToken = decryptToken(connection.accessTokenEncrypted);

      await updateCampaignStatus(accessToken, campaign.metaCampaignId, "PAUSED");
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "PAUSED" },
      });

      await createAlertIfNotExists(campaign.id, organizationId, AlertType.AUTO_PAUSED, {
        roas: autoPauseDays[0].roas,
        threshold: config.roasAutoPauseThreshold,
        daysBelow: autoPauseDays.length,
        message: `Campanie oprită automat: ROAS sub ${config.roasAutoPauseThreshold}x pentru ${autoPauseDays.length} zile consecutive`,
      });
    }
  }
}

async function checkSpendAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const today = campaign.metrics[0];
  if (!today) return;

  const spendThreshold = campaign.budget * config.spendExceededRatio;
  if (today.spend > spendThreshold) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.SPEND_EXCEEDED, {
      spend: today.spend,
      budget: campaign.budget,
      ratio: today.spend / campaign.budget,
      message: `Spend zilnic (${today.spend} RON) depășește bugetul (${campaign.budget} RON) cu ${Math.round((today.spend / campaign.budget - 1) * 100)}%`,
    });
  }
}

async function checkCtrAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const today = campaign.metrics[0];
  if (!today || today.impressions < config.ctrMinImpressions) return;

  if (today.ctr !== null && today.ctr < config.ctrLowThreshold) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.CTR_LOW, {
      ctr: today.ctr,
      threshold: config.ctrLowThreshold,
      impressions: today.impressions,
      message: `CTR scăzut (${today.ctr.toFixed(2)}%) după ${today.impressions.toLocaleString("ro-RO")} impresii — consideră schimbarea creative-ului`,
    });
  }
}

async function checkCpmAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const today = campaign.metrics[0];
  if (!today || today.cpm === null) return;

  if (today.cpm > config.cpmHighThreshold) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.CPM_HIGH, {
      cpm: today.cpm,
      threshold: config.cpmHighThreshold,
      message: `CPM ridicat (${today.cpm.toFixed(1)} RON) — audiența poate fi prea scumpă sau concurența ridicată`,
    });
  }
}

async function createAlertIfNotExists(
  campaignId: string,
  organizationId: string,
  type: AlertType,
  metadata: object & { message: string }
): Promise<void> {
  // Verifică dacă există deja o alertă nerezolvată de același tip
  const existing = await prisma.campaignAlert.findFirst({
    where: {
      campaignId,
      type,
      isResolved: false,
      // Alertă creată în ultimele 24h — nu duplicăm
      triggeredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (existing) return;  // Alertă deja existentă, skip

  await prisma.campaignAlert.create({
    data: {
      organizationId,
      campaignId,
      type,
      message: metadata.message,
      metadata,
    },
  });
}
```

### 12.2 UI alerte — AlertsPanel

```typescript
// rise/src/features/meta/components/AlertsPanel.tsx
// Afișat în header (badge cu număr) sau în campaniile relevante

// Tipuri alerte cu styling:
const ALERT_STYLES: Record<AlertType, { color: string; icon: string; label: string }> = {
  ROAS_LOW: { color: "orange", icon: "⚠️", label: "ROAS scăzut" },
  SPEND_EXCEEDED: { color: "red", icon: "🚨", label: "Spend depășit" },
  CTR_LOW: { color: "yellow", icon: "📉", label: "CTR mic" },
  CPM_HIGH: { color: "orange", icon: "💸", label: "CPM ridicat" },
  AUTO_PAUSED: { color: "red", icon: "⏸️", label: "Oprită automat" },
  LEARNING_PHASE: { color: "blue", icon: "📚", label: "Learning phase" },
  BUDGET_ENDING: { color: "yellow", icon: "⏳", label: "Buget pe terminate" },
};
```

### 12.3 API Routes alerte

```
GET  /api/meta/alerts         ← lista alerte nerezolvate
POST /api/meta/alerts/[id]/read    ← marchează ca citit
POST /api/meta/alerts/[id]/resolve ← marchează ca rezolvat
```

---

## 13. Structura de fișiere completă

```
rise/src/
├── app/
│   ├── (dashboard)/
│   │   ├── campaigns/
│   │   │   ├── page.tsx                    ← Lista campanii
│   │   │   ├── new/
│   │   │   │   └── page.tsx                ← Wizard creare campanie
│   │   │   └── [id]/
│   │   │       └── page.tsx                ← Detalii + grafice
│   │   └── settings/
│   │       └── page.tsx                    ← Secțiunea Meta Connection (extinsă)
│   └── api/
│       └── meta/
│           ├── connect/
│           │   └── route.ts                ← POST conectare, DELETE deconectare
│           ├── sync/
│           │   └── route.ts                ← POST sync campanii manual
│           ├── sync-metrics/
│           │   └── route.ts                ← POST sync metrici (cron)
│           ├── campaigns/
│           │   ├── route.ts                ← GET list, POST create
│           │   └── [id]/
│           │       ├── route.ts            ← GET, PATCH, DELETE
│           │       ├── metrics/
│           │       │   └── route.ts        ← GET metrici cu filtru
│           │       └── pause/
│           │           └── route.ts        ← POST pauze rapidă
│           └── alerts/
│               ├── route.ts                ← GET alerts
│               └── [id]/
│                   ├── read/route.ts
│                   └── resolve/route.ts
├── features/
│   └── meta/
│       ├── client.ts                       ← Meta API wrapper
│       ├── campaigns-sync.ts               ← Sync logic
│       ├── alerts.ts                       ← Alert checks
│       ├── sync-utils.ts                   ← Retry, logging
│       ├── components/
│       │   ├── MetaConnectionCard.tsx      ← Settings UI
│       │   ├── CampaignsTable.tsx          ← Lista campanii
│       │   ├── CampaignStatusBadge.tsx
│       │   ├── RoasBadge.tsx
│       │   ├── CampaignMetricsChart.tsx    ← recharts grafic
│       │   ├── MetaAlertBanner.tsx
│       │   ├── CampaignsSummaryBar.tsx
│       │   ├── SyncButton.tsx
│       │   ├── CampaignNameTemplate.tsx    ← Generator denumire
│       │   └── AlertsPanel.tsx
│       └── hooks/
│           ├── useCampaigns.ts
│           ├── useCampaignMetrics.ts
│           ├── useSyncCampaigns.ts
│           └── useAlerts.ts
└── lib/
    └── encryption.ts                       ← AES-256-GCM (refolosit din Sub-proiect 1)
```

---

## 14. Checklist verificare

### 14.1 Înainte de implementare

- [ ] Meta Developer App creat cu Marketing API activat
- [ ] System User creat cu rol Admin în Business Suite
- [ ] Permisiuni ad account acordate System User-ului
- [ ] Token generat cu toate permisiunile necesare (`ads_management`, `ads_read`, `pages_read_engagement`, `pages_manage_ads`, `read_insights`)
- [ ] Conexiune testată cu `curl` pe `/act_{id}/campaigns`
- [ ] `META_TOKEN_ENCRYPTION_KEY` adăugat în `.env` (32 bytes hex)
- [ ] `CRON_SECRET` adăugat în `.env`

### 14.2 Schema și migrare

- [ ] Modele `AdSet`, `Ad`, `AdSetMetrics`, `AdMetrics`, `CampaignAlert` adăugate în `schema.prisma`
- [ ] `Campaign` model extins cu `adSets`, `alerts`, `lastSyncAt`
- [ ] Migrație rulată: `npx prisma migrate dev --name add-adset-ad-alerts`
- [ ] `npx prisma generate` rulat după migrație
- [ ] Migrație testată pe DB de development

### 14.3 Meta API Client

- [ ] `validateMetaToken()` testată cu token valid și invalid
- [ ] `fetchCampaigns()` returnează lista campaniilor din ad account
- [ ] `createCampaign()` creează campanie cu status PAUSED
- [ ] `updateCampaignStatus()` modifică statusul corect
- [ ] `fetchCampaignInsights()` returnează metrici cu purchases din actions
- [ ] Gestionare erori API (rate limit, token expirat, permisiuni lipsă)

### 14.4 Sync și metrici

- [ ] `syncCampaignsFromMeta()` upsertează campaniile, ad sets, ads
- [ ] `syncDailyMetrics()` upsertează metricile zilnice
- [ ] Retry logic funcționează pentru erori temporare Meta API
- [ ] Endpoint `/api/meta/sync-metrics` protejat cu `CRON_SECRET`
- [ ] Cron job configurat în Dokploy (sau crontab pe VPS)
- [ ] Test manual sync: `curl -X POST /api/meta/sync -H "Authorization: Bearer ..."` returnează succes

### 14.5 UI

- [ ] Settings page afișează starea conexiunii Meta (conectat/neconectat)
- [ ] Formular conectare validează Ad Account ID (trebuie să înceapă cu `act_`)
- [ ] Mesaj de eroare clar dacă token-ul e invalid
- [ ] Lista `/campaigns` afișează toate campaniile sincronizate
- [ ] Buton "Sincronizează acum" funcționează și afișează loading state
- [ ] Pagina `/campaigns/[id]` afișează graficul ROAS + Spend (recharts)
- [ ] Wizard `/campaigns/new` creează campanie PAUSED în Meta
- [ ] Badge-ul de alerte din header afișează numărul de alerte necitite

### 14.6 Alerte

- [ ] `checkAlertsForOrganization()` rulează după fiecare sync metrici
- [ ] Alertele duplicate (același tip, sub 24h) nu se mai creează
- [ ] UI afișează alertele nerezolvate
- [ ] Alertele pot fi marcate ca citite/rezolvate
- [ ] Auto-pauze funcționează: campanie cu ROAS < 0.8 timp de 5 zile devine PAUSED

### 14.7 Securitate

- [ ] Token Meta criptat AES-256-GCM în DB (nu stocat plain text)
- [ ] Toate API routes verifică `organizationId` din sesiune (nu din body)
- [ ] Endpoint cron protejat cu `Authorization: Bearer CRON_SECRET`
- [ ] Token-ul Meta nu apare în logs sau responses
- [ ] `.env` nu e în git (verificat cu `git status`)

---

## 15. Sugestii de îmbunătățire

### 15.1 Sub-proiect 5 (AI + Advanced)

**Hook Generator pentru ad copy (AI):**
Rise poate genera text pentru ad-uri bazat pe produsul din Shopify + performance istorică a campaniilor. Claude API + templateuri per obiectiv de campanie. Dacă ROAS-ul unui ad e scăzut, Rise sugerează automată un nou headline/primary text.

**Creative Intelligence:**
- Analiză `creativeUrl` (thumbnail ad) cu Claude Vision
- Identifică pattern-uri: "ad-urile cu fundal alb convertesc cu 30% mai bine"
- Recomandări automate de creative bazate pe istoricul contului

**Audience Recommendations:**
- Bazat pe produsele Shopify (categorie, preț, audiență target), Rise sugerează audiențe Meta
- Lookalike audiences: "Ai 500+ cumpărători — poți crea Lookalike 1% din ei"

### 15.2 Sub-proiect 6 (Multi-tenant SaaS)

**Multi-account:**
- Un utilizator Rise poate gestiona multiple magazine Shopify + multiple ad accounts Meta
- Necesită refactorizare completă a `MetaConnection` (1:many per Organization, sau multi-Organization per User)
- Billing per organizație, permisiuni granulare per utilizator

**Benchmarking piață:**
- Agregare anonimă a KPI-urilor (ROAS mediu, CPM, CTR) per industrie/nișă
- "Contul tău are ROAS 3.2x față de media de 2.1x în categoria beauty Romania"

### 15.3 Îmbunătățiri imediate (în scope Sub-proiect 4)

**Raport PDF săptămânal:**
- Generate automat în fiecare luni dimineața
- Conține: spend săptămânal, ROAS per campanie, top ad creative, alerte rezolvate
- Trimis pe email sau disponibil de download în Rise

**Comparație perioadă anterioară:**
- Metrici cu delta față de săptămâna/luna anterioară
- `↑ ROAS 3.2x (+0.4 față de săptămâna trecută)`

**Export CSV:**
- Export metrici pentru orice interval de timp
- Util pentru raportare client sau reconciliere contabilă

**Notificări email pentru alerte critice:**
- `SPEND_EXCEEDED` și `AUTO_PAUSED` → email imediat (nu doar in-app)
- Integrare cu Resend sau Nodemailer (simplu, fără dependențe externe)

**Budget forecasting:**
- Bazat pe spend zilnic × zile rămase din lună
- "La ritmul actual, vei cheltui 1.240 RON luna aceasta (buget alocat: 1.000 RON)"

### 15.4 Considerații tehnice viitoare

**Webhook Meta (în loc de polling):**
Meta oferă Real-Time Updates (webhooks) pentru modificări de status campanii. Ar elimina necesitatea cron-ului de 18:00 pentru sync structură. Necesită app public sau whitelist IP — fezabil post Phase 1.

**Caching Redis:**
La scale (multe campanii, mulți utilizatori), apelurile Meta API pot fi costisitoare. Redis cache pentru `fetchCampaigns()` cu TTL 30 minute ar reduce dramatic numărul de API calls.

**Meta Conversions API (CAPI):**
Integrare server-side Meta Pixel prin Conversions API — îmbunătățește atribuirea cu 15-25% față de browser pixel (ad blockers, iOS privacy). Necesită webhook de la Shopify → Rise → Meta CAPI. Implementare Phase 5+.

---

*Document generat: 2026-03-29*
*Versiunea platformei: Rise Phase 1, Sub-proiect 4*
*Referință Meta Marketing API: v21.0*
