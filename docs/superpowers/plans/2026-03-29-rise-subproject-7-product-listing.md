# Rise — Sub-proiectul 7: Product Listing Creator

**Data:** 2026-03-29
**Status:** Planificat (post-subscripții — Sub-proiect 6)
**Mod:** PREMIUM (feature gating prin sistemul de subscripții)

---

## 1. Overview și Obiective

### De ce automatizăm crearea listing-urilor?

Procesul manual de creare a unui produs pe Azora.ro durează în medie **45–90 minute**:

| Pas manual | Timp estimat |
|---|---|
| Deschide URL furnizor, citește descrierea | 5–10 min |
| Reformulează în română, stil Azora | 20–35 min |
| Salvează imagini, le încarci pe Shopify | 10–15 min |
| Completezi titlu SEO, tags, categorie | 5–10 min |
| Publici și verifici în Shopify Admin | 5–10 min |
| **Total** | **45–90 min/produs** |

La un volum de 10–20 produse noi pe lună, înseamnă **7–30 ore/lună** de muncă repetitivă.

### Obiectiv Product Listing Creator

Reduce timpul per produs la **5–10 minute** (review + aprobare umană), cu 80–90% din muncă automatizată de AI.

**Time saving estimat:** 35–80 ore/lună economisite → echivalentul unui part-time freelancer.

### Ce face Sub-proiectul 7

1. User introduce URL produs (furnizor chinezesc, AliExpress, competitor, etc.) + prețul Azora
2. Firecrawl scrape-uiește pagina și extrage date structurate
3. Claude generează titlu SEO + descriere HTML completă în stil AZORA + tags + categorie
4. User vede preview, editează dacă dorește, poate regenera
5. User aprobă → publică direct pe Shopify ca draft
6. Produsul apare instant în Rise Products (lista Shopify sincronizată)

### Feature Gating — Mod PREMIUM

> **IMPORTANT:** Product Listing Creator este disponibil **exclusiv pe planul Premium** (post Sub-proiect 6 — Subscripții).
>
> - Plan Free / Trial: butonul "Creează Listing" este vizibil dar dezactivat, cu tooltip "Disponibil pe planul Premium"
> - Plan Premium: acces complet
> - Implementare tehnică: middleware `requirePremium()` pe toate rutele `/api/listings/*` și pe pagina `/listings`
> - UI: badge "PREMIUM" lângă item-ul din sidebar

```typescript
// rise/src/features/subscriptions/guards.ts
export async function requirePremium(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { planTier: true, planExpiresAt: true },
  });
  if (!org || org.planTier !== "PREMIUM") {
    throw new Error("PREMIUM_REQUIRED");
  }
  if (org.planExpiresAt && org.planExpiresAt < new Date()) {
    throw new Error("PLAN_EXPIRED");
  }
}
```

---

## 2. Schema Prisma Completă

### Adăugări la `rise/prisma/schema.prisma`

```prisma
// ============================================================
// SUB-PROIECT 7 — Product Listing Creator
// ============================================================

model ProductDraft {
  id              String      @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Sursă
  sourceUrl       String      // URL-ul furnizorului/competitorului scrape-uit
  scrapedRaw      Json?       // Datele brute de la Firecrawl/Jina (pentru debugging)

  // Conținut generat (câmpurile active/aprobate)
  title           String
  descriptionHtml String      @db.Text  // HTML complet generat de Claude
  price           Float       // Prețul de vânzare Azora (RON)
  compareAtPrice  Float?      // Prețul barat (RON), opțional
  images          String[]    // URLs imagini (ordine selectată de user)
  tags            String[]    // Tags Shopify
  shopifyCategory String?     // Categoria Shopify sugerată/confirmată
  vendor          String?     // Vendor Shopify (implicit "Azora")

  // Status lifecycle
  status          DraftStatus @default(PENDING_REVIEW)

  // Publicare Shopify
  shopifyProductId String?    // ID produs după publicare pe Shopify
  shopifyProductUrl String?   // URL admin Shopify după publicare
  publishedAt     DateTime?

  // Erori
  errorMessage    String?

  // Versiuni (istoricul regenerărilor Claude)
  versions        DraftVersion[]
  currentVersion  Int         @default(1) // Index la versiunea activă

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([organizationId, status])
  @@index([organizationId, createdAt])
}

model DraftVersion {
  id              String      @id @default(cuid())
  draftId         String
  draft           ProductDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

  versionNumber   Int         // 1, 2, 3 (max 3 versiuni)

  // Snapshot al conținutului generat la momentul regenerării
  title           String
  descriptionHtml String      @db.Text
  tags            String[]
  shopifyCategory String?

  // Metadata generare
  promptUsed      String?     @db.Text  // Prompt-ul trimis lui Claude (pentru debugging)
  modelUsed       String?     // claude-opus-4-6
  generatedAt     DateTime    @default(now())
  tokensUsed      Int?        // Token count pentru monitoring costuri

  @@unique([draftId, versionNumber])
  @@index([draftId])
}

enum DraftStatus {
  PENDING_REVIEW  // Generat, așteaptă review
  APPROVED        // Aprobat de user, gata de publicare
  PUBLISHED       // Publicat pe Shopify
  FAILED          // Eroare la scraping sau generare
}
```

### Relație cu Organization (adăugare la modelul existent)

```prisma
// Adaugă în modelul Organization existent:
model Organization {
  // ... câmpuri existente ...
  productDrafts   ProductDraft[]
}
```

### Migrare

```bash
cd rise
npx prisma migrate dev --name add-product-listing-creator
```

---

## 3. Serviciul `listing-generator.ts` Complet

**Fișier:** `rise/src/features/listings/services/listing-generator.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ============================================================
// TIPURI
// ============================================================

export interface ScrapedProduct {
  title: string;
  description: string;        // Text descriptiv brut (poate fi markdown sau HTML)
  specifications: string;     // Specificații tehnice (tabel sau listă)
  images: string[];           // URLs imagini extrase
  price?: string;             // Prețul original (informatív, nu se folosește)
  brand?: string;
  category?: string;
  rawMarkdown?: string;       // Markdown complet (de la Jina fallback)
}

export interface GeneratedListing {
  title: string;              // Titlu SEO optimizat, fără diacritice
  descriptionHtml: string;    // HTML complet în stil AZORA
  tags: string[];             // Tags Shopify (5-10 tags)
  shopifyCategory: string;    // Categoria sugerată
  tokensUsed: number;
}

export interface GenerateListingInput {
  sourceUrl: string;
  targetPrice: number;        // RON
  compareAtPrice?: number;    // RON
  organizationId: string;
}

// ============================================================
// PASUL 1: SCRAPING
// ============================================================

/**
 * Scrape-uiește URL-ul cu Firecrawl (structurat) sau Jina AI (fallback text).
 * Returnează date structurate despre produs.
 */
export async function scrapeProductUrl(url: string): Promise<{
  product: ScrapedProduct;
  method: "firecrawl" | "jina";
}> {
  // Încearcă Firecrawl primul (structurat, mai precis)
  try {
    const firecrawlResult = await scrapeWithFirecrawl(url);
    return { product: firecrawlResult, method: "firecrawl" };
  } catch (firecrawlError) {
    console.warn("[listing-generator] Firecrawl failed, falling back to Jina:", firecrawlError);

    // Fallback: Jina AI Reader (text markdown simplu)
    try {
      const jinaResult = await scrapeWithJina(url);
      return { product: jinaResult, method: "jina" };
    } catch (jinaError) {
      throw new Error(
        `Scraping failed for ${url}. Firecrawl: ${firecrawlError}. Jina: ${jinaError}`
      );
    }
  }
}

async function scrapeWithFirecrawl(url: string): Promise<ScrapedProduct> {
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "extract"],
      extract: {
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            specifications: { type: "string" },
            brand: { type: "string" },
            category: { type: "string" },
            images: { type: "array", items: { type: "string" } },
            price: { type: "string" },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 402 || body.includes("credits")) {
      throw new Error("FIRECRAWL_CREDITS_EXHAUSTED");
    }
    throw new Error(`Firecrawl HTTP ${response.status}: ${body}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Firecrawl error: ${data.error || "Unknown"}`);
  }

  const extracted = data.data?.extract || {};
  const markdown = data.data?.markdown || "";

  // Extrage imagini din markdown dacă nu sunt în extract
  const imageUrls: string[] = extracted.images?.length
    ? extracted.images
    : extractImagesFromMarkdown(markdown);

  return {
    title: extracted.title || "",
    description: extracted.description || markdown.slice(0, 3000),
    specifications: extracted.specifications || "",
    images: imageUrls.slice(0, 20), // Max 20 imagini
    price: extracted.price,
    brand: extracted.brand,
    category: extracted.category,
    rawMarkdown: markdown,
  };
}

async function scrapeWithJina(url: string): Promise<ScrapedProduct> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  const response = await fetch(jinaUrl, {
    headers: {
      "Accept": "application/json",
      "X-Return-Format": "markdown",
      ...(process.env.JINA_API_KEY
        ? { "Authorization": `Bearer ${process.env.JINA_API_KEY}` }
        : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Jina HTTP ${response.status}`);
  }

  const markdown = await response.text();
  const imageUrls = extractImagesFromMarkdown(markdown);

  // Jina returnează text brut — Claude va extrage structura
  return {
    title: extractTitleFromMarkdown(markdown),
    description: markdown.slice(0, 5000),
    specifications: "",
    images: imageUrls.slice(0, 20),
    rawMarkdown: markdown,
  };
}

function extractImagesFromMarkdown(markdown: string): string[] {
  const regex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const urls: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const url = match[1];
    // Filtrează icoane mici, tracking pixels, etc.
    if (!url.includes("icon") && !url.includes("pixel") && !url.includes("logo")) {
      urls.push(url);
    }
  }
  return [...new Set(urls)]; // Deduplică
}

function extractTitleFromMarkdown(markdown: string): string {
  const lines = markdown.split("\n").filter((l) => l.trim());
  // Prima linie H1 sau primul text semnificativ
  for (const line of lines.slice(0, 10)) {
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) return h1[1].trim();
    if (line.length > 10 && !line.startsWith("http")) return line.trim();
  }
  return "Produs nou";
}

// ============================================================
// PASUL 2: GENERARE CLAUDE
// ============================================================

/**
 * Generează un listing complet în stil AZORA folosind Claude claude-opus-4-6.
 * Returnează titlu SEO, HTML descriere, tags și categorie Shopify.
 */
export async function generateAzoraListing(
  scraped: ScrapedProduct,
  targetPrice: number,
  compareAtPrice?: number,
  existingVersions: number = 0 // Numărul de regenerări anterioare
): Promise<GeneratedListing> {
  const AZORA_CATEGORIES = [
    "Beauty & Wellness",
    "Cadouri",
    "Dispozitive",
    "Copii",
    "Fitness",
    "Ingrijire Ten",
    "Ingrijire Par",
    "Electrocasnice Mici",
    "Accesorii",
  ];

  const systemPrompt = buildAzoraSystemPrompt(AZORA_CATEGORIES);

  const userPrompt = buildUserPrompt(scraped, targetPrice, compareAtPrice, existingVersions);

  const message = await claude.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const tokensUsed =
    (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0);

  return parseClaudeResponse(responseText, tokensUsed);
}

function buildUserPrompt(
  scraped: ScrapedProduct,
  targetPrice: number,
  compareAtPrice?: number,
  regenerationCount: number = 0
): string {
  const priceContext = compareAtPrice
    ? `Prețul de vânzare: ${targetPrice} RON (redus de la ${compareAtPrice} RON)`
    : `Prețul de vânzare: ${targetPrice} RON`;

  const regenerationNote =
    regenerationCount > 0
      ? `\n⚠️ REGENERARE #${regenerationCount}: Scrie o versiune DIFERITĂ față de cele anterioare. Variază unghiul emoțional, alege alt hook, reformulează beneficiile altfel.\n`
      : "";

  return `${regenerationNote}
Generează un listing complet pentru acest produs:

TITLU ORIGINAL: ${scraped.title || "N/A"}
BRAND: ${scraped.brand || "Necunoscut"}
CATEGORIE SURSĂ: ${scraped.category || "N/A"}
${priceContext}

DESCRIERE ORIGINALĂ:
${scraped.description || "Nu există descriere"}

SPECIFICAȚII TEHNICE:
${scraped.specifications || "Nu există specificații"}

IMAGINI DISPONIBILE (${scraped.images.length} imagini):
${scraped.images.slice(0, 5).map((url, i) => `  ${i + 1}. ${url}`).join("\n")}
${scraped.images.length > 5 ? `  ... și alte ${scraped.images.length - 5} imagini` : ""}

Urmează exact structura și regulile din system prompt. Returnează JSON valid.
`.trim();
}

function parseClaudeResponse(
  responseText: string,
  tokensUsed: number
): GeneratedListing {
  // Extrage blocul JSON din răspuns
  const jsonMatch = responseText.match(/```json\s*([\s\S]+?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  try {
    const parsed = JSON.parse(jsonText.trim());
    return {
      title: parsed.title || "",
      descriptionHtml: parsed.descriptionHtml || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      shopifyCategory: parsed.shopifyCategory || "Diverse",
      tokensUsed,
    };
  } catch {
    throw new Error(
      `Claude a returnat un JSON invalid. Răspuns brut: ${responseText.slice(0, 500)}`
    );
  }
}

// ============================================================
// PASUL 3: ORCHESTRARE — creare draft complet
// ============================================================

/**
 * Funcția principală: scrape + generate + salvare în DB.
 * Apelată de API route POST /api/listings/generate.
 */
export async function createProductDraft(
  input: GenerateListingInput
): Promise<{ draftId: string; draft: object }> {
  const { sourceUrl, targetPrice, compareAtPrice, organizationId } = input;

  // 1. Crează draft în stare intermediară
  const draft = await prisma.productDraft.create({
    data: {
      organizationId,
      sourceUrl,
      price: targetPrice,
      compareAtPrice,
      title: "Se generează...",
      descriptionHtml: "",
      status: "PENDING_REVIEW",
    },
  });

  try {
    // 2. Scraping
    const { product: scraped, method } = await scrapeProductUrl(sourceUrl);

    // 3. Generare Claude
    const generated = await generateAzoraListing(scraped, targetPrice, compareAtPrice, 0);

    // 4. Salvează versiunea 1
    await prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        title: generated.title,
        descriptionHtml: generated.descriptionHtml,
        tags: generated.tags,
        shopifyCategory: generated.shopifyCategory,
        modelUsed: "claude-opus-4-6",
        tokensUsed: generated.tokensUsed,
      },
    });

    // 5. Update draft cu datele generate
    const updatedDraft = await prisma.productDraft.update({
      where: { id: draft.id },
      data: {
        title: generated.title,
        descriptionHtml: generated.descriptionHtml,
        tags: generated.tags,
        shopifyCategory: generated.shopifyCategory,
        images: scraped.images,
        scrapedRaw: { method, ...scraped } as object,
        currentVersion: 1,
        status: "PENDING_REVIEW",
      },
    });

    return { draftId: draft.id, draft: updatedDraft };
  } catch (error) {
    // Marchează draft-ul ca FAILED
    await prisma.productDraft.update({
      where: { id: draft.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
```

---

## 4. Prompt-ul AZORA Complet pentru Claude

**Funcția `buildAzoraSystemPrompt`** — definește regulile complete de generare.

```typescript
// rise/src/features/listings/services/listing-generator.ts (continuare)

function buildAzoraSystemPrompt(categories: string[]): string {
  return `
Ești un copywriter expert pentru Azora.ro — magazin românesc de beauty, wellness, dispozitive și cadouri.
Scrii listing-uri de produs care convertesc emoțional și sunt optimizate SEO pentru Shopify.

════════════════════════════════════════════════════════════════
REGULI ABSOLUTE (respectă 100%)
════════════════════════════════════════════════════════════════

1. **FĂRĂ DIACRITICE** — Scrie STRICT fără ș, ț, ă, â, î.
   Corect: "cu siguranta", "pentru tine", "acasa", "inainte"
   Gresit: "cu siguranță", "pentru tine", "acasă", "înainte"

2. **TON EMPATIC, ORIENTAT SPRE BENEFICII EMOȚIONALE**
   - Vorbești direct cu clienta ("Tu", "tine", "tau")
   - Accent pe cum SE SIMTE clienta, nu pe specificații
   - Transformă feature-uri în beneficii emoționale
   - Folosește "tu" informal, nu "dumneavoastră"

3. **FARA EXAGERĂRI MEDICALE** — Nu promite vindecări, tratamente sau efecte garantate.
   Gresit: "vindecă definitiv acneea", "garantăm că..."
   Corect: "ajuta la reducerea imperfectiunilor", "multi clienti au observat..."

4. **TITLU SEO** — Max 70 caractere, include keyword principal, fără diacritice.
   Format recomandat: "[Produs principal] – [Beneficiu principal] | Azora"
   Exemplu: "Dispozitiv LED Anti-Acnee – Ten Curat Acasa | Azora"

5. **RETURNEZI OBLIGATORIU JSON VALID** în blocul ```json ... ```

════════════════════════════════════════════════════════════════
STRUCTURA DESCRIERE HTML (urmează exact această ordine)
════════════════════════════════════════════════════════════════

### SECȚIUNEA 1 — HOOK (primul paragraf, cel mai important)
- Emoji relevant + beneficiu principal în CAPS
- Fraza scurtă, punch, emotionala
- Exemplu: "✨ PIELEA TA MERITĂ MAI MULT<br>Obosita de tratamente scumpe care nu functioneaza?"

### SECȚIUNEA 2 — PROBLEMA
- 2-3 fraze care descriu durerea/frustrarea clientei
- Clienta trebuie sa se recunoasca: "Stii exact cum e sa..."
- Exemplu: "Stii exact cum e sa incerci crema dupa crema, sa cheltui sute de lei, si sa nu vezi nicio schimbare reala."

### SECȚIUNEA 3 — SOLUȚIA (produsul)
- Prezentarea produsului ca soluție
- Ton entuziast dar realist
- Exemplu: "Dispozitivul X foloseste tehnologia LED clinica, acum disponibila acasa, la o fractie din pretul clinicii."

### SECȚIUNEA 4 — CARACTERISTICI (ca beneficii, nu specificații tehnice)
Format HTML: <ul> cu <li> pentru fiecare caracteristică
Fiecare li: **Caracteristică** — ce înseamnă pentru tine (beneficiu)
Exemplu:
<ul>
  <li><strong>Lumina LED 630nm</strong> — patrunde in profunzimea pielii si stimuleaza colagenul natural</li>
  <li><strong>Fara durere, fara chimicale</strong> — o sesiune de 10 minute in timp ce te uiti la un serial</li>
</ul>

### SECȚIUNEA 5 — REZULTATE (sociale și emoționale)
- Ce va simți/vedea clienta după utilizare
- Dacă există recenzii/testimoniale de la furnizor, reformulează-le
- Exemplu: "Dupa 3-4 saptamani de utilizare constanta, vei observa..."

### SECȚIUNEA 6 — CUM SE FOLOSEȘTE
- 3-5 pași simpli, numerotați (<ol>)
- Limbaj simplu, accesibil
- Include durata sesiunii și frecvența recomandată

### SECȚIUNEA 7 — OCAZII / PENTRU CINE E IDEAL
- 3-5 bullet points cu ocazii sau profiluri de utilizator
- Exemplu: "Ideal pentru tine daca: ești mereu în mișcare, nu ai timp de clinici, vrei rezultate acasă..."

### SECȚIUNEA 8 — PACHET INCLUDE
- Listă simplă cu ce conține cutia
- Exemplu: 1x dispozitiv, 1x cablu USB-C, 1x manual in romana, 1x geanta transport

### SECȚIUNEA 9 — SPECIFICAȚII TEHNICE
- Tabel HTML <table> sau <ul> simplu
- Include: dimensiuni, greutate, tensiune, material, culori disponibile
- Doar date obiective, fără text promotional

### SECȚIUNEA 10 — LIVRARE ȘI GARANȚIE
Paragraph fix (adaptează dacă ai info specifice):
"Livrare rapida in 2-4 zile lucratoare pe toata Romania. Garantie 12 luni. Returnam produsele in 30 de zile fara intrebari. Comanda acum si primesti gratuit ghidul de utilizare in romana."

### SECȚIUNEA 11 — CTA FINAL
Bold, emotional, cu urgency subtilă:
"<strong>Comanda acum si incepe calatoria catre pielea pe care o meriti. ❤️</strong>"

════════════════════════════════════════════════════════════════
FORMAT RĂSPUNS (JSON STRICT)
════════════════════════════════════════════════════════════════

Returnezi EXCLUSIV acest JSON (fără text înainte sau după):

\`\`\`json
{
  "title": "Titlu SEO max 70 caractere fara diacritice",
  "descriptionHtml": "<p>HTML complet cu toate sectiunile...</p>",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "shopifyCategory": "Una din categoriile valide"
}
\`\`\`

Categorii valide: ${categories.join(", ")}

════════════════════════════════════════════════════════════════
REGULI TAGS SHOPIFY (5-10 tags)
════════════════════════════════════════════════════════════════

- Toate lowercase, fără diacritice
- Include: categoria principală, funcția principală, beneficiul, targetul (ex: "femei", "barbati", "copii")
- Include termeni de căutare comuni (cum ar căuta clienta pe Google)
- Exemple: "led facial", "anti-acnee", "ingrijire ten", "dispozitiv acasa", "cadou femei"
- Maxim 10 tags, minim 5

════════════════════════════════════════════════════════════════
EXEMPLE DE CALITATE (referință)
════════════════════════════════════════════════════════════════

TITLU BUN: "Masca LED Faciala Anti-Imbatranire – Rezultate Vizibile Acasa | Azora"
TITLU RĂU: "Mască LED facială anti-îmbătrânire cu 7 culori și 30 minute timer"

HOOK BUN: "✨ PIELEA TA MERITĂ CELE MAI BUNE TRATAMENTE<br>Iar acum le poti face acasa, fara sa platesti clinica."
HOOK RĂU: "Acest dispozitiv este un produs de înaltă calitate care oferă multe beneficii."

BENEFICIU BUN: "<li><strong>Tehnologie cu ultrasunete 1MHz</strong> — patrunde activ in piele si multiplica efectul serului de 6 ori</li>"
BENEFICIU RĂU: "<li>Frecventa ultrasunet: 1MHz</li>"
`.trim();
}
```

---

## 5. API Routes

### 5.1 POST `/api/listings/generate`

**Fișier:** `rise/src/app/api/listings/generate/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers";
import { requirePremium } from "@/features/subscriptions/guards";
import { createProductDraft } from "@/features/listings/services/listing-generator";
import { z } from "zod";

const GenerateSchema = z.object({
  sourceUrl: z.string().url("URL invalid"),
  targetPrice: z.number().positive("Prețul trebuie să fie pozitiv"),
  compareAtPrice: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = await getCurrentOrgId(session);
    await requirePremium(orgId);

    const body = await req.json();
    const input = GenerateSchema.parse(body);

    // createProductDraft face scraping + Claude + salvare în DB
    const { draftId, draft } = await createProductDraft({
      ...input,
      organizationId: orgId,
    });

    return NextResponse.json({ draftId, draft }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Date invalide", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      if (error.message === "PREMIUM_REQUIRED") {
        return NextResponse.json(
          { error: "Această funcție necesită planul Premium" },
          { status: 403 }
        );
      }
      if (error.message === "FIRECRAWL_CREDITS_EXHAUSTED") {
        return NextResponse.json(
          { error: "Creditele Firecrawl sunt epuizate. Se încearcă metoda alternativă..." },
          { status: 503 }
        );
      }
    }
    console.error("[POST /api/listings/generate]", error);
    return NextResponse.json({ error: "Eroare internă" }, { status: 500 });
  }
}
```

### 5.2 GET `/api/listings`

**Fișier:** `rise/src/app/api/listings/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers";
import { requirePremium } from "@/features/subscriptions/guards";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = await getCurrentOrgId(session);
    await requirePremium(orgId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // Filtrare opțională
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;

    const where = {
      organizationId: orgId,
      ...(status ? { status: status as DraftStatus } : {}),
    };

    const [drafts, total] = await Promise.all([
      prisma.productDraft.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          price: true,
          compareAtPrice: true,
          status: true,
          images: true,
          shopifyProductId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { versions: true } },
        },
      }),
      prisma.productDraft.count({ where }),
    ]);

    return NextResponse.json({ drafts, total, page, limit });
  } catch (error) {
    console.error("[GET /api/listings]", error);
    return NextResponse.json({ error: "Eroare internă" }, { status: 500 });
  }
}
```

### 5.3 GET + PUT `/api/listings/[id]`

**Fișier:** `rise/src/app/api/listings/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET — detalii draft cu toate versiunile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth();
  const orgId = await getCurrentOrgId(session);

  const draft = await prisma.productDraft.findFirst({
    where: { id, organizationId: orgId },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft negăsit" }, { status: 404 });
  }

  return NextResponse.json(draft);
}

// PUT — editare manuală câmpuri
const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  descriptionHtml: z.string().optional(),
  price: z.number().positive().optional(),
  compareAtPrice: z.number().positive().nullable().optional(),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  shopifyCategory: z.string().optional(),
  status: z.enum(["PENDING_REVIEW", "APPROVED"]).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth();
  const orgId = await getCurrentOrgId(session);

  const draft = await prisma.productDraft.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft negăsit" }, { status: 404 });
  }
  if (draft.status === "PUBLISHED") {
    return NextResponse.json(
      { error: "Nu poți edita un produs deja publicat" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const updates = UpdateSchema.parse(body);

  const updated = await prisma.productDraft.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json(updated);
}
```

### 5.4 POST `/api/listings/[id]/regenerate`

**Fișier:** `rise/src/app/api/listings/[id]/regenerate/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers";
import { prisma } from "@/lib/prisma";
import { generateAzoraListing } from "@/features/listings/services/listing-generator";

const MAX_VERSIONS = 3;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth();
  const orgId = await getCurrentOrgId(session);

  const draft = await prisma.productDraft.findFirst({
    where: { id, organizationId: orgId },
    include: { versions: true },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft negăsit" }, { status: 404 });
  }

  if (draft.versions.length >= MAX_VERSIONS) {
    return NextResponse.json(
      { error: `Ai atins limita de ${MAX_VERSIONS} versiuni pentru acest draft` },
      { status: 400 }
    );
  }

  // Reconstruiește ScrapedProduct din scrapedRaw salvat
  const scraped = draft.scrapedRaw as ScrapedProduct & { method: string };
  const nextVersionNumber = draft.versions.length + 1;

  const generated = await generateAzoraListing(
    scraped,
    draft.price,
    draft.compareAtPrice || undefined,
    draft.versions.length // Numărul de regenerări anterioare
  );

  // Salvează noua versiune
  await prisma.draftVersion.create({
    data: {
      draftId: draft.id,
      versionNumber: nextVersionNumber,
      title: generated.title,
      descriptionHtml: generated.descriptionHtml,
      tags: generated.tags,
      shopifyCategory: generated.shopifyCategory,
      modelUsed: "claude-opus-4-6",
      tokensUsed: generated.tokensUsed,
    },
  });

  // Aplică noua versiune pe draft
  const updatedDraft = await prisma.productDraft.update({
    where: { id },
    data: {
      title: generated.title,
      descriptionHtml: generated.descriptionHtml,
      tags: generated.tags,
      shopifyCategory: generated.shopifyCategory,
      currentVersion: nextVersionNumber,
    },
    include: { versions: { orderBy: { versionNumber: "asc" } } },
  });

  return NextResponse.json(updatedDraft);
}
```

### 5.5 POST `/api/listings/[id]/publish`

**Fișier:** `rise/src/app/api/listings/[id]/publish/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers";
import { prisma } from "@/lib/prisma";
import { publishDraftToShopify } from "@/features/listings/services/shopify-publisher";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth();
  const orgId = await getCurrentOrgId(session);

  const draft = await prisma.productDraft.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft negăsit" }, { status: 404 });
  }
  if (draft.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Produsul trebuie aprobat înainte de publicare" },
      { status: 400 }
    );
  }
  if (draft.status === "PUBLISHED") {
    return NextResponse.json({ error: "Produsul a fost deja publicat" }, { status: 400 });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { shopifyDomain: true, shopifyAccessToken: true },
    });

    if (!org?.shopifyAccessToken) {
      return NextResponse.json(
        { error: "Shopify nu este conectat. Mergi la Setări → Integrări." },
        { status: 400 }
      );
    }

    const { shopifyProductId, shopifyProductUrl } = await publishDraftToShopify(
      draft,
      org.shopifyDomain!,
      org.shopifyAccessToken
    );

    const updated = await prisma.productDraft.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        shopifyProductId,
        shopifyProductUrl,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    await prisma.productDraft.update({
      where: { id },
      data: {
        errorMessage: error instanceof Error ? error.message : "Eroare necunoscută",
      },
    });
    console.error("[POST /api/listings/[id]/publish]", error);
    return NextResponse.json({ error: "Eroare la publicare pe Shopify" }, { status: 500 });
  }
}
```

---

## 6. UI Pages

### 6.1 Structura fișierelor UI

```
rise/src/
├── app/(dashboard)/
│   └── listings/
│       ├── page.tsx                    ← Lista drafts
│       ├── new/
│       │   └── page.tsx               ← Formular URL + prețuri
│       └── [id]/
│           └── page.tsx               ← Preview + edit + aprobare + publicare
├── features/
│   └── listings/
│       ├── components/
│       │   ├── ListingsList.tsx        ← Tabel/grid cu toate draft-urile
│       │   ├── ListingStatusBadge.tsx  ← Badge colorat per status
│       │   ├── NewListingForm.tsx      ← Formular URL + prețuri
│       │   ├── ListingEditor.tsx       ← Editor complet (preview + edit)
│       │   ├── HtmlPreview.tsx         ← Randare HTML sanitizat
│       │   ├── ImageSelector.tsx       ← Grid imagini cu drag & drop
│       │   ├── VersionHistory.tsx      ← Lista versiuni cu switch
│       │   └── PublishButton.tsx       ← Buton publicare cu confirmare
│       ├── hooks/
│       │   ├── useListings.ts          ← React Query: GET /api/listings
│       │   ├── useListing.ts           ← React Query: GET /api/listings/[id]
│       │   ├── useGenerateListing.ts   ← React Query: POST /api/listings/generate
│       │   ├── useUpdateListing.ts     ← React Query: PUT /api/listings/[id]
│       │   ├── useRegenerateListing.ts ← React Query: POST .../regenerate
│       │   └── usePublishListing.ts    ← React Query: POST .../publish
│       └── services/
│           ├── listing-generator.ts   ← (deja definit mai sus)
│           └── shopify-publisher.ts   ← (definit în secțiunea 9)
```

### 6.2 Pagina `/listings` — Lista Drafts

**Fișier:** `rise/src/app/(dashboard)/listings/page.tsx`

```tsx
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ListingsList } from "@/features/listings/components/ListingsList";
import { PremiumGate } from "@/features/subscriptions/components/PremiumGate";

export default function ListingsPage() {
  return (
    <PremiumGate feature="Product Listing Creator">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Product Listing Creator</h1>
            <p className="text-muted-foreground mt-1">
              Genereaza listing-uri Shopify din orice URL de furnizor
            </p>
          </div>
          <Button asChild>
            <Link href="/listings/new">
              <PlusIcon className="h-4 w-4 mr-2" />
              Listing nou
            </Link>
          </Button>
        </div>

        {/* Filtre status */}
        <StatusFilterTabs />

        <Suspense fallback={<ListingsListSkeleton />}>
          <ListingsList />
        </Suspense>
      </div>
    </PremiumGate>
  );
}
```

### 6.3 Pagina `/listings/new` — Formular Generare

**Fișier:** `rise/src/app/(dashboard)/listings/new/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGenerateListing } from "@/features/listings/hooks/useGenerateListing";
import { Loader2, Sparkles } from "lucide-react";

const FormSchema = z.object({
  sourceUrl: z.string().url("Introdu un URL valid"),
  targetPrice: z
    .string()
    .transform(Number)
    .pipe(z.number().positive("Prețul trebuie să fie pozitiv")),
  compareAtPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().positive().optional()),
});

export default function NewListingPage() {
  const router = useRouter();
  const { mutateAsync: generateListing, isPending } = useGenerateListing();
  const [generatingMessage, setGeneratingMessage] = useState("");

  const form = useForm({ resolver: zodResolver(FormSchema) });

  const LOADING_MESSAGES = [
    "Se scrape-uieste pagina...",
    "Se extrag datele produsului...",
    "Claude genereaza textul...",
    "Se creaza listing-ul...",
  ];

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    // Simulează mesaje de progres
    let msgIndex = 0;
    const interval = setInterval(() => {
      if (msgIndex < LOADING_MESSAGES.length) {
        setGeneratingMessage(LOADING_MESSAGES[msgIndex++]);
      }
    }, 3000);

    try {
      const result = await generateListing(data);
      clearInterval(interval);
      router.push(`/listings/${result.draftId}`);
    } catch (error) {
      clearInterval(interval);
      setGeneratingMessage("");
      // Error handling afișat de toast (React Query onError)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Listing nou din URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="sourceUrl">URL produs furnizor / competitor</Label>
              <Input
                id="sourceUrl"
                placeholder="https://aliexpress.com/item/..."
                {...form.register("sourceUrl")}
              />
              <p className="text-xs text-muted-foreground">
                AliExpress, Amazon, site furnizor chinezesc, competitor.
                Firecrawl extrage automat datele.
              </p>
              {form.formState.errors.sourceUrl && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sourceUrl.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetPrice">Pret vanzare (RON) *</Label>
                <Input
                  id="targetPrice"
                  type="number"
                  step="0.01"
                  placeholder="299.99"
                  {...form.register("targetPrice")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compareAtPrice">Pret barat (RON)</Label>
                <Input
                  id="compareAtPrice"
                  type="number"
                  step="0.01"
                  placeholder="399.99 (optional)"
                  {...form.register("compareAtPrice")}
                />
              </div>
            </div>

            {isPending && generatingMessage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                {generatingMessage}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Se genereaza... (30-60 secunde)
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Genereaza Listing
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6.4 Pagina `/listings/[id]` — Preview + Edit + Aprobare + Publicare

**Fișier:** `rise/src/app/(dashboard)/listings/[id]/page.tsx`

```tsx
"use client";

import { use } from "react";
import { useListing } from "@/features/listings/hooks/useListing";
import { HtmlPreview } from "@/features/listings/components/HtmlPreview";
import { ImageSelector } from "@/features/listings/components/ImageSelector";
import { VersionHistory } from "@/features/listings/components/VersionHistory";
import { PublishButton } from "@/features/listings/components/PublishButton";
import { ListingEditor } from "@/features/listings/components/ListingEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpdateListing } from "@/features/listings/hooks/useUpdateListing";
import { useRegenerateListing } from "@/features/listings/hooks/useRegenerateListing";
import { RefreshCw, CheckCircle, ExternalLink } from "lucide-react";

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: draft, isLoading } = useListing(id);
  const { mutate: updateListing } = useUpdateListing(id);
  const { mutate: regenerate, isPending: isRegenerating } = useRegenerateListing(id);

  if (isLoading) return <ListingDetailSkeleton />;
  if (!draft) return <div>Draft negasit</div>;

  const canApprove = draft.status === "PENDING_REVIEW";
  const canPublish = draft.status === "APPROVED";
  const isPublished = draft.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold line-clamp-2">{draft.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sursa:{" "}
            <a href={draft.sourceUrl} target="_blank" className="underline">
              {new URL(draft.sourceUrl).hostname}
              <ExternalLink className="h-3 w-3 inline ml-1" />
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ListingStatusBadge status={draft.status} />
          {draft.versions.length < 3 && !isPublished && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerate()}
              disabled={isRegenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
              Regenereaza ({3 - draft.versions.length} ramase)
            </Button>
          )}
          {canApprove && (
            <Button
              variant="default"
              size="sm"
              onClick={() => updateListing({ status: "APPROVED" })}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aproba
            </Button>
          )}
          {canPublish && <PublishButton draftId={id} />}
        </div>
      </div>

      {/* Tabs principale */}
      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview Listing</TabsTrigger>
          <TabsTrigger value="edit">Editeaza</TabsTrigger>
          <TabsTrigger value="images">
            Imagini ({draft.images.length})
          </TabsTrigger>
          <TabsTrigger value="versions">
            Versiuni ({draft.versions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <HtmlPreview html={draft.descriptionHtml} title={draft.title} />
            </div>
            <div className="space-y-4">
              <PriceCard
                price={draft.price}
                compareAtPrice={draft.compareAtPrice}
              />
              <TagsCard tags={draft.tags} category={draft.shopifyCategory} />
              {isPublished && (
                <ShopifyCard
                  shopifyProductId={draft.shopifyProductId!}
                  shopifyProductUrl={draft.shopifyProductUrl}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="edit" className="mt-6">
          <ListingEditor draft={draft} onSave={updateListing} />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ImageSelector
            images={draft.images}
            onReorder={(images) => updateListing({ images })}
          />
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <VersionHistory
            versions={draft.versions}
            currentVersion={draft.currentVersion}
            onRestore={(version) =>
              updateListing({
                title: version.title,
                descriptionHtml: version.descriptionHtml,
                tags: version.tags,
                shopifyCategory: version.shopifyCategory || undefined,
              })
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 7. Preview HTML — Randare Descriere

### 7.1 Component `HtmlPreview`

Descrierea generată de Claude este HTML — trebuie sanitizat înainte de randare pentru a preveni XSS.

**Fișier:** `rise/src/features/listings/components/HtmlPreview.tsx`

```tsx
"use client";

import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HtmlPreviewProps {
  html: string;
  title: string;
}

/**
 * Randează HTML generat de Claude cu sanitizare DOMPurify.
 * Stilizat să imite aspectul unui listing Shopify real.
 */
export function HtmlPreview({ html, title }: HtmlPreviewProps) {
  // Sanitizare: permite tag-uri HTML standard, blochează script/event handlers
  const cleanHtml =
    typeof window !== "undefined"
      ? DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            "p", "br", "strong", "em", "ul", "ol", "li",
            "h2", "h3", "h4", "table", "thead", "tbody", "tr", "th", "td",
            "span", "div",
          ],
          ALLOWED_ATTR: ["class", "style"],
        })
      : html; // SSR: folosim html-ul brut (Claude API e trusted server-side)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Preview Listing</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cum va arata descrierea pe Shopify
        </p>
      </CardHeader>
      <CardContent>
        {/* Titlu produs */}
        <h1 className="text-2xl font-bold mb-4">{title}</h1>

        {/* Descriere HTML — stilizat ca Shopify product page */}
        <div
          className="prose prose-sm max-w-none
            prose-headings:text-foreground prose-headings:font-bold
            prose-p:text-foreground prose-p:leading-relaxed
            prose-ul:list-disc prose-ul:pl-6
            prose-ol:list-decimal prose-ol:pl-6
            prose-li:text-foreground prose-li:mb-1
            prose-strong:text-foreground prose-strong:font-semibold
            prose-table:border prose-td:border prose-td:p-2 prose-th:border prose-th:p-2"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      </CardContent>
    </Card>
  );
}
```

**Instalare dependență:**

```bash
cd rise && npm install dompurify @types/dompurify
```

---

## 8. Image Selector — UI Selectare și Reordonare Imagini

**Fișier:** `rise/src/features/listings/components/ImageSelector.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, X, Star } from "lucide-react";
import Image from "next/image";

interface ImageSelectorProps {
  images: string[];
  onReorder: (images: string[]) => void;
}

/**
 * Grid cu imagini extrase din scraping.
 * - Drag & drop pentru reordonare (prima imagine = cover Shopify)
 * - Click pe X pentru eliminare
 * - Prima imagine marcată cu badge "COVER"
 */
export function ImageSelector({ images, onReorder }: ImageSelectorProps) {
  const [localImages, setLocalImages] = useState(images);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localImages.indexOf(active.id as string);
      const newIndex = localImages.indexOf(over.id as string);
      const newImages = arrayMove(localImages, oldIndex, newIndex);
      setLocalImages(newImages);
      setHasChanges(true);
    }
  }

  function removeImage(url: string) {
    const newImages = localImages.filter((img) => img !== url);
    setLocalImages(newImages);
    setHasChanges(true);
  }

  function saveOrder() {
    onReorder(localImages);
    setHasChanges(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Imagini produs ({localImages.length})</h3>
          <p className="text-sm text-muted-foreground">
            Trage pentru reordonare. Prima imagine va fi cover-ul pe Shopify.
          </p>
        </div>
        {hasChanges && (
          <Button size="sm" onClick={saveOrder}>
            Salveaza ordinea
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localImages} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {localImages.map((url, index) => (
              <SortableImageItem
                key={url}
                url={url}
                index={index}
                onRemove={removeImage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {localImages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          Nicio imagine selectata.
          Scrape-ul nu a gasit imagini sau toate au fost eliminate.
        </div>
      )}
    </div>
  );
}

function SortableImageItem({
  url,
  index,
  onRemove,
}: {
  url: string;
  index: number;
  onRemove: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square border rounded-lg overflow-hidden bg-muted"
    >
      {/* Imagine */}
      <Image
        src={url}
        alt={`Imagine ${index + 1}`}
        fill
        className="object-cover"
        unoptimized // URL-uri externe, nu beneficiază de Next.js optimization
        onError={(e) => {
          // Fallback pentru imagini care nu se încarcă
          (e.target as HTMLImageElement).src = "/placeholder-product.png";
        }}
      />

      {/* Badge COVER pe prima imagine */}
      {index === 0 && (
        <Badge className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-1 py-0">
          <Star className="h-2 w-2 mr-1" />
          COVER
        </Badge>
      )}

      {/* Număr poziție */}
      {index > 0 && (
        <span className="absolute top-1 left-1 bg-black/50 text-white text-xs rounded px-1">
          {index + 1}
        </span>
      )}

      {/* Drag handle + Remove button (vizibile on hover) */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
        <button
          {...attributes}
          {...listeners}
          className="absolute top-1 right-6 p-0.5 text-white opacity-0 group-hover:opacity-100 cursor-grab"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          onClick={() => onRemove(url)}
          className="absolute top-1 right-1 p-0.5 bg-destructive text-destructive-foreground rounded-sm opacity-0 group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
```

**Instalare dependențe:**

```bash
cd rise && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## 9. Publicare Shopify — Cod Complet

**Fișier:** `rise/src/features/listings/services/shopify-publisher.ts`

```typescript
import { ProductDraft } from "@prisma/client";

interface ShopifyImage {
  src: string;
  position: number;
}

interface ShopifyProductPayload {
  product: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    tags: string;
    status: "draft" | "active";
    images: ShopifyImage[];
    variants: Array<{
      price: string;
      compare_at_price?: string;
      inventory_management: "shopify" | null;
      inventory_policy: "deny" | "continue";
    }>;
  };
}

interface ShopifyProductResponse {
  product: {
    id: number;
    title: string;
    admin_graphql_api_id: string;
  };
}

/**
 * Publică un draft aprobat ca produs pe Shopify (status "draft").
 * Shopify descarcă imaginile automat din URLs-urile furnizate.
 * Returnează shopifyProductId și URL-ul admin Shopify.
 */
export async function publishDraftToShopify(
  draft: ProductDraft,
  shopifyDomain: string,
  accessToken: string
): Promise<{ shopifyProductId: string; shopifyProductUrl: string }> {
  const endpoint = `https://${shopifyDomain}/admin/api/2024-10/products.json`;

  const payload: ShopifyProductPayload = {
    product: {
      title: draft.title,
      body_html: draft.descriptionHtml,
      vendor: draft.vendor || "Azora",
      product_type: draft.shopifyCategory || "",
      tags: draft.tags.join(", "),
      status: "draft", // User verifică în Shopify Admin și activează manual

      // Shopify descarcă imaginile automat din URLs
      images: draft.images.slice(0, 250).map((src, index) => ({
        src,
        position: index + 1,
      })),

      variants: [
        {
          price: draft.price.toFixed(2),
          compare_at_price: draft.compareAtPrice
            ? draft.compareAtPrice.toFixed(2)
            : undefined,
          inventory_management: "shopify",
          inventory_policy: "deny",
        },
      ],
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Shopify API ${response.status}`;

    if (response.status === 401) {
      errorMessage = "Token Shopify invalid sau expirat. Reconecteaza Shopify din Setari.";
    } else if (response.status === 422) {
      errorMessage = `Date invalide pentru Shopify: ${errorBody}`;
    } else if (response.status === 429) {
      errorMessage = "Rate limit Shopify atins. Incearca din nou in cateva secunde.";
    }

    throw new Error(errorMessage);
  }

  const data: ShopifyProductResponse = await response.json();
  const shopifyProductId = String(data.product.id);
  const shopifyProductUrl = `https://${shopifyDomain}/admin/products/${shopifyProductId}`;

  return { shopifyProductId, shopifyProductUrl };
}

/**
 * Actualizează un produs existent pe Shopify (pentru re-sync după editări).
 * Apelată opțional dacă user-ul editează un produs deja publicat.
 */
export async function updateShopifyProduct(
  shopifyProductId: string,
  updates: Partial<{
    title: string;
    descriptionHtml: string;
    tags: string[];
    price: number;
    compareAtPrice: number | null;
  }>,
  shopifyDomain: string,
  accessToken: string
): Promise<void> {
  const endpoint = `https://${shopifyDomain}/admin/api/2024-10/products/${shopifyProductId}.json`;

  const payload: Record<string, unknown> = { product: {} };
  if (updates.title) (payload.product as Record<string, unknown>).title = updates.title;
  if (updates.descriptionHtml) (payload.product as Record<string, unknown>).body_html = updates.descriptionHtml;
  if (updates.tags) (payload.product as Record<string, unknown>).tags = updates.tags.join(", ");

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Shopify update failed: HTTP ${response.status}`);
  }
}
```

---

## 10. Error Handling

### 10.1 Matricea de Erori

| Scenariu | Cauza | Comportament Rise |
|---|---|---|
| URL inaccesibil (404, timeout) | Furnizor blocat sau pagina stearsa | `status: FAILED`, `errorMessage: "Pagina nu a putut fi accesata. Verifica URL-ul."` |
| Firecrawl credite epuizate | Plan gratuit 500 credite/lună | Fallback automat la Jina AI, fara notificare user |
| Jina AI timeout (>30s) | Server lent sau blocat | `status: FAILED`, `errorMessage: "Scraping-ul a durat prea mult. Incearca un alt URL."` |
| Claude timeout (>60s) | API congestionat | Retry automat 1x, dupa care `status: FAILED` |
| Claude raspuns JSON invalid | Model instabil sau prompt modificat | Log complet in server, `errorMessage: "Generarea a esuat. Regenereaza sau contacteaza suport."` |
| Shopify 401 | Token expirat/revocat | Redirect user la `/settings` cu mesaj clar |
| Shopify 422 | Date invalide (titlu prea lung, etc.) | Afiseaza câmpul problematic în UI |
| Shopify 429 | Rate limit (40 req/app/sec) | Retry automat cu exponential backoff (1s, 2s, 4s) |
| URL furnizor chinezesc cu antibot | Cloudflare/captcha | `errorMessage: "Site-ul blocheaza scraping-ul. Incarca manual datele."` (fallback la formular manual — viitor) |

### 10.2 Retry Logic pentru Claude

```typescript
// rise/src/lib/claude-with-retry.ts

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("529") || // Anthropic overloaded
          error.message.includes("529"));

      if (isLastAttempt || !isRetryable) throw error;

      console.warn(`[claude-retry] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw new Error("Unreachable");
}
```

### 10.3 Monitoring Costuri Claude

Tokenele sunt înregistrate în `DraftVersion.tokensUsed`. La aprox. $0.015/1K tokens input + $0.075/1K tokens output (claude-opus-4-6):

- Un listing tipic: ~2500 tokens input + ~1500 tokens output ≈ **$0.15/listing**
- La 20 listing-uri/lună: ~$3/lună în costuri Claude

Adaugă un query de monitorizare în dashboard admin:

```typescript
const monthlyUsage = await prisma.draftVersion.aggregate({
  where: {
    draft: { organizationId: orgId },
    generatedAt: { gte: startOfMonth(new Date()) },
  },
  _sum: { tokensUsed: true },
});
```

---

## 11. Sugestii de Îmbunătățire (Backlog Post-Lansare)

### 11.1 Import Bulk din CSV
Permite importul mai multor URL-uri dintr-un fișier CSV:
```
sourceUrl, targetPrice, compareAtPrice
https://aliexpress.com/..., 299, 399
https://aliexpress.com/..., 149, 199
```
Queue procesare cu BullMQ — un listing la 5 secunde pentru a respecta rate limits.

### 11.2 Template-uri per Categorie
Prompt-uri specializate per categoria Azora:
- **Beauty & Wellness**: ton mai luxos, accent pe rutina de ingrijire
- **Cadouri**: accent pe ambalaj, ocazii speciale, emoție
- **Dispozitive**: ton mai tehnic dar accesibil, accent pe siguranță și certificări
- **Copii**: ton parental, accent pe siguranță și materiale, certificări EN71

### 11.3 Generare Imagini cu AI
Dacă URL-ul nu are imagini de calitate:
- Integrare DALL-E 3 sau Stable Diffusion pentru lifestyle shots
- Watermark removal cu inpainting (pentru imagini cu logo furnizor)

### 11.4 SEO Audit Automat
Înainte de publicare, verifică automat:
- Titlu: lungime 30-70 caractere
- Descriere: minim 300 cuvinte
- Tags: minim 5, maxim 10
- Imagini: minim 3, prima imagine are raport 1:1 sau 4:3

### 11.5 Publicare Directă (Active, nu Draft)
Opțiune avansată pentru useri cu volum mare: publică direct `status: "active"` pe Shopify, fără review manual în Shopify Admin.

### 11.6 Sincronizare Prețuri Concurență
Scrape periodic URL-ul competitor și alertă dacă prețul lor a scăzut sub prețul Azora.

### 11.7 Formular Manual (Fallback URL Blocat)
Dacă scraping-ul eșuează (antibot, pagina privată), afișează un formular unde user-ul poate lipi manual:
- Titlul original
- Descrierea brută
- URLs imagini (câte unul pe linie)

Claude generează listing-ul din text lipit manual, fără scraping.

---

## 12. Integrare cu Sistemul de Subscripții (Sub-proiect 6)

### Model Organization (adăugare câmpuri)

```prisma
model Organization {
  // ... câmpuri existente ...
  planTier        PlanTier    @default(FREE)
  planExpiresAt   DateTime?
  stripeCustomerId String?
  stripeSubscriptionId String?
}

enum PlanTier {
  FREE
  PREMIUM
}
```

### Sidebar Navigation

```tsx
// rise/src/components/sidebar/nav-items.ts
{
  label: "Product Listing Creator",
  href: "/listings",
  icon: SparklesIcon,
  badge: "PREMIUM",       // Afișează badge auriu
  requiresPlan: "PREMIUM",
}
```

### Component PremiumGate

```tsx
// rise/src/features/subscriptions/components/PremiumGate.tsx
export function PremiumGate({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  const { data: org } = useCurrentOrg();

  if (org?.planTier !== "PREMIUM") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            PREMIUM
          </Badge>
          <h2 className="text-2xl font-bold">{feature}</h2>
          <p className="text-muted-foreground max-w-md">
            Aceasta functie este disponibila exclusiv pe planul Premium.
            Economiseste pana la 80 de ore pe luna cu generare automata de listing-uri.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/settings/billing">
            Activeaza Premium
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
```

---

## 13. Checklist Implementare

### Faza 1 — Backend (Estimat: 3 zile)

- [ ] Migrare Prisma: `ProductDraft` + `DraftVersion` + enum `DraftStatus`
- [ ] `listing-generator.ts`: `scrapeWithFirecrawl` + `scrapeWithJina` + `generateAzoraListing`
- [ ] API route: `POST /api/listings/generate`
- [ ] API route: `GET /api/listings`
- [ ] API route: `GET /api/listings/[id]` + `PUT /api/listings/[id]`
- [ ] API route: `POST /api/listings/[id]/regenerate`
- [ ] `shopify-publisher.ts`: `publishDraftToShopify`
- [ ] API route: `POST /api/listings/[id]/publish`
- [ ] Variables de mediu: `FIRECRAWL_API_KEY`, `JINA_API_KEY` (opțional)

### Faza 2 — Frontend (Estimat: 3 zile)

- [ ] Page `/listings`: lista drafts cu filtre status
- [ ] Page `/listings/new`: formular URL + prețuri + loading states
- [ ] Page `/listings/[id]`: tabs Preview / Edit / Imagini / Versiuni
- [ ] Component `HtmlPreview` cu DOMPurify
- [ ] Component `ImageSelector` cu drag & drop (@dnd-kit)
- [ ] Component `VersionHistory` cu restore
- [ ] Component `PublishButton` cu confirmare dialog
- [ ] React Query hooks pentru toate endpoint-urile

### Faza 3 — Feature Gating (Estimat: 1 zi)

- [ ] `requirePremium()` guard pe toate rutele API
- [ ] Component `PremiumGate` cu upgrade CTA
- [ ] Badge "PREMIUM" în sidebar
- [ ] Câmpuri `planTier` + `planExpiresAt` în Organization

### Faza 4 — Testing și QA (Estimat: 1 zi)

- [ ] Testare cu 5 URL-uri reale (AliExpress, Amazon, site chinezesc)
- [ ] Verificare HTML generat în preview (sanitizare corectă)
- [ ] Verificare drag & drop imagini
- [ ] Testare publicare Shopify (draft mode)
- [ ] Testare flow regenerare (max 3 versiuni)
- [ ] Testare error handling (URL invalid, Firecrawl down)

**Total estimat:** 8 zile de implementare.

---

## 14. Variabile de Mediu Necesare

Adaugă în `rise/.env`:

```bash
# Listing Creator — Sub-proiect 7
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxx   # https://firecrawl.dev → API Keys
JINA_API_KEY=jina_xxxxxxxxxxxxxxxxxxxx      # https://jina.ai → optional, rate limit mai mare
# ANTHROPIC_API_KEY deja existent din alte sub-proiecte
```

---

*Plan creat: 2026-03-29 | Autor: Claude (PM mode) | Sub-proiect: 7 din n*
