# AUDIT COMPLET AZORA.RO — CONVERSIE, UX ȘI CRO
**Data:** 2026-04-05  
**Metodologie:** Analiză cod sursă azora-shop + pagina live azora.ro + research best practices (Baymard Institute, Meta Business, Shopify, CXL, Nielsen Norman Group)

---

## CONTEXT ȘI METODOLOGIE

Auditul acoperă:
1. **Cod sursă** — azora-shop (Shopify Dawn-based theme cu layer Azora)
2. **Site live** — azora.ro homepage + pagina de colecție + pagina de produs (Aparat Lifting Facial 7 Moduri)
3. **Research extern** — surse oficiale Baymard Institute (200,000+ ore studiu UX), Meta Business Help, Shopify Blog, CXL Institute, Nielsen Norman Group

**Profilul traficului:** Predominant Facebook/Meta Ads → landing direct pe pagina de produs → 94% mobil (conform Meta Business stats).

**Arhitectura de conversie:** Fără coș de cumpărături. Fluxul principal este: reclamă Facebook → pagina de produs → formular EasySell COD (ramburs) direct. Butonul "PLĂTEȘTE CU CARDUL" este alternativa pentru plată online. Butonul "Add to cart" Dawn standard este prezent în template dar **ar trebui dezactivat sau redirecționat** pentru consistența cu această arhitectură.

---

## STRUCTURA PAGINII DE PRODUS (starea actuală)

Ordinea secțiunilor din `templates/product.json`:

```
1.  main-product          ← zona principală produs (above fold)
2.  youtube-float         ← video YouTube (condițional pe metafield)
3.  trust-icons           ← 4 icoane: garanție, retur, livrare, suport
4.  features-grid         ← grilă features (condițional pe metafield)
5.  details               ← descriere completă produs
6.  order-header          ← titlu "Completeaza comanda"
7.  EasySell COD form     ← formular ramburs
8.  product-direct-payment ← buton "PLĂTEȘTE CU CARDUL"
9.  reviews-static        ← heading "CE SPUN CUMPARATORII" (fără conținut)
10. Judge.me widget       ← recenzii reale
11. product-faq           ← FAQ generic
12. related-products      ← produse recomandate
```

**Blocuri în zona main-product (block_order):**
```
vendor → title → price → countdown_urgency → social_proof → inventory
→ variant_picker → quantity_selector → buy_buttons → mini_trust_icons
→ specs_tab → delivery_tab → sku → share → judge_me_preview_badge
```

---

## 🔴 PROBLEME CRITICE (impact direct pe conversie și legal)

---

### 1. Social proof FALS — risc legal ANPC și pierdere credibilitate

**Fișier:** `sections/main-product.liquid` — blocul `social_proof`

**Codul actual:**
```liquid
{%- assign sp_base = product.id | modulo: 31 -%}
{%- assign sp_buyers = sp_base | plus: 23 -%}
{%- assign sp_watchers = product.id | modulo: 17 | plus: 7 -%}
{{ sp_buyers }} persoane au cumparat azi · {{ sp_watchers }} urmaresc acum
```

**Problema detaliată:**
- Numerele sunt calculate matematic din ID-ul produsului (modulo), nu din date reale
- Fiecare produs arată **întotdeauna aceleași cifre fixe**, indiferent de vânzări reale
- Un client care vizitează de 10 ori vede exact același număr — evident fals pentru utilizatori atenți
- Clienții observă inconsistența și pierd total încrederea în magazin

**Risc legal:** Directiva Omnibus 2022 (implementată în RO prin Legea 258/2022) interzice explicit social proof fabricat și statistici de vânzări false. ANPC poate aplica amenzi de până la 4% din cifra de afaceri.

**Fix recomandat:**
```liquid
{%- if product.metafields.reviews.rating_count.value > 0 -%}
  <div class="azora-social-proof">
    <span class="azora-social-proof__dot"></span>
    <span class="azora-social-proof__text">
      {{ product.metafields.reviews.rating_count.value }} recenzii verificate
    </span>
  </div>
{%- endif -%}
```
Sau elimină complet blocul dacă nu există date reale.

---

### 2. Bug H1 duplicat — penalizare SEO

**Fișier:** `sections/main-product.liquid`, liniile 112–119

**Codul actual:**
```liquid
<div class="product__title" {{ block.shopify_attributes }}>
  <h1>{{ product.title | escape }}</h1>        ← primul H1
  <a href="{{ product.url }}" class="product__title">
    <h2 class="h1">                             ← al doilea, styled ca H1
      {{ product.title | escape }}
    </h2>
  </a>
</div>
```

**Problema detaliată:**
- Titlul produsului apare de **două ori** în DOM — o dată ca `<h1>` și o dată ca `<h2>` cu stilizare de H1
- Google vede două heading-uri cu același text — confuzie canonică
- `<h1>` în interiorul unui `<a>` este invalid semantic HTML
- SEO penalizat: crawlerele interpretează ambiguitate

**Fix:** Șterge linia `<h1>{{ product.title | escape }}</h1>` (linia 113) și păstrează doar `<h2 class="h1">`.

---

### 3. Bug cantitate la "PLĂTEȘTE CU CARDUL"

**Fișier:** `sections/product-direct-payment.liquid`, linia 31

**Codul actual:**
```liquid
<a href="/cart/{{ payment_variant.id }}:1" ...>
  PLĂTEȘTE CU CARDUL
</a>
```

**Problema:** Cantitatea este hardcodată la `:1`. Dacă utilizatorul a selectat cantitate 2-3 pe pagina de produs, butonul ignoră complet selecția și adaugă în coș doar 1 bucată. Comandă greșită, UX rupt.

**Fix JavaScript:**
```javascript
// În azora.js sau inline în secțiune
document.querySelector('[data-azora-card-payment-link]').addEventListener('click', function(e) {
  e.preventDefault();
  const qty = document.querySelector('#Quantity-{{ section.id }}')?.value || 1;
  const variantId = this.href.split(':')[0].split('/').pop();
  window.location.href = `/cart/${variantId}:${qty}`;
});
```

---

### 4. "Stoc limitat" fals — hardcodat pentru toate produsele

**Fișier:** `templates/product.json` — blocul `countdown_urgency_block`

**Codul actual:**
```json
"stock_text": "Doar 7 bucati ramase!"
```

**Problema:** Text hardcodat identic pentru **toate produsele**, indiferent de stocul real. Un produs cu 500 de unități afișează "Doar 7 bucăți rămase!" — pur fals. Clienții care comandă frecvent observă și pierd încrederea. Același risc legal ca la punctul 1.

**Fix (Liquid):**
```liquid
{%- assign inv = product.selected_or_first_available_variant.inventory_quantity -%}
{%- if inv > 0 and inv <= 10 -%}
  <p class="azora-stock-warning">⚠️ Doar {{ inv }} bucăți rămase!</p>
{%- endif -%}
```

---

### 5. Countdown timer — trei probleme cumulate

**Fișier:** `sections/main-product.liquid` — blocul `countdown_urgency`

**Problema 1 — pornire la 75% din timp:**
```javascript
endTime = Date.now() + Math.round(totalSeconds * 0.75) * 1000;
// Timer de 10 minute pornește la 7 min 30 sec
```
Clientul pierde 25% din ofertă fără să știe — UX înșelător.

**Problema 2 — expirare fără feedback:**
La 00:00:00 nu apare niciun mesaj. Timer rămâne îngheța. Clientul crede că site-ul e spart.

**Problema 3 — sessionStorage vs realitate:**
Timer se resetează la fiecare sesiune nouă. Un client care revine a doua zi vede din nou countdown la fel — evident fals.

**Fix recomandat:**
```javascript
// Pornește de la 100%
endTime = Date.now() + totalSeconds * 1000;

// La expirare, afișează mesaj
function onExpired() {
  document.querySelector('.azora-countdown__timer').textContent = 'Oferta s-a încheiat!';
  document.querySelector('.azora-countdown__label').textContent = '⚠️';
}
```

---

## 🟠 PROBLEME IMPORTANTE (impact semnificativ pe UX și conversie)

---

### 6. CTA primar "COMANDĂ ACUM" — clarificare și problemă reziduală

**Corecție față de analiza inițială:** CTA-ul principal vizibil în UI este **"COMANDĂ ACUM"** (buton violet mare, EasySell), nu "Add to cart". Butonul Dawn standard `buy_buttons` nu este vizibil proeminent — este fie scrollat mai jos, fie stilizat în fundal. Fluxul principal este clar: **"COMANDĂ ACUM" → scroll la formular EasySell COD**.

**Ce apare în UI (confirmat din screenshot):**
1. **"COMANDĂ ACUM"** — buton violet principal, full-width, prominent ✅
2. Mini trust icons sub buton (Garantie 24 luni, Livrare 24h, Retur 14 zile, Plata la livrare) ✅
3. Butonul **"PLĂTEȘTE CU CARDUL"** — apare mai jos în pagină, ca secțiune separată

**Problema reziduală:** Blocul Dawn `buy_buttons` (cu `show_dynamic_checkout: true`) este încă activ în `product.json` și generează butoane de **Apple Pay / Google Pay** sub "COMANDĂ ACUM". Pe mobile, aceste butoane de checkout rapid apar și pot deruta utilizatorul — duc direct la checkout Shopify, bypass EasySell. Dacă magazinul nu procesează comenzile prin checkout Shopify, aceste comenzi pot crea confuzie operațională.

**Fix:**
- Verifică în UI mobile dacă apar butoane Apple Pay / Google Pay sub "COMANDĂ ACUM"
- Dacă da, setează `"show_dynamic_checkout": false` în blocul `buy_buttons` din `product.json`
- "PLĂTEȘTE CU CARDUL" rămâne ca alternativă secundară, dar poziționat clar după EasySell form, cu label explicit: "Sau plătește cu cardul →"

---

### 7. Recenzii Judge.me afișate prea jos în pagină

**Problema:** Widgetul complet Judge.me apare la **poziția 10 din 12** secțiuni. Utilizatorul trebuie să scroll-uieze prin descriere + formular de comandă înainte să vadă recenziile.

**Conform Baymard Institute:** 95% din cumpărători citesc recenziile înainte de cumpărare. 53% caută intenționat recenzii negative — prezența lor crește trust. Reviews trebuie vizibile **înainte** de decizia finală.

**Fix:** Mută secțiunea `reviews-static` + `Judge.me widget` **înaintea** secțiunii `details` (descriere), deci la poziția 4-5, nu 9-10.

---

### 8. Product cards afișează "0/5 (0)" fără recenzii

**Fișier:** `snippets/card-product.liquid`, liniile 150–158

**Codul actual:**
```liquid
{%- elsif show_rating -%}
  <div class="azora-card__rating">
    <span class="rating-star" style="--rating: 0; ..."></span>
    <span class="azora-card__rating-value">0/5</span>
    <span class="azora-card__rating-count">(0)</span>
  </div>
```

**Problema:** Un rating de 0/5 cu 0 recenzii afișat vizibil pe card este **mai rău** decât nicio informație. Semnalează că produsul nu e popular sau testat.

**Fix:** Elimină fallback-ul — nu afișa nimic când nu există recenzii:
```liquid
{%- if show_rating and review_rating_value != blank -%}
  {{- /* afișează rating real */ -}}
{%- endif -%}
```

---

### 9. Related products fără rating

**Fișier:** `templates/product.json`

```json
"show_rating": false
```

**Problema:** Produsele recomandate apar fără stele — oportunitate de social proof ratată tocmai în momentul de cross-sell.

**Fix:** Schimbă în `"show_rating": true`.

---

### 10. Lipsă breadcrumb — context de navigare

**Problema:** Nu există breadcrumb pe pagina de produs (confirmat cod + inspecție live). Un utilizator venit direct dintr-o reclamă Facebook:
- Nu știe în ce categorie se află produsul
- Nu poate naviga la produse similare fără să plece complet din pagină
- Site-ul pare izolat, fără structură

**Bonus SEO:** Google recomandă breadcrumb schema.org pentru rich snippets în rezultate de căutare.

**Fix — snippet de adăugat în `main-product.liquid`:**
```liquid
<nav aria-label="Breadcrumb" class="breadcrumb">
  <ol itemscope itemtype="https://schema.org/BreadcrumbList">
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="/"><span itemprop="name">Acasă</span></a>
      <meta itemprop="position" content="1" />
    </li>
    {%- if collection -%}
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="{{ collection.url }}"><span itemprop="name">{{ collection.title }}</span></a>
      <meta itemprop="position" content="2" />
    </li>
    {%- endif -%}
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <span itemprop="name">{{ product.title }}</span>
      <meta itemprop="position" content="3" />
    </li>
  </ol>
</nav>
```

---

### 11. Butonul "PLĂTEȘTE CU CARDUL" — poziționare ambiguă

**Problema:** Butonul apare **după** formularul EasySell, la o poziție separată în pagină. Fluxul vizual nu e clar — utilizatorul a completat deja formularul COD și acum mai apare un buton de plată. Confuzie maximă.

**Fix:** Grupează opțiunile de plată vizual, cu separator clar:
```
[COMANDĂ ACUM - Ramburs la livrare]   ← CTA primar
─────────── sau plătește acum ───────────
[💳 PLĂTEȘTE CU CARDUL]               ← CTA secundar
```

---

### 12. FAQ identic pe toate produsele

**Fișier:** `sections/product-faq.liquid`

Cele 4 întrebări sunt **hardcodate** și identice pe toate paginile:
- "Cât durează livrarea?"
- "Ce metode de plată acceptați?"
- "Cum returnez un produs?"
- "Produsele sunt certificate și sigure?"

Un aparat de lifting facial are cu totul alte întrebări decât o lesă de câine sau un cablu de încărcare.

**Fix:** Adaugă suport pentru metafield per produs:
```liquid
{%- assign faq_mf = product.metafields.custom.faq_items -%}
{%- if faq_mf != blank -%}
  {{ faq_mf | metafield_tag }}
{%- else -%}
  {{- /* FAQ generic curent ca fallback */ -}}
{%- endif -%}
```

---

### 13. Lipsă canal de contact rapid (WhatsApp/chat)

**Problema:** Pe pagina de produs nu există niciun canal de contact vizibil în timp real. Clienții cu întrebări pre-comandă (mai ales pentru produse de 259–349 RON) abandonează dacă nu pot întreba rapid. Email-ul are latență de ore — prea lent pentru cumpărători impulsivi dintr-o reclamă Facebook.

**Statistică:** Live chat reduce rata de abandon cu 20-40% (conform Shopify research 2025).

**Fix:** Adaugă buton WhatsApp floating sau widget Tidio/Facebook Messenger (plan gratuit disponibil).

---

## 🟡 PROBLEME DE CONȚINUT, ASPECT ȘI GRAFICĂ

---

### 14. Homepage Hero — propunere de valoare inexistentă

**Starea actuală:**
- Headline: **"Trending 2026"** — nu comunică nicio valoare
- Subheadline: **"Produse practice pentru viata de zi cu zi"** — generic, orice magazin poate spune asta
- CTA: **"Exploreaza produsele"** — pasiv, nu motivează acțiunea

**Conform best practices (Shopify Blog):** Hero-ul trebuie să răspundă în 3 secunde la "De ce să cumpăr de la voi?" nu de la Amazon, eMag sau alt concurent.

**Fix recomandat:**
- Headline: "Gadgeturi care chiar funcționează — livrate în 24h"
- Subheadline: "Descoperă produsele care rezolvă problemele de zi cu zi"
- CTA: "Vezi ofertele zilei →"
- Sub CTA: "⭐ 4.8 din 500+ recenzii verificate · Livrare DPD · Ramburs disponibil"

---

### 15. Badge "🔥 Best Seller" — pe toate produsele

**Fișier:** `templates/product.json`

```json
"show_bestseller_badge": true  ← setare globală
```

**Problema:** Badge-ul apare pe **fiecare produs** din magazin. Dacă totul e Best Seller, nimic nu e Best Seller. Clienții nu mai cred badge-ul.

**Fix:** Adaugă metafield per produs și condiționează:
```liquid
{%- if section.settings.show_bestseller_badge and product.metafields.custom.is_bestseller -%}
  <span class="azora-gallery-badge azora-gallery-badge--bestseller">🔥 Best Seller</span>
{%- endif -%}
```

---

### 16. Imagini insuficiente per produs

**Starea observată:** Produsele au 1 imagine principală (uneori 2-3), fără consistență.

**Conform Baymard Institute:** Paginile de produs cu 6-8 imagini convertesc semnificativ mai bine. Utilizatorii caută să vadă produsul din multiple unghiuri înainte de decizie.

**Tipuri de imagini necesare per produs:**
1. Produs pe fundal alb/neutru (imagine principală clară)
2. Produs în utilizare (context real, mâna clientului)
3. Detaliu features/butoane
4. Comparație before/after (dacă aplicabil)
5. Conținut pachet complet
6. Dimensiuni/scale (față de mână sau obiect familiar)

**Impact:** Video demo 30-60 sec reduce rata de retur cu 57% și crește conversia cu +80-86% față de pagini fără video (Baymard + Gumlet research).

---

### 17. Culoarea butonului CTA — testare A/B recomandată

**Starea actuală:** CTA primar are culoare magenta/mov intens (`#c026d3`).

**Conform CXL Institute:** Culoarea CTA nu contează atât de mult cât **contrastul față de restul paginii**. Movul pe alb are contrast acceptabil, dar portocaliu (`#F97316`) și verde (`#16A34A`) sunt mai asociate cu urgența/confirmarea în psihologia culorilor pentru e-commerce.

**Recomandare:** Testează A/B cu portocaliu sau verde. Păstrează consistent pe toate CTA-urile primare.

---

### 18. Trust icons bar — duplicare și poziționare sub fold

**Problema:** Există două seturi de trust icons:
1. **Mini trust icons** (above fold, în blocul product info): 🛡️🚚↩️💳 — bine poziționat
2. **Secțiunea trust-icons** (below fold, după descriere): 4 icoane SVG mari — duplică informația

**Fix:** Elimină secțiunea mare de trust icons (poziția 3 în template) sau transformă-o în ceva diferit (ex: "De ce Azora?" cu statistic reale). Mini trust icons above fold sunt suficiente și mai eficiente.

---

### 19. Card produs — "VEZI PRODUSUL" vs "Adaugă în coș"

**Fișier:** `snippets/card-product.liquid`, linia 189

**Starea actuală:** Pentru produse cu o singură variantă, butonul navighează la pagina produsului în loc să adauge direct în coș.

**Problema:** Adaugă un click extra în funnel. Pe mobile (94% din traficul Facebook), această fricțiune crește bounce rate.

**Fix:** Add-to-cart AJAX direct de pe card pentru produse single-variant — elimină un pas din funnel.

---

### 20. Announcement bar — threshold de livrare gratuită prea sus față de prețul mediu

**Starea actuală:** "Livrare gratuita la comenzi peste 400 RON"

**Problema:** Media produselor este 39–259 RON. Un client care comandă un cablu de 39 RON ar trebui să cheltuie de 10x mai mult pentru livrare gratuită. Costul de livrare (20 RON) apare abia la checkout — abandon predictibil.

**Conform Baymard:** 48% din coșuri sunt abandonate din cauza costurilor neașteptate la checkout.

**Fix:** Afișează progresul spre livrare gratuită în cart drawer:
- "Mai ai 50 RON până la livrare gratuită!"
- Funcționalitate disponibilă nativ în Dawn cart drawer

---

### 21. Lipsă informații despre magazin pe pagina de produs

**Problema:** Un client venit prima dată de pe o reclamă Facebook nu cunoaște Azora. Lipsesc complet:
- Când a fost înființat magazinul / câți ani de activitate
- Număr total comenzi livrate
- Recenzii agregatale magazin (nu doar produs)
- "Cine suntem" — brand story scurt

**Fix:** Adaugă o secțiune scurtă "De ce Azora?" cu date reale:
```
✓ 2300+ comenzi livrate   ✓ 4.8⭐ din 127 recenzii   ✓ 3 ani pe piață
```

---

### 22. Reviews-static section — heading fără conținut

**Fișier:** `sections/product-reviews-static.liquid`

Secțiunea conține doar un heading "CE SPUN CUMPARATORII" și nimic altceva. Reviews reale sunt în widgetul Judge.me de dedesubt, dar există un gap vizual confuz între heading și widget.

**Fix:** Elimină secțiunea `reviews-static` separată și adaugă heading-ul direct în blocul Judge.me app, sau mută heading-ul în widgetul app.

---

## ✅ CE FUNCȚIONEAZĂ BINE (nu modifica)

| Element | Status | De ce e bun |
|---------|--------|-------------|
| Announcement bar cu 3 mesaje rotate | ✅ | Trust signals vizibile imediat |
| Mini trust icons above fold (🛡️🚚↩️💳) | ✅ | Poziționare corectă, above fold |
| EasySell COD form | ✅ | Esențial pentru RO, bine integrat |
| Judge.me cu autopublish:false | ✅ | Control calitate reviews |
| YouTube float (când metafield setat) | ✅ | Feature excelent pentru conversie |
| Countdown timer ca concept | ✅ | Crește conversia — bug-urile sunt fixabile |
| Descrieri detaliate cu before/after | ✅ | Bune pentru SEO și conținut |
| Discount badge pe galerie (-X%) | ✅ | Vizibil și clar positioned |
| Collapsible tabs specs + livrare | ✅ | UX curat, nu aglomerează |
| Schema.org Product markup | ✅ | SEO corect implementat |
| Card product cu hover secondary image | ✅ | UX plăcut pe desktop |
| Video facade cu lazy load iframe | ✅ | Performance corectă |

---

## 📊 DATE DIN RESEARCH — STATISTICI CHEIE (surse oficiale)

| Statistică | Valoare | Sursă |
|-----------|---------|-------|
| % cumpărători care citesc reviews | 95% | Baymard Institute |
| % care caută recenzii negative intenționat | 53% | Baymard Institute |
| Impact recenzii vizibile pe conversie | +65% | Baymard Institute |
| Impact video demo pe conversie | +80–86% | Baymard + Gumlet |
| Impact video pe rata de retur | -57% | Video marketers research |
| Impact garanție bani înapoi 30 zile | +32–34% | Zigpoll / Shopify |
| Abandon coș din cauza costurilor ascunse | 48% | Baymard Institute |
| Abandon coș din cauza metodelor de plată lipsă | 60% | Baymard Institute |
| Countdown timer autentic pe conversie | +30–50% | CRO industry |
| Trafic Facebook care vine de pe mobil | 94% | Meta Business |
| Site-uri de top cu UX mediocru pe produs | 62% | Baymard Institute |
| Rate de conversie global e-commerce 2026 | 3.61% | Triple Whale |
| Live chat — reducere abandon | -20–40% | Shopify research |
| Delivery date unclear — top abandon reason | Top 5 | Baymard |
| Forced account creation — abandon | 24% | Baymard |

---

## 📋 REZUMAT PRIORITĂȚI ȘI PLAN DE ACȚIUNE

### 🔴 IMEDIAT (sub 2 ore, risc legal sau bug critic)

| # | Problemă | Fișier | Efort |
|---|----------|--------|-------|
| 1 | Elimină/înlocuiește social proof fals | `main-product.liquid` | 15 min |
| 2 | Fix bug H1 duplicat (SEO) | `main-product.liquid:113` | 5 min |
| 3 | Fix bug cantitate "Plătește cu cardul" | `product-direct-payment.liquid` | 30 min |
| 4 | Înlocuiește "Doar 7 bucăți" cu date reale din stoc | `product.json` + Liquid | 20 min |
| 5 | Ascunde rating 0/5 pe carduri fără reviews | `card-product.liquid` | 10 min |

### 🟠 SĂPTĂMÂNA ACEASTA

| # | Problemă | Fișier | Efort |
|---|----------|--------|-------|
| 6 | Fix countdown timer (100%, expirare, sessionStorage) | `main-product.liquid` | 1h |
| 7 | Ierarhhizează 3 CTA-uri (primar/secundar) | CSS + `product.json` | 1h |
| 8 | Mută reviews mai sus în pagină (poziția 5, nu 10) | `product.json` | 15 min |
| 9 | Activează rating pe related products | `product.json` | 5 min |
| 10 | Elimină secțiunea trust-icons duplicată | `product.json` | 5 min |
| 11 | Fix badge "Best Seller" — condiționat per produs | `main-product.liquid` | 30 min |

### 🟡 LUNA ACEASTA

| # | Problemă | Efort |
|---|----------|-------|
| 12 | Adaugă breadcrumb cu schema.org | 2h |
| 13 | Hero homepage — rewrite titlu + CTA | 30 min |
| 14 | FAQ per produs via metafield | 2h |
| 15 | WhatsApp/chat contact button | 1h |
| 16 | Progress bar livrare gratuită în cart drawer | 2h |
| 17 | Secțiune "De ce Azora?" cu date reale | 1h |

### 🔵 ONGOING (îmbunătățiri continue)

| # | Problemă |
|---|----------|
| 18 | 6-8 imagini per produs (fotografiere/editare) |
| 19 | Video demo 30-60 sec per produs principal |
| 20 | A/B test culoare CTA (portocaliu vs mov actual) |
| 21 | Colectare și publicare reviews reale (mai agresiv) |
| 22 | FAQ per produs — completare metafields |

---

## CHECKLIST PRE-LANSARE RECLAMĂ FACEBOOK

Înainte de a porni/scala orice campanie Facebook, verifică:

- [ ] Pagina de produs are minimum 4 imagini de calitate
- [ ] Prețul și discount-ul sunt vizibile above the fold
- [ ] CTA primar este clar și contrastant
- [ ] Trust signals (mini icons) sunt above fold
- [ ] Countdown timer funcționează corect (pornește la 100%, are mesaj la expirare)
- [ ] Social proof provine din date reale (reviews Judge.me count)
- [ ] Stocul afișat corespunde realității
- [ ] Formularul EasySell COD funcționează pe mobile (test pe 375px)
- [ ] Butonul "PLĂTEȘTE CU CARDUL" calculează cantitatea corect
- [ ] Page speed < 3 secunde pe mobile (testează cu Google PageSpeed Insights)
- [ ] Message match: reclama Facebook și pagina de produs comunică aceeași ofertă

---

## SURSE OFICIALE CONSULTATE

- **Baymard Institute** — 200,000+ ore de research UX e-commerce: https://baymard.com/blog
- **Shopify Blog** — best practices product pages: https://www.shopify.com/blog/product-page
- **Meta Business Help** — Facebook ads landing page optimization: https://www.facebook.com/business/help/203012060587398
- **CXL Institute** — CRO research: https://cxl.com/blog
- **Nielsen Norman Group** — above the fold & product pages: https://www.nngroup.com
- **Zigpoll** — money-back guarantee impact: https://www.zigpoll.com
- **Gumlet** — product videos & conversions: https://www.gumlet.com/learn/product-videos-boost-conversions/
- **Lebesgue** — Facebook ads optimization: https://lebesgue.io/facebook-ads/landing-page-optimization-for-facebook-ads
- **Triple Whale** — CRO trends 2026: https://www.triplewhale.com/blog/conversion-rate-optimization-cro

---

---

# ANALIZĂ DATE REALE — BAZA DE DATE PRODUCȚIE
**Sursă:** PostgreSQL Railway (producție) + Tracking events azora.ro  
**Data analizei:** 2026-04-05  
**Volum date:** 41 comenzi · 284 journey sessions · 1059 tracking events · 18 campanii Meta · 56 zile metrici

---

## FUNNEL COMPLET — DE LA RECLAMĂ LA COMANDĂ

### Date brute (284 sesiuni înregistrate)

```
Ad Clicks (Meta)      →  Landing Page View  →  Product View  →  Scroll to Form  →  Form Start  →  Form Submit  →  Order Confirmed
     [Meta]                  [Meta LPV]          [Tracking]        [Tracking]       [Tracking]     [Tracking]        [Tracking]

     4.562               3.114 (68%)          250 (5.5%)         44 (17.6%)         14 (5.6%)       6 (2.4%)          6 (2.4%)
                                           ↑ drop major        ↑ drop critic       ↑ drop         ↑ drop            ↑ ok
```

### Ratele de conversie pe fiecare pas

| Pas funnel | Volum | Rată față de pasul anterior | Observație |
|-----------|-------|----------------------------|------------|
| Clicks Meta → Landing Page Views | 3.114 / 4.562 | 68.3% | **31.7% nu ajung pe site** |
| LPV → Product View (tracking) | 250 / 3.114 | **8.0%** | **Gap enorm — tracking parțial** |
| Product View → Scroll to Form | 44 / 250 | 17.6% | Critică — 82.4% abandona înainte de formular |
| Scroll to Form → Form Start | 14 / 44 | 31.8% | Acceptabil |
| Form Start → Form Submit | 6 / 14 | **42.9%** | Bun — cine începe, termină |
| Form Submit → Order Confirmed | 6 / 6 | 100% | Perfect |
| **Overall: Clicks → Comandă** | 6 / 4.562 | **0.13%** | Sub benchmark industrie (1-3%) |

> ⚠️ **Tracking incomplet:** 250 product_views înregistrate vs. 3.114 LPV din Meta = 92% din vizite NU sunt trackate. Pixel-ul de tracking al Azora Rise nu se declanșează pe majoritate din vizite. Datele reale de conversie sunt probabil mai bune, dar nu le cunoaștem.

---

## ANALIZA FUNNEL PER PRODUS

| Produs | Preț | Sesiuni | Scroll rate | Form start rate | Conv. rate |
|--------|------|---------|-------------|----------------|------------|
| Dispozitiv 5-in-1 EMS/LED | 349 RON | 135 | **18.7%** | 20.0% | **2.2%** |
| Lesa Dublă Retractabilă | 129 RON | 91 | **12.2%** | 45.5% | **1.1%** |
| Aparat V-Shape | 259 RON | 7 | 14.3% | 0.0% | 0.0% |
| Bagheta Magică Baloane | 129 RON | 6 | 16.7% | 0.0% | 0.0% |
| Cablu Încărcare LED | 39 RON | 3 | **66.7%** | 50.0% | **33.3%** |
| Aparat Lifting Facial | 189 RON | 3 | **0.0%** | 33.3% | 0.0% |
| Coș Rufe Suspendat | 59 RON | 2 | 50.0% | 100% | **50.0%** |

**Concluzii critice:**

1. **Produsele ieftine (39–59 RON) au scroll rate și conversie mult mai bune** — Cablul LED 33.3%, Coșul Rufe 50%. Pagina de produs funcționează mult mai bine pentru produse de impuls cu preț mic.

2. **Dispozitivul 5-in-1 (349 RON) are cel mai mare volum de trafic (135 sesiuni) dar scroll rate de doar 18.7%** — Prețul ridicat necesită mai mult conținut convingător above-the-fold. Campania care i-a adus trafic (CBO Celulita VID Net) a avut cel mai bun ROAS (5.47×), ceea ce sugerează că problema nu e targetingul, ci pagina.

3. **Aparat Lifting Facial (189 RON) — scroll rate 0%** din 3 sesiuni. Nimeni nu a scrollat până la formular. Aceasta este pagina analizată în detaliu în audit și confirmă problemele structurale: descriere prea lungă, formular prea jos, lipsă urgency credibilă.

4. **Lesa Dublă (129 RON) — 91 sesiuni, scroll rate 12.2%** — Cel mai mult trafic după Dispozitiv 5-in-1, dar rata de scroll la formular este mică. Prezent în campania activă (02 CBO Lesa Caini).

---

## ANALIZA CAMPANIILOR META

### Performanță generală (total spend: ~4.500 RON)

| Campanie | Spend | ROAS | CTR | LPV Rate | Obs. |
|----------|-------|------|-----|----------|------|
| 01 CBO Celulita VID Net | 291 RON | **5.47×** | 3.09% | 49.7% | ✅ Best performer |
| Bagheta Bule | 1.212 RON | 2.52× | 1.65% | 66.7% | ✅ Profitabil, oprit prematur |
| CBO Celulita Vârstă/Gen | 385 RON | 1.91× | 2.59% | 56.2% | ⚠️ Sub break-even |
| 02 CBO Lesa Caini | 364 RON | 1.23× | - | **19.9%** | 🔴 LPV drop critic |
| Mini Camera | 240 RON | 1.08× | 2.75% | 70.7% | ⚠️ Break-even |
| Campanie Vânzări (gen.) | 521 RON | 0.97× | 1.93% | 66.4% | 🔴 Pierdere |
| ABO Anti-Celulita | 631 RON | 0.59× | 4.24% | 61.2% | 🔴 Pierdere majoră |
| Produse Diferite | 234 RON | 0.00× | 0.81% | 34.0% | 🔴 0 comenzi, 14 add-to-cart |
| Ursulet | 90 RON | 0.00× | 0.94% | 38.1% | 🔴 0 comenzi, 4 add-to-cart |

### Probleme identificate din date

**P1 — Lesa Caini: drop click→LPV de 80%**  
Campania "02 CBO Lesa Caini" are doar **19.9% click-to-LPV rate** — cel mai slab din toate campaniile. Din 146 clickuri, doar 29 ajung pe pagina produsului. Posibile cauze: link greșit configurat în reclamă, redirect lent, sau problema cu Facebook Instant Articles.

**P2 — Campania "Produse Diferite": 14 add-to-cart, 0 comenzi**  
234 RON cheltuiți, 14 oameni au adăugat în coș (tracking Meta), 0 comenzi finale. Cauza probabilă: add-to-cart merge în coșul standard Shopify, dar magazinul folosește EasySell bypass. Tracking-ul Meta vede add-to-cart din coș dar comenzile vin prin EasySell — **mismatch de tracking care falsifică datele**.

**P3 — ABO Anti-Celulita: ROAS 0.59, CTR 4.24%**  
CTR excelent (4.24%) înseamnă că reclama atrage atenția, dar conversia e slabă. Problema nu e reclama, ci pagina de produs sau formularul. 631 RON cheltuiți cu ROAS de 0.59 = **~260 RON pierdere netă**.

**P4 — Campania cu ROAS 0 și CTR 9.42%**  
O campanie completată (LINK_CLICKS obiectiv, 134 RON, 2781 clickuri, 0 achiziții) indică că a rulat cu obiectivul greșit. Link Clicks optimizează pentru clickuri, nu conversii — trafic ieftin (~0.05 RON/click) dar fără intenție de cumpărare.

**P5 — Campania VID Net: Best performer, oprită după 3 zile**  
Singura campanie cu ROAS > 4 (5.47×) a fost oprită după 3 zile și ~291 RON spend. Aceasta este exact campania care ar trebui scalată, nu oprită. AI report-ul confirma health score 85 "excellent" dar menționa probleme de tracking.

---

## ANALIZA COMENZILOR

### Distribuție status comenzi (41 total)

| Status Financiar | Status Livrare | Număr | Valoare totală | AOV |
|-----------------|----------------|-------|----------------|-----|
| **pending** | fulfilled ✅ | 15 | 3.503 RON | 234 RON |
| **paid** | fulfilled ✅ | 9 | 1.659 RON | 184 RON |
| **voided** | — | 8 | 1.127 RON | 141 RON |
| **pending** | unfulfilled | 7 | 1.703 RON | 243 RON |
| **refunded** | — | 1 | 149 RON | — |
| **voided** | fulfilled ✅ | 1 | 149 RON | — |

### Probleme critice identificate

**🔴 CRITIC: 15 comenzi livrate cu status "pending" (3.503 RON neconfirmate)**  
Aceasta este caracteristica normală a comenzilor COD (ramburs) — rămân "pending" până curierii confirmă plata. Dar faptul că 15 comenzi (36% din total) sunt livrate și plătite dar financialStatus = pending sugerează că **reconcilierea de plată nu se face automat**. Risc: comenzile pot fi considerate neîncasate în rapoarte financiare.

**🔴 CRITIC: 8 comenzi voided (1.127 RON pierdute)**  
8 comenzi anulate = 19.5% din total comenzi. Motivele posibile:
- Client a anulat înainte de livrare (normal pentru COD)
- Produs indisponibil la momentul comenzii
- Refuz la livrare (curier retur)
**O comandă (#1015) a fost livrată și ULTERIOR anulată** — aceasta este fie o rambursare forțată, fie o eroare operațională serioasă.

**🟠 IMPORTANT: 7 comenzi pending nefulfilled (1.703 RON în aer)**  
7 comenzi plasate dar nelivrate și necolectate. Din cele recente (2026-04-01 și 04-04), este posibil ca acestea să fie în procesare, dar comenzile mai vechi din martie ar trebui verificate.

### Evoluție lunară

| Lună | Comenzi | Revenue | AOV | Pending % | Voided % |
|------|---------|---------|-----|-----------|----------|
| 2026-03 | 28 | 6.033 RON | 215 RON | 46.4% | 17.9% |
| 2026-04 | 13 | 2.257 RON | 174 RON | 69.2% | 30.8% |

> ⚠️ **April 2026 este îngrijorător:** AOV a scăzut de la 215 la 174 RON (-19%), rata de pending a crescut la 69%, rata de voided la 30.8%. Posibil sezonier (magazin nou), posibil calitate trafic mai slabă, posibil problemă operațională.

---

## ANALIZA PRODUSELOR

### Ranking vânzări vs. investiție în reclame

| Produs | Preț | Marjă % | Comenzi | Revenue | Trafic sesiuni | Conv. rate |
|--------|------|---------|---------|---------|----------------|------------|
| Bagheta Magică Baloane | 129 RON | 65.2% | **20** | **3.096 RON** | 6 | 0% tracking |
| Dispozitiv 5-in-1 | 349 RON | **78.6%** | 7 | 2.443 RON | 135 | 2.2% |
| Lesa Dublă | 129 RON | 65.2% | 4 | 516 RON | 91 | 1.1% |
| Set Tren Dinozauri | 159 RON | 71.7% | 3 | 477 RON | 2 | - |
| Cablu LED | 39 RON | 80.8% | 3 | 117 RON | 3 | **33.3%** |
| Aparat V-Shape | 259 RON | 71.1% | 2 | 518 RON | 7 | 0% |
| Coș Rufe | 59 RON | **80.3%** | 1 | 59 RON | 2 | **50%** |
| Mini Camera | 239 RON | 62.3% | 1 | 239 RON | 1 | 0% |
| Lifting Facial | 189 RON | 60.4% | **0** | 0 | 3 | 0% |
| Ursulet Premium | 149 RON | 69.9% | **0** | 0 | 1 | 0% |
| Pantaloni Adulți | 189 RON | **56.4%** | **0** | 0 | 1 | 0% |

**Concluzii din date:**

1. **Bagheta Magică = star produs** — 20 comenzi cu cel mai mic ad spend relativ. Campania pentru Bagheta (1.212 RON, ROAS 2.52×, 17 comenzi Meta) a fost cea mai profitabilă ca volum și a fost oprită prematur.

2. **Dispozitivul 5-in-1 = produs cu cel mai mare potențial** — marjă 78.6% (274 RON profit/unitate), ROAS 5.47× din campania VID Net. Merită toată atenția și bugetul.

3. **Trei produse cu 0 comenzi + 0 trafic**: Lifting Facial, Ursulet, Pantaloni Adulți — fie nu au rulat campanii, fie campaniile nu au performat deloc.

4. **Cablu LED (39 RON)** — conversie de 33% și marjă 80.8%, dar preț prea mic pentru ads profitabile standalone. Funcționează perfect ca upsell în EasySell.

5. **Pantaloni Adulți (189 RON) — marjă cea mai mică (56.4%)** și 0 comenzi. Produs nișă, audience dificil de targetat pe Facebook.

---

## ANALIZA TRACKING — PROBLEME TEHNICE

### Breakdown tracking events (1.059 total)

| Event | Count | Sesiuni unice |
|-------|-------|---------------|
| page_view | 495 | 282 |
| product_view | 346 | 250 |
| scroll_to_form | 105 | 44 |
| form_progress | 84 | 10 |
| form_interaction_start | 16 | 14 |
| order_confirmed | 9 | 6 |
| form_submit_cod | 7 | 6 |

### Anomalii detectate

**🔴 Anomalie 1: form_progress (84) > form_interaction_start (16)**  
Există de 5× mai multe eventi `form_progress` decât `form_interaction_start`. Asta indică un bug de tracking: `form_progress` se declanșează fără ca `form_interaction_start` să fi fost înregistrat. Unele sesiuni trec direct la progress fără start.

**🔴 Anomalie 2: order_confirmed (9) > form_submit_cod (7)**  
9 comenzi confirmate cu doar 7 submituri de formular EasySell. Cele 2 comenzi în plus au venit probabil prin checkout standard Shopify (plată cu cardul), dar tracking-ul nu le captează ca `form_submit_cod`.

**🔴 Anomalie 3: Timestamps negative în journey sessions**  
Query-ul de timp între pași returnează valori negative (ex: -1092 sec, -81 sec, -123404 sec). Asta înseamnă că `reachedScrollToForm` este înregistrat cu timestamp MAI MIC decât `reachedProductView` — imposibil în condiții normale. Bug în ordinea de înregistrare a evenimentelor sau timezone mismatch.

**🟠 Anomalie 4: 250 product_views vs. 3.114 Meta LPV (8% tracking rate)**  
Din 3.114 persoane care au ajuns pe pagina de produs conform Meta, doar 250 (8%) sunt înregistrate în sistemul de tracking Azora Rise. 92% din vizite nu sunt capturate. Posibile cauze:
- Script-ul de tracking se încarcă prea târziu (după ce utilizatorul pleacă)
- Blockers (adblockers, Safari ITP, iOS)
- Tracking-ul nu se inițializează pe toate paginile de produs
- Pixel-ul Meta și tracking-ul intern folosesc ferestre de atribuire diferite

---

## ANALIZA PAGINILOR DE PRODUS (LESA + MINI CAMERA)

### Lesa Dublă Retractabilă (129 RON)
**Journey data:** 91 sesiuni, 12.2% scroll rate, 1.1% conversie  
**Campania activă:** 02 CBO Lesa Caini — ROAS 1.23×, LPV rate **19.9%** (cel mai slab)

**Probleme specifice identificate:**
- Formularul EasySell are **9+ câmpuri obligatorii** — Baymard arată că fiecare câmp adițional scade conversia cu 4-8%
- 0 recenzii Judge.me afișate — pagina arată "Fii primul care scrie o recenzie"
- 13 imagini disponibile ✅ dar fără video
- Produse upsell preselected (5 produse adăugate automat) — cresc valoarea comenzii dar pot speria utilizatorul la total price prea mare
- LPV rate de 19.9% din campanie → mulți oameni dau click pe reclamă dar nu ajung pe site (posibil link greșit sau pagina prea lentă)

### Mini Camera Video 1080P (239 RON)  
**Journey data:** 1 sesiune înregistrată, 0 scroll, 0 conversie  
**Campania:** CBO Mini Camera — ROAS 1.08×, 240 RON spend, 1 comandă

**Probleme specifice identificate:**
- **Titlul paginii este trunchiat** la ~70 caractere: "Mini Camera Video 1080P Full HD WiFi pentru Creatori de Continut si Vl" — lipsesc cuvintele finale. Bug SEO și UX.
- 0 recenzii — widget Judge.me gol
- Fără video demo (produs video care se vinde singur dacă ai un video bun)
- Upsell-urile EasySell includ **chiar același produs** (Mini Camera cu 40% reducere) ca opțiune add-on — logică greșită, nu poți adăuga același produs ca upsell la el însuși
- Formularul arată timer de urgency hidden pe mobile (`hide_on_mobile: true`) — 94% din traficul Facebook e pe mobil

---

## CONCLUZII ȘI PRIORITĂȚI DIN DATE REALE

### Probleme noi identificate din date (neacoperite în auditul inițial)

#### 🔴 CRITIC

| # | Problemă | Impact estimat |
|---|----------|----------------|
| D1 | Tracking rate 8% — 92% din vizite neînregistrate | Orbire completă asupra conversiei reale |
| D2 | Timestamps negative în JourneySession — bug de înregistrare | Date funnel incorecte |
| D3 | form_progress fără form_interaction_start — bug tracking | Ratele de conversie calculate greșit |
| D4 | Titlu trunchiat Mini Camera ("Vl") | SEO penalizat, UX neplăcut |
| D5 | Același produs apare ca upsell la el însuși (Mini Camera) | Confuzie client, credibilitate afectată |

#### 🟠 IMPORTANT

| # | Problemă | Impact estimat |
|---|----------|----------------|
| D6 | 15 comenzi COD livrate cu status "pending" — reconciliere manuală necesară | Risc financiar, rapoarte greșite |
| D7 | 8 comenzi voided (19.5%) — rată de anulare mare | ~1.100 RON pierdute |
| D8 | Campania VID Net (ROAS 5.47×) oprită după 3 zile — scalare pierdută | Oportunitate majoră ratată |
| D9 | Campania ABO Anti-Celulita: CTR 4.24% dar ROAS 0.59× | 260 RON pierdere, problemă de pagină |
| D10 | LPV rate 19.9% pentru Lesa Caini — posibil link greșit în reclamă | 80% din buget risipit |
| D11 | Campanie obiectiv LINK_CLICKS (9.42% CTR, 0 vânzări) — obiectiv greșit | 134 RON irosiți |
| D12 | Urgency timer hidden pe mobile pentru Mini Camera | 94% din trafic nu vede urgency |
| D13 | 0 recenzii pe Lesa Dublă și Mini Camera — widget gol | Social proof absent exact unde e cel mai mult trafic |

#### 🟡 MEDIU

| # | Problemă | Impact estimat |
|---|----------|----------------|
| D14 | Campania Produse Diferite: 14 add-to-cart Meta vs. 0 comenzi — mismatch tracking | Date Meta false, buget 234 RON irosiți |
| D15 | AOV Aprilie 174 RON vs. Martie 215 RON — scădere 19% | Semnal de avertizare, urmărire necesară |
| D16 | 3 produse cu 0 comenzi și marje bune (Lifting Facial 60%, Ursulet 70%) | Oportunitate neexploatată |
| D17 | Lifting Facial — 0 scroll rate din 3 sesiuni | Pagina nu reține utilizatorul nicio secundă |

---

## RECOMANDĂRI PRIORITARE DIN ANALIZA DATELOR

### Acțiuni imediate (această săptămână)

1. **Fix tracking script** — identifică de ce doar 8% din vizite sunt capturate. Verifică dacă script-ul azora.js se încarcă pe toate paginile de produs sau dacă există erori de JavaScript în consolă.

2. **Fix titlu Mini Camera** — adaugă restul cuvintelor lipsă din titlu ("...si Vlog").

3. **Elimină Mini Camera din upsell-urile la Mini Camera** — nu are sens un produs ca upsell la el însuși.

4. **Verifică link-ul din campania Lesa Caini** — LPV rate de 19.9% sugerează că link-ul din reclamă poate fi greșit. Testează click pe reclamă și verifică unde ajungi.

5. **Schimbă obiectivul campaniilor noi la "Purchase" (conversii)** — nu "Link Clicks" sau "Landing Page Views".

### Acțiuni pe termen scurt (luna aceasta)

6. **Repornește campania VID Net pentru Dispozitiv Celulita** — a avut ROAS 5.47× cu 8 comenzi în 3 zile. Mărește bugetul progresiv (regula 20-30% per zi) și monitorizează.

7. **Colectează primele recenzii pe Lesa și Mini Camera** — trimite email post-comandă la cei 4-5 clienți care au cumpărat. Oferă 10-20 RON reducere la următoarea comandă în schimbul unui review.

8. **Reconcilierea comenzilor pending** — setează un proces săptămânal de verificare a comenzilor COD livrate: dacă curierii confirmă plata, actualizează manual statusul în Shopify.

9. **Activează urgency timer pe mobile pentru Mini Camera** — schimbă `hide_on_mobile: true` în `false`.

10. **Investigează comenzile voided** — mai ales #1015 (livrată și anulată). Dacă sunt refuzuri la livrare, adaugă un pas de confirmare telefonică pre-livrare pentru comenzile mari (>250 RON).

### Acțiuni strategice

11. **Prioritizează Dispozitiv 5-in-1 și Bagheta** — sunt produsele cu cel mai bun track record (20 + 7 comenzi, margini >65%). Orice buget nou de reclame merge prioritar pe acestea.

12. **Analizează de ce Lifting Facial are 0 comenzi** — produs cu 189 RON și marjă 60.4%, dar 0 scroll, 0 comenzi. Paginaa nu convinge deloc. Fie redesign complet, fie scoate din portofoliu activ de reclame.

13. **Implementează reconciliere automată COD** — Shopify webhook pentru `order/updated` → când fulfillment status devine "fulfilled" pentru comenzi COD, trimite reminder intern să verifice plata.

---

## ANALIZA FORMULARULUI EASYSELL COD

### Starea actuală

Formularul EasySell este **punctul cel mai critic din funnel** — utilizatorul a ajuns până aici, intenția de cumpărare există. Orice fricțiune sau confuzie în formular = abandon direct.

Câmpuri vizibile în formular (ordine actuală):
1. Nume* 
2. Prenume*
3. CUI Firmă *(opțional, cu notă despre factură)*
4. Email*
5. Telefon*
6. Județ* *(dropdown)*
7. Localitate* *(dropdown)*
8. Adresă*
9. Observații *(opțional)*
10. Discount Code + buton "Aplică"

CTA: **"COMANDĂ ACUM - 259,00 RON"** + "Plată la livrare (ramburs)"  
Alternativă: **"PLĂTEȘTE CU CARDUL"**

---

### 🔴 Probleme critice în formular

#### F1 — Etichete în engleză pe site românesc (inconsistență brand)

**Problema:** Câmpul "Discount Code" și badge-ul "Save 40%" din sumar sunt în engleză, deși tot restul site-ului este în română.

**Impact:** Transmite lipsă de profesionalism. Utilizatorul român percepe site-uri cu limbi amestecate ca mai puțin de încredere — factor de abandon documentat.

**Fix:** Configurează EasySell → traduceri → setează:
- "Discount Code" → **"Cod Reducere"**  
- "Save 40%" → **"Economisești 40%"** sau **"-40%"**

---

#### F2 — Câmpul CUI Firmă vizibil pentru toți utilizatorii

**Problema:** Câmpul "CUI Firmă" apare în formular deși azora.ro este un magazin B2C (consumatori finali). 99%+ din cumpărători sunt persoane fizice, nu firme.

**Impact:** Crează confuzie ("trebuie să completez?", "îmi trebuie factură?") și lungește vizual formularul inutil. Baymard Institute documentează că fiecare câmp suplimentar perceput ca obligatoriu crește rata de abandon cu 2-5%.

**Fix:** Dacă EasySell nu permite ascunderea completă, mută câmpul CUI sub un toggle colapsabil: *"Vreau factură pe firmă"* → la click apare CUI. Implicit ascuns.

---

### 🟠 Probleme importante în formular

#### F3 — 8 câmpuri obligatorii = formular lung pe mobil

**Problema:** 8 câmpuri marcate cu `*` (fără CUI) pe ecran mic de telefon înseamnă scroll extins + risc ridicat de abandon la jumătate.

**Context:** Baymard Institute: formularul mediu de checkout are **14.88 câmpuri**, dar utilizatorii percep ca necesar doar 7-8. Pentru COD românesc, necesarul real este: Nume + Prenume + Telefon + Județ + Localitate + Adresă = **6 câmpuri**. Email poate fi opțional pentru COD.

**Fix:**
- Fă **Email opțional** pentru COD (este necesar doar pentru confirmare, nu pentru livrare)
- Sau combină Județ + Localitate într-un singur câmp cu autocomplete (ex: utilizatorul tastează "Cluj" și vede sugestii)

---

#### F4 — Timer duplicat (apare atât pe pagina produsului cât și în formular)

**Problema:** Countdown-ul de urgență apare de două ori: o dată în secțiunea main-product (`countdown_urgency` block) și din nou în formularul EasySell cu "⏳ Promoția se termină în: 02:35".

**Impact pozitiv:** Repetarea urgency în formular este bună strategie CRO — amintește utilizatorului motivul pentru care trebuie să finalizeze rapid.

**Problem real:** Dacă cele două timere pornesc la momente diferite, vor afișa valori diferite. Utilizatorul vede "04:12" sus și "02:35" jos → pierde credibilitatea ambelor.

**Fix:** Sincronizează ambele timere din același `sessionStorage` key. Codul actual din `main-product.liquid` salvează în `sessionStorage` — EasySell trebuie să citească același key sau să afișeze același timp.

---

#### F5 — Transport 20 RON vizibil fără context de livrare gratuită

**Problema:** Sumarul din formular arată:
```
Subtotal: 239,00 RON
Transport: 20,00 RON
Total:     259,00 RON
```

Utilizatorul vede că plătește 20 RON transport. Dacă există un prag de livrare gratuită (ex: comenzi peste 300 RON), acesta nu este comunicat nicăieri în formular.

**Oportunitate ratată:** Un mesaj de tipul *"Mai adaugă produse de 61 RON pentru livrare gratuită"* direct deasupra costului de transport ar putea crește AOV (Average Order Value) și reduce percepția negativă față de costul de transport.

**Fix:** Dacă EasySell suportă mesaje dinamice în sumar, configurează un banner de upsell condiționat de total < prag livrare gratuită.

---

### 🟡 Observații și îmbunătățiri minore

#### F6 — Lipsă autocomplete pentru adresă

**Problema:** Câmpul "Adresă" este un simplu text input fără Google Places autocomplete sau altă sugestie.

**Impact:** Pe mobil, tastarea adresei complete (str. Exemplu nr. 5, bl. A2, ap. 10) este lentă și predispusă la greșeli — greșelile de adresă generează comenzi nelivrate.

**Fix:** Integrează Google Places API sau folosește un serviciu românesc de validare adrese (ex: geo.fmi.unibuc.ro sau ANCPI). EasySell poate suporta câmpuri custom sau poate fi completat cu un snippet JavaScript în Shopify.

#### F7 — Câmpul "Observații" poate fi clarificat

**Problema:** "Observații (opțional)" este vag. Utilizatorii nu știu ce să scrie acolo.

**Fix:** Schimbă placeholder în: *"Ex: etaj 3, interfon 15, livrat după ora 18"* — reduce livrările eșuate din cauza adreselor incomplete.

#### F8 — Butonul "PLĂTEȘTE CU CARDUL" este bine poziționat ✅

**Observație pozitivă:** Separarea vizuală clară între "COMANDĂ ACUM (ramburs)" și "PLĂTEȘTE CU CARDUL" cu separatorul "sau" este o implementare corectă. Utilizatorul înțelege că are două opțiuni distincte, fără confuzie. Această structură respectă best practices pentru dual-CTA pe pagini de checkout.

---

### Rezumat priorităților pentru formular

| # | Problemă | Efort | Impact |
|---|----------|-------|--------|
| F1 | Etichete EN → RO (Discount Code, Save 40%) | Mic (configurare EasySell) | Mediu (credibilitate) |
| F2 | Ascunde CUI Firmă implicit | Mic | Mediu (reducere fricțiune) |
| F3 | Email opțional pentru COD | Mic | Mediu (mai puțin friction) |
| F4 | Sincronizare timer (același sessionStorage key) | Mediu (JS) | Mare (credibilitate urgency) |
| F5 | Mesaj upsell livrare gratuită în sumar | Mediu (EasySell config) | Mare (AOV ↑) |
| F6 | Autocomplete adresă | Mare (API integration) | Mediu (reducere erori livrare) |
| F7 | Placeholder "Observații" mai clar | Mic (text) | Mic |

