# Rise — Sub-proiectul 8: Sistemul de Subscripții SaaS

**Data:** 2026-03-29
**Status:** Plan aprobat — pregătit pentru implementare
**Prerequisite:** Sub-proiectele 1–7 finalizate (Platform Core, Video Creation, Meta Ads, Profitabilitate, AI/Search, Product Listing Creator, Onboarding)

---

## 1. Overview și Obiective

### Viziunea SaaS

Rise trece din faza **single-tenant** (un singur magazin — Azora.ro, acces gratuit) la o **platformă SaaS multi-tenant** unde fiecare magazin Shopify românesc plătește un abonament lunar. Fiecare organizație are date complet izolate, un plan de subscripție activ, și acces la feature-uri corespunzătoare planului.

**Scopul Sub-proiectului 8:**
- Implementarea sistemului complet de billing (Stripe Checkout + Billing Portal)
- Feature gating — fiecare feature verifică planul înainte de a fi accesat
- Self-serve onboarding: sign up → trial 14 zile → upgrade
- Migrarea Azora.ro din single-tenant la primul client pe platformă (fără downtime)
- UI complet `/billing`: plan curent, usage, upgrade prompts
- Email notifications: trial expirare, invoice, upgrade reminder
- Metrici SaaS interne: MRR, churn, feature adoption

### Propunere de Valoare per Segment

| Segment | Pain Point Principal | Rise îl rezolvă cu | Plan Recomandat |
|---------|---------------------|-------------------|-----------------|
| Magazin nou (< 20 produse) | Nu știe care produse sunt profitabile | Dashboard profitabilitate + Shopify sync | **Starter 99 RON** |
| Magazin în creștere (20-100 produse) | Pierde timp cu Meta Ads manual | Meta Ads manager + Video creation AI | **Growth 299 RON** |
| Magazin matur (100+ produse) | Listing-uri slabe, ROI neclar | Product Listing Creator + alerte avansate | **Pro 599 RON** |
| Business serios (multiple branduri) | Nevoie de SLA + suport dedicat | Enterprise custom + white label | **Enterprise** |

**ROI justificat:** Un magazin cu 50k RON/lună revenue care salvează 10 ore/lună din Meta Ads manual (la 50 RON/oră) = 500 RON economisit. Growth plan la 299 RON = ROI pozitiv din prima lună.

---

## 2. Planuri și Prețuri

### Tabelul Complet

| Feature | Starter | Growth | Pro | Enterprise |
|---------|---------|--------|-----|------------|
| **Preț/lună (RON)** | **99** | **299** | **599** | **Custom** |
| **Produse sync Shopify** | max 20 | max 100 | Nelimitat | Nelimitat |
| **Dashboard profitabilitate** | ✅ Basic | ✅ Full | ✅ Full + Export | ✅ Full + Export |
| **Meta Ads — Vizualizare** | ✅ | ✅ | ✅ | ✅ |
| **Meta Ads — Creare/Edit campanii** | ❌ | ✅ | ✅ | ✅ |
| **Meta Ads — Alerte automate** | ❌ | ❌ | ✅ | ✅ |
| **Video Creation** | ❌ | 10/lună | Nelimitat | Nelimitat |
| **Product Listing Creator** | ❌ | ❌ | 20/lună | Nelimitat |
| **Export rapoarte (CSV/PDF)** | ❌ | ❌ | ✅ | ✅ |
| **Membri organizație** | 1 | 3 | 10 | Nelimitat |
| **Suport** | Email | Email prioritar | Chat live | Dedicat + SLA |
| **Onboarding** | Self-serve | Self-serve | Video call 1h | Onboarding dedicat |
| **White label** | ❌ | ❌ | ❌ | ✅ |
| **Trial 14 zile (toate features Pro)** | ✅ | ✅ | ✅ | ✅ |

### Stripe Price IDs (naming convention)

```
price_rise_starter_monthly_ron
price_rise_growth_monthly_ron
price_rise_pro_monthly_ron
```

### Justificări Business

**Starter — 99 RON/lună**
- Pricing psihologic sub 100 RON — nu necesită aprobare bugetară
- Suficient pentru a valida profitabilitatea înainte de a investi în ads
- Limita de 20 produse e realistă pentru magazinele noi
- Upsell natural: când magazinul crește peste 20 produse, upgrade e obligatoriu

**Growth — 299 RON/lună**
- Prețul sweet spot pentru magazinele active pe Facebook/Instagram
- 10 video-uri/lună = 2-3 campanii complete; suficient pentru a vedea ROI
- Echivalent a 6 ore de muncă outsourcing/lună la 50 RON/oră
- Limita de 100 produse acoperă 90% din piața țintă

**Pro — 599 RON/lună**
- Sub 600 RON = decizie operațională, nu necesită aprobare CFO
- Product Listing Creator justifică singur prețul (20 listing-uri = 10 ore muncă economisit)
- Alerte automate Meta Ads = feature "set and forget" care adaugă valoare pasivă
- Export rapoarte = necesar pentru magazinele cu contabil extern

**Enterprise — Custom**
- Abordat manual, nu prin self-serve
- White label pentru agenții care vor să revândă Rise clienților lor
- SLA 99.5% uptime pentru businessuri dependente de platformă

---

## 3. Schema Prisma Completă

### Adăugare în `rise/prisma/schema.prisma`

```prisma
// ─── Subscription System ─────────────────────────────────────────────────────

enum SubscriptionPlan {
  STARTER
  GROWTH
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
  PAUSED
}

model Subscription {
  id                   String             @id @default(cuid())
  organizationId       String             @unique
  organization         Organization       @relation(fields: [organizationId], references: [id])

  // Stripe
  stripeCustomerId     String             @unique
  stripeSubscriptionId String?            @unique
  stripePriceId        String?
  stripeProductId      String?

  // Plan & Status
  plan                 SubscriptionPlan   @default(STARTER)
  status               SubscriptionStatus @default(TRIALING)

  // Trial
  trialStartedAt       DateTime           @default(now())
  trialEndsAt          DateTime           // now() + 14 zile la creare

  // Billing cycle
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  canceledAt           DateTime?

  // Metadata
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  usageMetrics         UsageMetric[]
  billingHistory       BillingHistory[]

  @@index([organizationId])
  @@index([stripeCustomerId])
  @@index([status])
}

// ─── Usage Tracking ──────────────────────────────────────────────────────────

enum UsageMetricType {
  PRODUCTS_SYNCED      // produse active sync Shopify
  CAMPAIGNS_CREATED    // campanii Meta create în luna curentă
  VIDEOS_GENERATED     // video-uri generate în luna curentă
  LISTINGS_GENERATED   // listing-uri AI generate în luna curentă
  MEMBERS_ACTIVE       // membri activi în organizație
}

model UsageMetric {
  id             String          @id @default(cuid())
  subscriptionId String
  subscription   Subscription    @relation(fields: [subscriptionId], references: [id])
  organizationId String

  metricType     UsageMetricType
  value          Int             @default(0)

  // Resetat la fiecare billing cycle (luna curentă)
  periodStart    DateTime
  periodEnd      DateTime

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([subscriptionId, metricType, periodStart])
  @@index([organizationId, metricType])
  @@index([periodStart, periodEnd])
}

// ─── Billing History ─────────────────────────────────────────────────────────

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  VOID
  UNCOLLECTIBLE
}

model BillingHistory {
  id              String        @id @default(cuid())
  subscriptionId  String
  subscription    Subscription  @relation(fields: [subscriptionId], references: [id])
  organizationId  String

  stripeInvoiceId String        @unique
  amount          Int           // în bani (RON × 100, centesimi)
  currency        String        @default("ron")
  status          InvoiceStatus
  description     String?

  invoiceUrl      String?       // Stripe hosted invoice URL
  pdfUrl          String?       // Stripe invoice PDF

  paidAt          DateTime?
  dueDate         DateTime?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([organizationId])
  @@index([stripeInvoiceId])
}

// ─── Subscription Invitations ─────────────────────────────────────────────────

model OrganizationInvitation {
  id             String      @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  email          String
  role           MemberRole
  token          String      @unique @default(cuid())
  invitedBy      String      // userId al celui care a invitat
  expiresAt      DateTime    // now() + 7 zile

  acceptedAt     DateTime?
  createdAt      DateTime    @default(now())

  @@unique([organizationId, email])
  @@index([token])
  @@index([email])
}
```

### Adăugare în modelul `Organization`

```prisma
model Organization {
  // ... câmpuri existente ...
  subscription          Subscription?
  invitations           OrganizationInvitation[]
}
```

### Migrare

```bash
cd rise
npx prisma migrate dev --name add_subscription_system
npx prisma generate
```

---

## 4. Stripe Integration

### Variabile de mediu

```env
# .env.local
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Price IDs (create manual în Stripe Dashboard)
STRIPE_PRICE_STARTER=price_rise_starter_monthly_ron
STRIPE_PRICE_GROWTH=price_rise_growth_monthly_ron
STRIPE_PRICE_PRO=price_rise_pro_monthly_ron
```

### Configurare Stripe Dashboard

1. Creează Products: "Rise Starter", "Rise Growth", "Rise Pro"
2. Fiecare cu un Price recurent lunar în RON
3. Activează Customer Portal în Stripe Dashboard → Settings → Billing
4. Setează Customer Portal URL de return: `https://rise.azora.ro/billing`

### `POST /api/billing/checkout`

```typescript
// rise/src/app/api/billing/checkout/route.ts
import Stripe from 'stripe';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICE_MAP: Record<string, string> = {
  STARTER: process.env.STRIPE_PRICE_STARTER!,
  GROWTH:  process.env.STRIPE_PRICE_GROWTH!,
  PRO:     process.env.STRIPE_PRICE_PRO!,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan, organizationId } = await req.json();
  if (!PRICE_MAP[plan]) return NextResponse.json({ error: 'Plan invalid' }, { status: 400 });

  // Verifică că userul aparține organizației
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
  });
  if (!member || member.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Găsește sau creează Stripe Customer
  let subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  let stripeCustomerId = subscription?.stripeCustomerId;

  if (!stripeCustomerId) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const customer = await stripe.customers.create({
      email: session.user.email!,
      name: org?.name,
      metadata: { organizationId, userId: session.user.id },
    });
    stripeCustomerId = customer.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/plans?canceled=true`,
    subscription_data: {
      metadata: { organizationId, plan },
      trial_period_days: subscription?.status === 'TRIALING' ? undefined : 0,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: { address: 'auto' },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

### `POST /api/billing/portal`

```typescript
// rise/src/app/api/billing/portal/route.ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { organizationId } = await req.json();

  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: 'Fără subscripție activă' }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

### `POST /api/billing/webhook`

```typescript
// rise/src/app/api/billing/webhook/route.ts
// IMPORTANT: Dezactivează body parsing pentru această rută!
export const config = { api: { bodyParser: false } };

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata.organizationId;
      const plan = sub.metadata.plan as SubscriptionPlan;

      await prisma.subscription.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0].price.id,
          plan,
          status: mapStripeStatus(sub.status),
          trialStartedAt: sub.trial_start ? new Date(sub.trial_start * 1000) : new Date(),
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : new Date(Date.now() + 14 * 86400000),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
        update: {
          plan,
          status: mapStripeStatus(sub.status),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: { status: 'CANCELED', canceledAt: new Date() },
      });
      // Trimite email "subscripție anulată"
      await sendSubscriptionCanceledEmail(sub.metadata.organizationId);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const sub = await prisma.subscription.findUnique({
        where: { stripeCustomerId: invoice.customer as string },
      });
      if (sub) {
        await prisma.billingHistory.create({
          data: {
            subscriptionId: sub.id,
            organizationId: sub.organizationId,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'PAID',
            description: invoice.description ?? `Abonament Rise — ${sub.plan}`,
            invoiceUrl: invoice.hosted_invoice_url ?? undefined,
            pdfUrl: invoice.invoice_pdf ?? undefined,
            paidAt: new Date(),
          },
        });
        // Resetează usage metrics pentru noul period
        await resetUsageMetrics(sub.id, sub.organizationId);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await prisma.subscription.update({
        where: { stripeCustomerId: invoice.customer as string },
        data: { status: 'PAST_DUE' },
      });
      await sendPaymentFailedEmail(invoice.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function mapStripeStatus(status: string): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    trialing: 'TRIALING',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    paused: 'PAUSED',
  };
  return map[status] ?? 'ACTIVE';
}
```

---

## 5. Feature Gating Middleware

### Plan Limits Config

```typescript
// rise/src/lib/subscription/plans.ts

export type Feature =
  | 'meta_ads_view'
  | 'meta_ads_manage'
  | 'meta_ads_alerts'
  | 'video_creation'
  | 'listing_ai'
  | 'export_reports'
  | 'advanced_analytics'
  | 'multi_member';

export interface PlanLimits {
  maxProducts: number;       // -1 = nelimitat
  maxMembers: number;
  maxVideosPerMonth: number; // -1 = nelimitat
  maxListingsPerMonth: number;
  features: Feature[];
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  STARTER: {
    maxProducts: 20,
    maxMembers: 1,
    maxVideosPerMonth: 0,
    maxListingsPerMonth: 0,
    features: ['meta_ads_view'],
  },
  GROWTH: {
    maxProducts: 100,
    maxMembers: 3,
    maxVideosPerMonth: 10,
    maxListingsPerMonth: 0,
    features: ['meta_ads_view', 'meta_ads_manage', 'video_creation', 'multi_member'],
  },
  PRO: {
    maxProducts: -1,
    maxMembers: 10,
    maxVideosPerMonth: -1,
    maxListingsPerMonth: 20,
    features: [
      'meta_ads_view', 'meta_ads_manage', 'meta_ads_alerts',
      'video_creation', 'listing_ai', 'export_reports',
      'advanced_analytics', 'multi_member',
    ],
  },
  ENTERPRISE: {
    maxProducts: -1,
    maxMembers: -1,
    maxVideosPerMonth: -1,
    maxListingsPerMonth: -1,
    features: [
      'meta_ads_view', 'meta_ads_manage', 'meta_ads_alerts',
      'video_creation', 'listing_ai', 'export_reports',
      'advanced_analytics', 'multi_member',
    ],
  },
};

// Planul minim care include un feature (pentru upsell)
export const FEATURE_MIN_PLAN: Record<Feature, string> = {
  meta_ads_view: 'STARTER',
  meta_ads_manage: 'GROWTH',
  meta_ads_alerts: 'PRO',
  video_creation: 'GROWTH',
  listing_ai: 'PRO',
  export_reports: 'PRO',
  advanced_analytics: 'PRO',
  multi_member: 'GROWTH',
};
```

### `checkFeatureAccess` — Server-side

```typescript
// rise/src/lib/subscription/access.ts
import { prisma } from '@/lib/prisma';
import { PLAN_LIMITS, Feature } from './plans';

export interface AccessResult {
  allowed: boolean;
  reason?: 'NO_SUBSCRIPTION' | 'PLAN_INSUFFICIENT' | 'USAGE_LIMIT_REACHED' | 'SUBSCRIPTION_INACTIVE';
  currentPlan?: string;
  requiredPlan?: string;
  usage?: { current: number; limit: number };
}

export async function checkFeatureAccess(
  organizationId: string,
  feature: Feature
): Promise<AccessResult> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    return { allowed: false, reason: 'NO_SUBSCRIPTION' };
  }

  // Trial = acces complet (Pro)
  if (subscription.status === 'TRIALING') {
    return { allowed: true, currentPlan: 'TRIAL' };
  }

  // Subscripție inactivă
  if (!['ACTIVE'].includes(subscription.status)) {
    return { allowed: false, reason: 'SUBSCRIPTION_INACTIVE', currentPlan: subscription.plan };
  }

  const limits = PLAN_LIMITS[subscription.plan];
  if (!limits.features.includes(feature)) {
    return {
      allowed: false,
      reason: 'PLAN_INSUFFICIENT',
      currentPlan: subscription.plan,
      requiredPlan: FEATURE_MIN_PLAN[feature],
    };
  }

  return { allowed: true, currentPlan: subscription.plan };
}

// Verificare limită de usage (video, listing)
export async function checkUsageLimit(
  organizationId: string,
  metricType: 'VIDEOS_GENERATED' | 'LISTINGS_GENERATED'
): Promise<AccessResult> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: {
      usageMetrics: {
        where: {
          metricType,
          periodStart: { lte: new Date() },
          periodEnd: { gte: new Date() },
        },
      },
    },
  });

  if (!subscription) return { allowed: false, reason: 'NO_SUBSCRIPTION' };
  if (subscription.status === 'TRIALING') return { allowed: true };

  const limits = PLAN_LIMITS[subscription.plan];
  const limitMap = {
    VIDEOS_GENERATED: limits.maxVideosPerMonth,
    LISTINGS_GENERATED: limits.maxListingsPerMonth,
  };
  const maxAllowed = limitMap[metricType];
  if (maxAllowed === -1) return { allowed: true };

  const current = subscription.usageMetrics[0]?.value ?? 0;
  if (current >= maxAllowed) {
    return {
      allowed: false,
      reason: 'USAGE_LIMIT_REACHED',
      usage: { current, limit: maxAllowed },
    };
  }

  return { allowed: true, usage: { current, limit: maxAllowed } };
}
```

### Aplicare în API Routes

```typescript
// Exemplu: POST /api/campaigns (Meta Ads)
export async function POST(req: Request) {
  const session = await auth();
  const { organizationId } = await req.json();

  const access = await checkFeatureAccess(organizationId, 'meta_ads_manage');
  if (!access.allowed) {
    return NextResponse.json({
      error: 'Feature indisponibil',
      reason: access.reason,
      requiredPlan: access.requiredPlan,
    }, { status: 403 });
  }
  // ... restul logicii
}
```

### React Hook — Client-side

```typescript
// rise/src/hooks/useSubscription.ts
import { useQuery } from '@tanstack/react-query';

export function useSubscription(organizationId: string) {
  return useQuery({
    queryKey: ['subscription', organizationId],
    queryFn: () => fetch(`/api/billing/subscription?orgId=${organizationId}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useFeatureAccess(organizationId: string, feature: Feature) {
  const { data: subscription } = useSubscription(organizationId);

  if (!subscription) return { allowed: false, loading: true };
  if (subscription.status === 'TRIALING') return { allowed: true };

  const limits = PLAN_LIMITS[subscription.plan];
  return {
    allowed: limits.features.includes(feature),
    currentPlan: subscription.plan,
    requiredPlan: FEATURE_MIN_PLAN[feature],
  };
}
```

---

## 6. UI Pages

### `/billing` — Pagina de Billing Principală

```
┌─────────────────────────────────────────────────────────────┐
│  PLAN CURENT                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🟢 Growth — 299 RON/lună                            │   │
│  │  Perioadă: 1 Apr – 30 Apr 2026                      │   │
│  │  [Gestionează abonamentul] [Upgrade la Pro]          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  UTILIZARE LUNA CURENTĂ                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Produse  │  │ Campanii │  │ Video-uri│                   │
│  │  45/100  │  │   8      │  │  6/10    │                   │
│  │ ████░░░  │  │ nelimitat│  │ ██████░░ │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
│                                                              │
│  ISTORIC FACTURI                                             │
│  Apr 2026 — 299 RON — [Descarcă PDF]                        │
│  Mar 2026 — 299 RON — [Descarcă PDF]                        │
└─────────────────────────────────────────────────────────────┘
```

**Fișier:** `rise/src/app/(dashboard)/billing/page.tsx`

### `/billing/plans` — Comparație Planuri

Tabel complet cu toate planurile, planul curent highlight, butoane de upgrade/downgrade per plan. Folosește shadcn/ui `Card` + badge "Plan curent".

**Fișier:** `rise/src/app/(dashboard)/billing/plans/page.tsx`

### Trial Banner (component global)

Afișat în `layout.tsx` atunci când `subscription.status === 'TRIALING'`:

```
⏳ Ai 11 zile rămase din trial gratuit.  [Alege un plan →]
```

Dispare cu 3 zile înainte de expirare și devine:

```
🔴 Trialul expiră în 3 zile! Upgrade acum pentru a nu pierde accesul.  [Alege un plan →]
```

---

## 7. Upgrade Prompts — Locked Feature UI

### Pattern standard pentru feature locked

```typescript
// rise/src/components/FeatureGate.tsx
interface FeatureGateProps {
  feature: Feature;
  children: React.ReactNode;
  organizationId: string;
}

export function FeatureGate({ feature, children, organizationId }: FeatureGateProps) {
  const { allowed, requiredPlan } = useFeatureAccess(organizationId, feature);

  if (allowed) return <>{children}</>;

  return (
    <div className="relative">
      {/* Conținut blurat */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <LockIcon className="mx-auto mb-3 text-muted-foreground" size={32} />
          <h3 className="font-semibold text-lg mb-2">Feature disponibil în planul {requiredPlan}</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {FEATURE_DESCRIPTIONS[feature]}
          </p>
          <Button asChild>
            <Link href="/billing/plans">Upgrade la {requiredPlan}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Mesaje per feature

```typescript
const FEATURE_DESCRIPTIONS: Record<Feature, string> = {
  meta_ads_manage: 'Crearea și editarea campaniilor Meta Ads este disponibilă din planul Growth. Vizualizarea campaniilor existente este disponibilă în planul tău.',
  meta_ads_alerts: 'Alertele automate Meta Ads îți trimit notificări când o campanie sub-performează. Disponibil în planul Pro.',
  video_creation: 'Generarea video-urilor AI pentru campanii este disponibilă din planul Growth. Include 10 video-uri/lună.',
  listing_ai: 'Product Listing Creator generează automat titluri, descrieri și bullet points optimizate SEO. Disponibil în planul Pro.',
  export_reports: 'Exportul rapoartelor în CSV și PDF este disponibil în planul Pro.',
  advanced_analytics: 'Analytics avansate cu breakdown per canal și cohort analysis. Disponibil în planul Pro.',
  multi_member: 'Invitarea membrilor în organizație este disponibilă din planul Growth.',
};
```

### Usage Limit Prompt (în loc de locked)

Când limita lunară e atinsă (ex: 10/10 video-uri în Growth):

```
Ai folosit toate cele 10 video-uri din luna curentă.
Upgrade la Pro pentru video-uri nelimitate.
[Upgrade la Pro] sau [Continuă luna viitoare]
```

---

## 8. Onboarding Flow — Self-Serve

### Flux complet

```
1. Landing page (rise.azora.ro)
   ↓ Click "Încearcă gratuit 14 zile"
2. Sign up form
   - Email + parolă
   - Nume magazin
   - URL Shopify (optional la signup, necesar pentru sync)
   ↓
3. Email verification (NextAuth + Resend)
   ↓
4. Onboarding wizard (existent din Sub-project 7)
   - Step 1: Conectare Shopify
   - Step 2: Import produse
   - Step 3: Setup Meta connection
   ↓ Wizard completat
5. Dashboard principal (trial activ)
   - Trial banner: "14 zile gratuite — toate features Pro"
   - Checklist onboarding (sidebar): ✅ Shopify conectat, ✅ Produse importate, etc.
   ↓ Ziua 11
6. Email: "Mai ai 3 zile de trial" → CTA upgrade
   ↓ Ziua 14 sau click upgrade
7. /billing/plans → alegere plan → Stripe Checkout
   ↓ Plată reușită
8. Redirect /billing?success=true → Dashboard activ
```

### Creare automată Subscription la Sign Up

```typescript
// În NextAuth callbacks, după crearea utilizatorului nou:
async function createInitialSubscription(organizationId: string) {
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Creează Stripe Customer fără payment method
  const customer = await stripe.customers.create({
    metadata: { organizationId },
  });

  await prisma.subscription.create({
    data: {
      organizationId,
      stripeCustomerId: customer.id,
      plan: 'PRO', // Trial = acces Pro complet
      status: 'TRIALING',
      trialStartedAt: new Date(),
      trialEndsAt,
    },
  });
}
```

### Post-Trial: Ce se întâmplă dacă nu fac upgrade?

- Status devine `CANCELED` automat (cron job zilnic)
- Dashboard redirecționează la `/billing/plans` cu mesaj explicativ
- Datele sunt **păstrate 30 de zile** (grace period)
- Email la ziua 1 post-trial: "Trialul a expirat — datele tale sunt salvate"
- Email la ziua 25: "Contul va fi șters în 5 zile dacă nu faci upgrade"

---

## 9. Multi-Tenant Readiness

### Starea Curentă (Phase 1 — Single-Tenant)

Rise Phase 1 funcționează cu un singur utilizator (Azora.ro). Izolarea datelor se face exclusiv la **application layer**: fiecare query Prisma include `where: { organizationId }`. Aceasta este o regulă strictă — nicio query fără `organizationId` filter.

### Migrarea Azora.ro la Multi-Tenant (fără downtime)

**Pasul 1: Creare Organization pentru Azora.ro**

```sql
-- Migrare SQL directă (o singură dată)
INSERT INTO "Organization" (id, name, slug, "incomeTaxType", "shopifyFeeRate")
VALUES ('org_azora', 'Azora.ro', 'azora', 'INCOME_10', 0.02)
ON CONFLICT DO NOTHING;

-- Creare Subscription trial pentru Azora.ro
INSERT INTO "Subscription" (id, "organizationId", "stripeCustomerId", plan, status, "trialStartedAt", "trialEndsAt")
VALUES ('sub_azora', 'org_azora', 'cus_stripe_azora', 'ENTERPRISE', 'ACTIVE', NOW(), '2099-12-31')
ON CONFLICT DO NOTHING;
```

**Pasul 2: Seed User Azora ca OWNER**

```typescript
// Scriptul de migrare
await prisma.organizationMember.upsert({
  where: { organizationId_userId: { organizationId: 'org_azora', userId: AZORA_USER_ID } },
  create: { organizationId: 'org_azora', userId: AZORA_USER_ID, role: 'OWNER' },
  update: {},
});
```

**Pasul 3: Deploy nou cu multi-tenant enabled**

- Noul cod verifică `organizationId` pe toate queries (era deja implementat)
- Azora.ro nu observă nicio schimbare în UI
- Alți utilizatori pot acum să se înregistreze

**Pasul 4: Supabase RLS (Phase 2 upgrade)**

```sql
-- Activare RLS pe tabelele principale
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;

-- Policy: utilizatorul vede doar datele organizației sale
CREATE POLICY "org_isolation" ON "Product"
  USING (
    "organizationId" IN (
      SELECT "organizationId" FROM "OrganizationMember"
      WHERE "userId" = auth.uid()
    )
  );
```

**NOTĂ:** RLS cu Supabase necesită migrarea de la Prisma connection string la Supabase SDK sau pg cu JWT. Aceasta e o schimbare arhitecturală semnificativă — planificată pentru o iterație separată post-Phase 2.

### Invitare Membri în Organizație

```typescript
// POST /api/organizations/[orgId]/invitations
export async function POST(req: Request, { params }) {
  const session = await auth();
  const { email, role } = await req.json();

  // Verifică că invitantul e OWNER sau ADMIN
  const inviter = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: params.orgId, userId: session.user.id } },
  });
  if (!inviter || inviter.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verifică limita de membri
  const access = await checkFeatureAccess(params.orgId, 'multi_member');
  if (!access.allowed) {
    return NextResponse.json({ error: 'Upgrade plan pentru mai mulți membri' }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await prisma.organizationInvitation.create({
    data: { organizationId: params.orgId, email, role, invitedBy: session.user.id, expiresAt },
  });

  await sendInvitationEmail(email, invitation.token, params.orgId);
  return NextResponse.json({ success: true });
}
```

### Accept Invitation

```typescript
// GET /api/invitations/[token]/accept
// Verifică token-ul, creează OrganizationMember, marchează invitation ca acceptată
// Redirect la dashboard organizație
```

---

## 10. Email Notifications

**Provider recomandat:** Resend (free tier 100 email/zi, React Email templates)

### Template-uri necesare

| Email | Trigger | Conținut |
|-------|---------|---------|
| `trial-started` | La sign up | Bun venit, 14 zile trial, link dashboard |
| `trial-3days` | Cu 3 zile înainte de expirare | Urgență, features care vor fi pierdute, CTA upgrade |
| `trial-expired` | La ziua 14 fără upgrade | Date salvate, CTA upgrade, grace period 30 zile |
| `payment-success` | invoice.paid webhook | Confirmare plată, link PDF factură |
| `payment-failed` | invoice.payment_failed | Problemă plată, link actualizare card |
| `subscription-canceled` | subscription.deleted | Confirmare anulare, ce se întâmplă cu datele |
| `invitation` | La invitare membru | Link accept invitație, valabil 7 zile |
| `upgrade-reminder` | La 80% usage limită | "Ai folosit 8/10 video-uri — upgrade pentru mai mult" |

### Cron Jobs pentru Emailuri

```typescript
// rise/src/app/api/cron/subscription-reminders/route.ts
// Rulat zilnic via Vercel Cron / cron job pe VPS

export async function GET(req: Request) {
  // Verifică API key secret pentru securitate
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Trial-uri care expiră în 3 zile
  const expiringSoon = await prisma.subscription.findMany({
    where: {
      status: 'TRIALING',
      trialEndsAt: { gte: now, lte: in3Days },
    },
    include: { organization: { include: { members: { include: { user: true } } } } },
  });

  for (const sub of expiringSoon) {
    const owner = sub.organization.members.find(m => m.role === 'OWNER');
    if (owner?.user.email) {
      await sendTrialExpiringEmail(owner.user.email, sub.trialEndsAt);
    }
  }

  // Subscripții expirate (trial fără upgrade)
  const expired = await prisma.subscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lt: now } },
  });
  for (const sub of expired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELED' },
    });
    // Trimite email trial expirat
  }

  return NextResponse.json({ processed: expiringSoon.length + expired.length });
}
```

---

## 11. Metrici SaaS

### Dashboard intern `/admin/metrics` (acces restricționat)

**MRR (Monthly Recurring Revenue)**
```typescript
const mrr = await prisma.subscription.aggregate({
  where: { status: 'ACTIVE' },
  _sum: { /* calculate from plan prices */ },
});
```

| Metrică | Formula | Target 6 luni |
|---------|---------|---------------|
| **MRR** | Σ(prețuri planuri active) | 10.000 RON |
| **ARR** | MRR × 12 | 120.000 RON |
| **Churn Rate** | Abonamente anulate / total × 100 | < 5%/lună |
| **Trial-to-Paid** | Upgrades / Trials × 100 | > 30% |
| **ARPU** | MRR / clienți activi | 350 RON |
| **LTV** | ARPU / Churn Rate | 7.000 RON |

### Feature Adoption Tracking

```typescript
// Event tracking la fiecare feature utilizat
await prisma.usageEvent.create({
  data: {
    organizationId,
    feature: 'video_creation',
    action: 'generated',
    metadata: { templateId, duration },
  },
});
```

Metrici de urmărit:
- % organizații care au folosit Video Creation cel puțin o dată în 30 zile
- % organizații care au depășit 50% din limita lunară (upsell trigger)
- Feature-uri cu adoption > 70% = core features
- Feature-uri cu adoption < 20% = candidați pentru tutorial/onboarding îmbunătățit

### Stripe Revenue Dashboard

Folosire Stripe Dashboard nativ pentru:
- MRR/ARR breakdown
- Churn visualization
- Revenue per plan
- Failed payment rate

---

## 12. Go-to-Market — Primii 10 Clienți

### Segmentare țintă

**Profil client ideal (ICP):**
- Magazin Shopify românesc activ, 6+ luni pe piață
- Revenue 20k–200k RON/lună
- Rulează deja Facebook/Instagram Ads (chiar și cu agenție)
- Owner implicat tehnic sau are un VA/marketer intern

### Canale de achiziție

**Canal 1: Facebook Groups (gratuit, efort mediu)**
- Grupuri țintă: "Shopify România", "E-commerce România", "Antreprenori Online România"
- Abordare: value-first posts (ex: "Cum calculez profitabilitatea reală pe produs Shopify — calculatorul meu gratuit") → comentarii → mesaj privat
- Mesaj direct: "Am construit un tool care calculează automat profitabilitatea per produs Shopify, sincronizat cu Meta Ads. Trial 14 zile gratuit, fără card."
- Timeline: primele 5 clienți în 2 săptămâni

**Canal 2: Shopify Partner Ecosystem**
- Înregistrare pe Shopify App Store (listare gratuită inițial)
- Descriere axată pe pain point: "See exactly which products make money and which don't"
- Reviews din primii 5 clienți = traction pentru App Store

**Canal 3: LinkedIn — Outreach direct**
- Search: "Shopify" + "România" + "e-commerce manager/owner"
- Mesaj personalizat cu referire la magazinul lor specific
- Offer: 30 minute demo call + 1 lună gratis dacă lasă review

**Canal 4: Recomandări (0 cost, high conversion)**
- Fiecare client activ are buton "Invită un prieten — amândoi primiți o lună gratis"
- Referral program simplu: link unic, discount aplicat automat prin Stripe coupons

### Mesaj de vânzare (elevator pitch)

> "Rise calculează automat cât câștigai real per produs după Shopify fees, Meta Ads și TVA — sincronizat live. Magazinele care folosesc Rise identifică în prima săptămână 1-3 produse pe care pierdeau bani fără să știe. Trial 14 zile, fără card."

### Timeline go-to-market

| Săptămână | Obiectiv | Acțiuni |
|-----------|----------|---------|
| S1 | Setup | Stripe live, onboarding wizard, landing page |
| S2 | Primii 3 clienți | Outreach Facebook Groups, demo calls |
| S3-4 | 5 clienți | Shopify App Store listing, referral program |
| S5-8 | 10 clienți | LinkedIn outreach, first reviews, iterate onboarding |
| S3 luni | 25 clienți | MRR ~7.500 RON, primele upgrade-uri Starter→Growth |
| S6 luni | 50 clienți | MRR ~15.000 RON, Churn < 5% validat |

---

## 13. Sugestii de Îmbunătățire

### A. Pricing Optimization

**Testare A/B pe landing page:**
- Varianta A: Preț în RON (99/299/599) — pentru piața locală
- Varianta B: Preț în EUR (20€/60€/120€) — poziționare premium, pentru magazinele care exportă

**Annual billing (discount 2 luni):**
```
Starter anual: 990 RON (economisești 198 RON)
Growth anual: 2.990 RON (economisești 598 RON)
Pro anual: 5.990 RON (economisești 1.198 RON)
```
Annual billing reduce churn și îmbunătățește cash flow-ul.

### B. Usage-Based Pricing (post-validare)

Dacă magazinele mari consumă mult mai mult decât limitele de plan:
- Video-uri suplimentare: 5 RON/video (peste limita Growth)
- Listing-uri suplimentare: 3 RON/listing (peste limita Pro)
Implementat ca Stripe Metered Billing.

### C. Freemium Tier (alternativă la trial)

În loc de trial 14 zile, un tier permanent gratuit:
- 5 produse sync, doar vizualizare profitabilitate
- Fără Meta Ads, fără video
- Motivație: viral loop — owner-ul invită alți owner-i pentru comparații

### D. Partner Program pentru Agenții

Agenții de marketing digital care gestionează multiple magazine Shopify:
- Discount 30% pe planuri pentru magazine gestionate prin agenție
- Dashboard agenzie: vedere aggregată peste toate magazinele client
- White label (Enterprise): rebrand complet ca platformă proprie

### E. Integrare cu Alte Platforme

Post-validare pe Shopify:
- WooCommerce (plug-in WordPress) — piața românească mare
- TikTok Shop integration (aliniat cu TikTok Ads)
- Google Ads (campaniile Google Shopping)

### F. AI Pricing Assistant

Feature Pro/Enterprise: "Recomandă prețul optim" — bazat pe:
- Marja curentă
- Prețuri competitori (scraping public)
- Elasticitate preț din istoricul comenzilor Shopify

---

## Anexă: Checklist de Implementare

### Sprint 1 — Foundation (2 săptămâni)
- [ ] Adăugare schema Prisma (Subscription, UsageMetric, BillingHistory, OrganizationInvitation)
- [ ] Rulare migrare Prisma
- [ ] Configurare Stripe: products, prices, customer portal, webhooks
- [ ] Implementare `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook`
- [ ] `checkFeatureAccess` + `checkUsageLimit` funcții
- [ ] Creare automată Subscription la signup (trial 14 zile)
- [ ] Migrare Azora.ro la primul Organization (SQL script)

### Sprint 2 — UI (1 săptămână)
- [ ] `/billing` page cu plan curent + usage meters
- [ ] `/billing/plans` page cu comparație planuri
- [ ] `<FeatureGate>` component cu blur overlay
- [ ] Trial banner în layout.tsx
- [ ] Usage limit prompts (la 80% și 100%)

### Sprint 3 — Email + Cron (3 zile)
- [ ] Setup Resend + React Email
- [ ] Template-uri email (trial-started, trial-3days, payment-success, etc.)
- [ ] Cron job zilnic pentru remindere trial
- [ ] Cron job pentru reset usage metrics la nou billing cycle

### Sprint 4 — Multi-tenant (1 săptămână)
- [ ] Invitare membri în organizație (UI + API)
- [ ] Accept invitation flow
- [ ] Limitare număr membri per plan
- [ ] Test izolare date între organizații diferite

### Sprint 5 — Analytics + GTM (1 săptămână)
- [ ] Admin dashboard `/admin/metrics`
- [ ] Referral program (Stripe coupons)
- [ ] Landing page cu CTA trial gratuit
- [ ] Shopify App Store listing

---

## Note de Implementare Importante

1. **Webhook idempotency:** Stripe poate trimite același webhook de mai multe ori. Fiecare handler trebuie să fie idempotent (upsert în loc de create, verificare `stripeInvoiceId` deja existent).

2. **Stripe în RON:** Stripe suportă RON (cod valută: `ron`). Sumele sunt în **bani** (1 RON = 100 bani). Afișare în UI: `amount / 100` RON.

3. **Trial fără card de credit:** Configurat în Stripe Checkout cu `payment_method_collection: 'if_required'` + `trial_period_days`. La trial start nu se colectează card — se colectează doar la upgrade.

4. **GDPR:** La ștergerea unui cont (grace period expirat), date șterse conform GDPR. Facturile se păstrează 5 ani (obligație fiscală). Implementa `anonymizeOrganization()` care șterge datele personale dar păstrează facturile cu ID anonim.

5. **Testare Stripe local:** Folosire `stripe listen --forward-to localhost:3000/api/billing/webhook` pentru development. Adaugă `STRIPE_WEBHOOK_SECRET` din output-ul comenzii în `.env.local`.

6. **RLS timing:** Supabase RLS adaugă overhead la queries. Nu migra la RLS înainte de a valida că baza de date Supabase (nu localhost PostgreSQL) este folosită în producție. Phase 1 = application-layer filtering este suficient și mai performant.
