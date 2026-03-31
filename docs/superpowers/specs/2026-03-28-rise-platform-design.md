# Rise — E-commerce Growth Platform

**Date:** 2026-03-28
**Status:** Approved design, ready for implementation planning
**Domain (Phase 1):** `rise.azora.ro`
**Domain (Phase 2):** `rise.io`
**Tested on:** Azora (azora.ro) — Shopify store, beauty/wellness devices
**Repo:** `azora-ads` (existing repo, restructured to host both Remotion + Rise platform)

---

## Vision

Rise is an AI-powered growth platform for Shopify stores. It combines video ad creation, Meta campaign management, and profitability analytics into a single tool — replacing the fragmented workflow of Remotion + Meta Ads Manager + spreadsheets.

Phase 1: Internal tool for Azora. Phase 2: Multi-tenant SaaS with subscription plans for other Shopify stores.

---

## Architecture

### Chosen approach: Next.js Monolith + Remotion Microservice

```
┌─────────────────────────────────────┐
│         Next.js 15 App              │  UI + API routes + Auth + All modules
│         rise.azora.ro               │  Deployed on Hostinger Ubuntu VPS
└──────────────┬──────────────────────┘
               │ HTTP render jobs
┌──────────────▼──────────────────────┐
│      Remotion Render Service        │  Node.js microservice, same VPS
│      @remotion/renderer             │  POST /render → returns job ID
│      Port 3001 (internal only)      │  Async rendering, webhook on complete
└──────────────┬──────────────────────┘
               │ store videos
┌──────────────▼──────────────────────┐
│         Supabase                    │  PostgreSQL + Auth + RLS
│         + Cloudflare R2             │  Video/asset storage (~$0.015/GB)
└─────────────────────────────────────┘
```

**Deployment stack:**
- Hostinger Ubuntu VPS (~$10-15/month)
- Docker Compose (Next.js + Remotion service + Redis + Nginx)
- Nginx reverse proxy with SSL (Let's Encrypt)
- BullMQ + Redis for render job queue
- n8n (separate service, same VPS) — internal Azora automations only

**n8n role:** NOT part of Rise platform. Used separately for:
- Azora price monitoring
- Meta Ads automation rules (pause/scale based on ROAS)
- Weekly performance reports

---

## Multi-tenant Data Model

```
auth.users (Supabase Auth)
  └── organization_members (role: owner | admin | viewer)
        └── organizations
              ├── shopify_connections (shop_domain, access_token, webhook_secret)
              ├── meta_connections (ad_account_id, page_id, pixel_id, access_token)
              ├── products (synced from Shopify)
              │     ├── product_costs (cogs, shipping_avg, return_rate)
              │     └── product_videos (render jobs, output URLs)
              ├── video_assets (uploaded clips, indexed with embeddings)
              ├── campaigns (Meta campaign_id, status, budget)
              │     └── campaign_metrics (daily: spend, purchases, roas, cpm, ctr)
              └── subscriptions (plan, stripe_subscription_id, limits)
```

**Isolation:** Every table has `organization_id`. Row Level Security (RLS) in Supabase ensures tenants never see each other's data.

**Scope Phase 1:** Single organization (Azora). Multi-tenant architecture built in from start so Phase 2 expansion requires no rewrite — but subscription plans and public registration are out of scope for now.

---

## Module 1 — Video Ad Creation

### Flow: Product → 4 format videos

```
1. User selects product from Shopify sync
2. Chooses template (ProductShowcase / BeforeAfter / UGCStyle / Slideshow)
3. AI Hook Generator suggests 3-5 hook variants (Claude API)
4. User fills/edits: hook, subtitles (RO), clips from library, voiceover
5. Live preview via Remotion Player (in browser)
6. Click "Render All" → 4 format jobs queued
7. Remotion service renders: 9x16, 4x5, 1x1, 16x9
8. MP4s uploaded to Cloudflare R2
9. Notification in UI + download links
```

### Templates

| Template | Best for | Pattern |
|----------|----------|---------|
| ProductShowcase | All products | Video clips + subtitles + CTA (BearGiftAd pattern) |
| BeforeAfter | Beauty/wellness | Split screen before/after |
| UGCStyle | Any | Talking head + demo |
| Slideshow | Any | Product images + music + text |

All templates produce 4 formats: 9x16 (primary), 4x5 (Meta Feed), 1x1 (Square), 16x9 (Landscape).

### Remotion Render Service API

```typescript
// POST http://localhost:3001/render
{
  template: "ProductShowcase",
  organizationId: "uuid",
  params: {
    productName: "Mini Camera Spion",
    price: "149 RON",
    clips: ["r2://org-uuid/assets/clip1.mp4"],
    subtitles: [{ from: 0, to: 90, line1: "...", line2: "..." }],
    voiceover: "r2://org-uuid/assets/voice.mp3"
  },
  formats: ["9x16", "4x5", "1x1", "16x9"],
  webhookUrl: "https://rise.azora.ro/api/render/webhook"
}

// Webhook callback when done
{
  jobId: "uuid",
  status: "completed",
  videos: {
    "9x16": "https://r2.rise.io/renders/uuid-9x16.mp4",
    "4x5":  "https://r2.rise.io/renders/uuid-4x5.mp4",
    "1x1":  "https://r2.rise.io/renders/uuid-1x1.mp4",
    "16x9": "https://r2.rise.io/renders/uuid-16x9.mp4"
  }
}
```

### Video Library (Semantic Search)

All uploaded clips are indexed:
- Claude Vision analyzes 5 frames → generates description + tags + vibe
- OpenAI `text-embedding-3-small` generates vector embedding
- Stored in Supabase with `pgvector`
- When user selects a template + product, system auto-suggests the most relevant clips from their library via cosine similarity search

### AI Hook Generator

Before render, Claude generates 3-5 hook variants per product:
- Input: product name, category, price, Meta performance data from similar products
- Output: hook variants in Romanian, ready to use as subtitle line1
- Research agent (runs monthly): scrapes best-performing e-commerce video patterns to keep hooks current

---

## Module 2 — Meta Ads Management

### OAuth Connection

Standard Meta Business OAuth flow:
- User clicks "Connect Meta" → Meta OAuth → platform stores `access_token` per organization
- Captured: `ad_account_id`, `page_id`, `pixel_id`
- All Meta API calls use the tenant's own token — Rise never aggregates cross-tenant data

### Campaign Creation (3 steps)

```
Step 1: Select videos (the 4 rendered formats)
Step 2: Configure:
  - Objective: Purchase (always — never "Link Clicks")
  - Daily budget: X RON
  - Audience: Broad / Lookalike (1-3%) / Retargeting
  - Schedule: start date, optional end date
Step 3: Launch → Rise creates via Meta Ads API:
  Campaign (Purchase objective, CBO)
    └── Ad Set (audience, budget, schedule)
          └── Ads (one per format: 9x16, 4x5, 1x1, 16x9)
```

### Campaign Management

- Pause / Resume / Stop
- Edit budget
- Duplicate winning campaign with scaled budget
- View performance per format (which ratio converts best)

### Automated Rules (server-side cron, every 6h)

Configurable per organization:
```
IF ROAS < 1.5 for 3 consecutive days → Pause ad set + notify
IF ROAS > 3.0 → Increase budget by 20% + notify
IF CTR < 1% after 48h → Alert (do not auto-pause)
IF CPA > threshold → Alert
```

### Metrics Sync

Daily pull from Meta Ads API:
- Spend, impressions, clicks, purchases, ROAS, CPM, CPC, CTR
- Per ad + per format breakdown
- Stored in Supabase (no 90-day Meta window limitation)

---

## Module 3 — Profitability Dashboard

### Formula

```
Net Profit per product =
  Gross Revenue (Shopify orders: price × units sold)
  - TVA colectat (preț / 1.19 × 0.19 — cota configurabilă: 19% / 9% / 5%)
  = Net Revenue (ex-TVA)
  - COGS (cost achiziție produs, ex-TVA — introdus manual)
  - Shipping cost (cost transport efectiv, ex-TVA — introdus manual sau medie)
  - Ad spend (din Meta API, automat)
  - Shopify transaction fee (~2% per comandă)
  - Packaging cost (cost ambalaj — introdus manual, opțional)
  - Estimated returns (% configurat per categorie × COGS)
  - Income tax / micro tax (% configurat: 1% / 3% micro sau 16% impozit profit)
  = Net Profit (RON)
  = Margin % (Net Profit / Net Revenue × 100)
```

**Note:** TVA-ul pe COGS (TVA deductibil la achiziție) se scade automat dacă furnizorul e plătitor de TVA — configurabil per produs. Astfel formula reflectă impactul real TVA net (colectat - deductibil).

### Dashboard View

| Product | Sales | Ad Spend | COGS | Shipping | Net Profit | Margin |
|---------|-------|----------|------|----------|------------|--------|
| Aparat Bule | 7 | 120 RON | 280 RON | 49 RON | +251 RON | +42% |
| Mini Camera | 2 | 85 RON | 60 RON | 30 RON | +45 RON | +18% |
| Anti-Celulit | 0 | 321 RON | 0 | 0 | -321 RON | — |

**Automatic alerts:**
- Products with negative net profit after 7 days → recommendation: pause campaign or adjust price
- Products with margin < 15% → warning
- Best performing product of the week → highlight

### Cost Configuration (once per product)

Entered manually in product settings:
- Cost of goods (COGS): X RON (ex-TVA)
- Supplier TVA deductibil: Da / Nu (dacă furnizorul e plătitor de TVA)
- Average shipping cost: X RON (ex-TVA)
- Packaging cost: X RON (opțional)
- TVA rate: 19% / 9% / 5% (default 19%)
- Category → estimated return rate (Beauty: 5%, Tech: 3%, etc.)
- Selling price: auto-synced from Shopify (prețul afișat include TVA)

**Organization-level settings (o singură dată):**
- Income tax type: Micro 1% / Micro 3% / Impozit profit 16%
- Shopify plan fee rate (default 2%)

---

## Project Structure

```
azora-ads/                          ← existing repo, restructured
├── app/                            ← Next.js 15 App Router
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   └── onboarding/             ← connect Shopify + Meta
│   └── (dashboard)/
│       ├── layout.tsx              ← sidebar nav
│       ├── products/               ← Shopify product list + cost config
│       ├── videos/
│       │   ├── new/                ← template picker + editor
│       │   ├── library/            ← uploaded assets + semantic search
│       │   └── [id]/               ← render status + download
│       ├── campaigns/              ← create + manage Meta campaigns
│       └── profitability/          ← dashboard + product profit breakdown
├── api/
│   ├── shopify/                    ← OAuth + product sync webhook
│   ├── meta/                       ← Ads API calls
│   ├── render/                     ← job queue + Remotion webhook
│   └── stripe/                     ← subscription webhooks (Phase 2)
├── remotion-service/               ← migrated from azora-ads
│   ├── src/                        ← all existing Remotion components
│   │   ├── templates/
│   │   ├── components/
│   │   └── Root.tsx
│   ├── server.ts                   ← Express API
│   └── package.json
├── supabase/
│   └── migrations/                 ← schema + RLS policies
├── docker-compose.yml              ← Next.js + Remotion + Redis + Nginx
└── CLAUDE.md
```

---

## Implementation Order (Sub-projects)

| # | Sub-project | Deliverable |
|---|-------------|-------------|
| 1 | **Platform Core** | Next.js app, Supabase schema, auth, Shopify OAuth, deployment on rise.azora.ro |
| 2 | **Video Creation** | Remotion service migration, template system, render pipeline, video library |
| 3 | **Meta Ads** | Meta OAuth, campaign creation, metrics sync, automated rules |
| 4 | **Profitability Dashboard** | Cost config, profit formula, dashboard UI, alerts |
| 5 | **AI Strategy Layer** | Hook generator, research agent, semantic clip suggestions |
| 6 | **Multi-tenant SaaS** | *(Future)* Subscription plans, Stripe, public registration, rise.io |

---

## Tech Stack Summary

| Layer | Tool | Cost |
|-------|------|------|
| Frontend + API | Next.js 15 (App Router) | Free |
| Auth + DB | Supabase | Free → $25/month |
| Video rendering | Remotion self-hosted | Free |
| Video/asset storage | Cloudflare R2 | ~$0/month initially |
| Job queue | BullMQ + Redis | Free (self-hosted) |
| AI (hooks, analysis) | Claude API (claude-sonnet-4-6) | ~$10-20/month |
| Shopify integration | Shopify Partner App (private) | Free |
| Meta integration | Meta Business SDK | Free |
| Payments (Future) | Stripe | 1.4% + €0.25/transaction — out of scope Phase 1 |
| Hosting | Hostinger Ubuntu VPS | ~$10-15/month |
| Reverse proxy | Nginx + Docker Compose | Included |
| Internal automation | n8n (separate, same VPS) | Free (self-hosted) |

**Total Phase 1 cost: ~$20-35/month**

---

## What Rise Is NOT (scope boundaries)

- NOT an email marketing tool (use Klaviyo for that)
- NOT a competitor price monitor (that's a separate n8n workflow for Azora)
- NOT an inventory management system
- NOT a Shopify replacement — it reads from Shopify, doesn't replace it
