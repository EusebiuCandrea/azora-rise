# Meta Ads Knowledge Base — AC Hampton (YouTube Transcript)
**Source:** https://www.youtube.com/watch?v=R1SXcw9leZs  
**Video:** "Complete Facebook Ads Course for 2026 (Step-By-Step)"  
**Creator:** AC Hampton — Supreme Ecom, $20M+ ad spend managed, 5,000+ students  
**Extracted:** 2026-04-05 via youtube-transcript-api (verbatim transcript)

---

## 1. Backend Setup (Obligatoriu înainte de orice reclamă)

### Facebook Page
- Creat din Facebook → Pages → Create New Page
- Categorie: "Shopping Service" sau ce se potrivește nișei
- Bio simplu, poate fi generat cu ChatGPT
- Adaugă website, email, telefon, poză profil, copertă

### Domain Verification
- Verifică domeniul în Meta Business Manager → Brand Safety → Domains
- **Obligatoriu** după iOS 14 pentru ca AEM să funcționeze corect
- Conectează domeniul Shopify înainte de orice campanie de conversii

### Business Portfolio (Meta Business Manager)
- Creat la business.facebook.com
- Folosește **numele real exact** cum apare pe ID (pentru verificare identitate)
- Centralizează: Facebook Page + Ad Account + Meta Pixel

### Pixel + Conversions API
- Instalat prin Shopify → Facebook & Instagram Sales Channel
- **Setează data sharing la "Maximum"** — activează atât browser Pixel cât și server-side Conversions API
- Verifică că pixelul trece din roșu în verde în Events Manager
- Testează pixel: navighează ca un client (product page → add to cart → checkout start)

### Aggregated Event Measurement (AEM)
- Prioritatea evenimentelor: Purchase #1 → Add Payment Info → Initiate Checkout → Add to Cart → View Content
- **Purchase trebuie să fie mereu #1**

---

## 2. Warm-Up Campaign (Nou cont — obligatoriu)

> "A brand new ad account with no activity, no engagement, and no pixel data — Meta sees that as a risk."

- **Obiectiv:** Engagement → Manual Engagement Campaign
- **Adset:** Warm-up, Tier 1 countries, Age 21+, $10/day
- **Engagement type:** Facebook Page
- **Ad:** O imagine simplă, un caption scurt (2 linii max), ceva pozitiv
- **Tracking:** Verifică că pixelul e activ (verde) sub tracking
- **Lansare:** Oricând, nu necesită miezul nopții
- Lasă să ruleze — dă semnal lui Meta că contul e activ și legitim

> "Meta is stricter than it's ever been before. Brand new ad accounts are getting flagged, slowed down, and pushed to the back of the line."

---

## 3. Cercetare Creativă

### TikTok Research
- Caută numele produsului pe TikTok
- Filtrează după **likes** (nu views) — engagement real = demand real
- Caută: demonstrație clară a produsului, fără watermark, fără logo de brand, fără editare complexă
- UGC raw (User Generated Content) = cel mai valoros format
- Semnale de interes: comentarii cu întrebări, experiențe personale, dezbateri

### Meta Ad Library
- Caută produsul/nișa → vezi toate reclamele concurenților
- Identifică **unghiuri** (angles) repetate → semnalează că funcționează
- Descarcă video cu Video Downloader Plus (extensie browser)

### Generare Copii cu ChatGPT
- Nu copia text word-for-word
- Prompt: *"This is my competitor's primary text for their Meta ad. Make me my own high converting version of this for my sales campaign."*
- Cere 3 variante: problem angle, convenience angle, emotional benefit angle

### Mix de Creativuri
- Minim 5 creativuri total
- Mix de video + imagini (nu presupune care va performa — lasă data să decidă)

---

## 4. Structura Campaniei de Testare Creativă

### Setup Campanie
- **Obiectiv:** Sales (Conversion)
- **Activează CBO** — Meta distribuie bugetul spre cel mai puternic creativ
- **Budget:** $50/day recomandat ($20-25 = date mai lente; $50 = claritate în 1-2 zile)
- **Start:** Mereu la **miezul nopții**

> "If you turn your ads on at 3 p.m., Meta will try to spend that full daily budget in only a couple hours, which ultimately hurts your performance. Midnight gives you clean delivery and clean data."

### Setup Adset
- **Conversion location:** Website → **Product page** (NU homepage)
- **Performance goal:** Maximize number of conversions
- **Event:** Purchase (MEREU)
- **Targeting:** Broad (fără interese detaliate pentru testing creativ)
- **Locații:** US, Canada, UK, Australia, New Zealand
- **Vârstă:** 21+
- **Limbă:** English

### Setup Ad
- Conectat la Facebook Page + Instagram Account
- URL: **product page direct** (mai puține clickuri = conversii mai mari)
- Câte un ad separat pentru fiecare creativ (5 creativuri = 5 ads în același adset)
- **Duplicate** primul ad și schimbă doar creativul (nu reconstrui de la zero)
- La duplicat verifică: URL, CTA (Shop Now), Pixel, Copy, Creativ corect selectat

### Ad Copy Structure
- **Prima linie = 90% din succes** — dacă nu oprește scroll-ul, nimic altceva nu contează
- Linii scurte, spațiate, fără blocuri de text
- **"See more" clicks** = semnal pozitiv → Meta livrează mai ieftin
- **Headline:** Evidențiază oferta principală (50% off + free shipping, BOGO, buy 2 get 1 free)
- Evită headlines bland ca "Hair Growth Spray – Shop Now" — nu comunică valoare

---

## 5. KPIs și Interpretarea Datelor

### Andromeda Update (Meta 2026)
> "Meta's new Andromeda update changed everything — it puts way more weight onto creative performance than it ever has before. It automatically pushes your budget towards the ad that's getting the strongest reactions."

### Metrici Front-End (înainte de click pe website)

| Metric | Ce măsoară | Benchmark |
|--------|-----------|-----------|
| CPM | Costul la 1.000 afișări — cât de scumpă e nișa | $15-20 = bun; $30-40+ = nișă competitivă |
| CPC | Costul per click (include orice click) | Mai mic = mai bun, dar nu spune tot |
| Cost per Unique Link Click | Costul real per vizitator pe website | Limita din KPI sheet |
| CTR (Clickthrough Rate) | Miniatură + headline + copy fac oamenii să dea click? | **2-2.5%+** baseline |
| Average Video Watch Time | Cât de mult oamenii sunt interesați de produs | Mai mult = mai bun |

> "Unique link clicks count only people who reach your website. Facebook counts every click even if the same person taps your ad five times."

### Metrici Back-End (după click pe website)

| Metric | Ce măsoară | Importanță |
|--------|-----------|-----------|
| Add to Cart | Primul semn că oferta are sens | **Sfânt** în testare |
| Cost per Add to Cart | Cât costă un ATC | Comparați cu limita din KPI sheet |
| Purchases | Funnel-ul funcționează? | Principal |
| ROAS | Return on Ad Spend — câștig sau pierd? | Comparat cu break-even ROAS |
| Cost per Purchase | Comparativ cu target CPA | Sub target = profitabil |

### Break-Even Ladder (Framework decizie)
Exemplu cu break-even CPA = $23.78:
- Dacă cheltuiești $10 și nu ai niciun Add to Cart → **oprit**
- Dacă ai ATC la $8 → lasă să ruleze până la $23.78
- Dacă la $23.78 nu ai purchase → **oprit**
- Dacă ai purchase → break-even următor = $47.56
- Continuă: $71.34, $95.12, $118.90...

> "Once purchases come in, you move through the break-even ladder where each step tells you exactly how far to let the ad spend go before deciding if it stays or gets cut."

### Framework simplu de înțeles
- **CTR** → creativul și thumbnailul sunt interesante?
- **Unique Link Clicks** → oamenilor le pasă suficient să dea click?
- **Add to Cart** → oferta are sens?
- **Purchase** → funnel-ul funcționează?
- **ROAS** → am făcut bani?

---

## 6. Identificarea Câștigătorilor și Decizia

### Semnale de winner
- ROAS pozitiv, peste break-even (ex: target 1.74 = 20% profit margin; 3.28 = ~40% profit margin)
- Add to Carts consistente sub limită
- Purchases în primele $42-50 cheltuiți

### Front-end vs Back-end analysis
> "We always look at both reach, clicks, click rate on one side (front-end) and add to carts, checkouts, and purchases on the other (back-end) before deciding which ad to move forward with."

- Un ad poate arăta bine pe front-end (clickuri, engagement) dar să nu convertească → nu e câștigător
- Ad 3 din exemplu: $42.20 cheltuit → 2 purchases + upsells → ROAS 3.28

---

## 7. Scalare

### Pasul 1: Duplicate winning ad în campanie nouă
- Click pe winning ad → Duplicate → New Campaign
- Budget: **$75-100/day** start

### Structura Campaniei de Scalare
- Același obiectiv (Sales → Purchase)
- Adset per țară (US + Canada + UK separat) dacă ai văzut activitate din mai multe țări
- Aceeași reclamă câștigătoare (Ad 3)

### Thumbnail Testing pe Winning Ad
- Păstrează același video câștigător
- Duplică ad-ul de 4-5 ori
- Fiecare duplicat = același video, **thumbnail diferit**
- Selectezi frame-uri din video ca thumbnail alternativ
- Rezultat: 5 versiuni ale aceluiași video cu hooks vizuale diferite

> "We're still pushing our best performing video, but with more variety in how it appears in the feed."

### Reguli Scalare (din principii generale confirmate)
- Nu mări bugetul mai mult de **20%** la 3-4 zile
- Fă modificări de buget **dimineața devreme** (nu în timpul zilei active)
- La scaling: Advantage+ și AI sistemul Meta ajută la construirea unui scor mai bun

---

## 8. Lecții Cheie pentru Azora.ro

### Ce confirmă videoul din sistemul nostru de alertă:
- ✅ `frequency > 3.5` → fatigă (menționat implicit: "rotate creative when frequency signals fatigue")
- ✅ `CTR < 2%` → creativul nu performează
- ✅ `add to cart = 0` cu cheltuieli mari → semnal de oprire
- ✅ Metrici front-end + back-end trebuie citite împreună

### Ce adaugă videoul nou față de sistemul nostru:
1. **Break-even ladder** — framework matematic pentru decizie de oprire/continuare
2. **Thumbnail testing** pe winning creative — metodă concretă de scaling fără a schimba videourile
3. **Lansare la miezul nopții** — important pentru livrare curată și date clare
4. **Warm-up campaign** — conturile noi trebuie încălzite cu engagement $10/day
5. **Product page direct** (nu homepage) — fiecare click în plus = pierdere de conversii
6. **"See more" clicks** = semnal pozitiv pe care Meta îl recompensează cu reach mai ieftin
7. **Andromeda update** — creativul e mai important ca oricând; Meta auto-distribuie bugetul spre creativul mai puternic

### Unghiuri de copy care funcționează (din video):
- Problem angle: descrie problema pe care o rezolvă produsul
- Convenience angle: cât de ușor/rapid/simplu
- Emotional benefit angle: cum se simte clientul după

### Format creativ recomandat:
- UGC-style (filmat cu telefonul, fără editare complexă)
- Demonstrație clară a produsului
- Fără watermark, fără logo brand baked-in
- Scurt, direct, la obiect

---

## 9. Quotes Verbatim din Video (pentru AI prompts)

> "The whole reason that we set this up the way we did is so that the next step actually means something. Because once the ads start spinning, you're not building anymore. You're reading."

> "If that first line doesn't make someone stop, nothing else matters."

> "CPM tells you how expensive your niche is with what you're putting out there. $15-20 range you're doing good. $30-40 plus, that's telling you your industry is more competitive and your ads are not competitive enough inside that industry."

> "Add to carts are a big deal in testing because they're the first sign that people are seriously considering buying."

> "When you're testing your creatives the right way, you're letting the algorithm do the heavy lifting for you."

> "Meta's new Andromeda update puts way more weight onto creative performance than it ever has before. It automatically pushes your budget towards the ad that's getting the strongest reactions."

> "Once you find that winning creative, every campaign after this just becomes easier, cheaper, and way more predictable."

---

## 10. Benchmarks Confirmate din Video (piața US/EN)

| Metric | Prag | Acțiune |
|--------|------|---------|
| CPM | $15-20 = normal; $30-40+ = competitiv | Dacă CPM e mare, tot restul devine mai scump |
| CTR | 2-2.5%+ | Sub acest nivel = thumbnailul/headline nu funcționează |
| ROAS break-even | Depinde de marjă (ex: 1.74 pentru 20% profit) | Sub break-even = pierdere |
| ROAS target | 3x+ = profitabil solid | 3.28 din exemplul video = ~40% profit margin |
| Budget testing | $50/day recomandat | $20-25 merge dar datele vin mai lent |
| Budget scaling | $75-100/day după găsirea winner | Mărire graduală |

> **Notă pentru Azora.ro:** Benchmarks-urile de CPM din video sunt pentru piața US ($15-40). Pentru România, CPM-urile sunt mai mici (15-45 RON ≈ $3-9), dar principiile sunt identice.
