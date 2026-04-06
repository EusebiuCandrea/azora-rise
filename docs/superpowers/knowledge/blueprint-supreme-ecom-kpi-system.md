# Blueprint Supreme Ecom — KPI & Product Research System
> Sursa: "Blueprint Supreme Ecom KPI and Product Research Sheet" (UPDATED DEC 2025)
> 4 tab-uri: Introduction · Product Validation · KPI Calculator · Daily Profit Calculator

---

## 1. FILOZOFIA SISTEMULUI

Sistemul rezolvă problema testării la întâmplare în e-commerce. Oferă:
- **Criterii obiective de validare** a produsului înainte de lansare
- **KPI-uri de break-even și target** calculate matematic din prețul produsului
- **Decizii de oprire/scalare** bazate pe date, nu emoții

**Workflow recomandat:**
1. Cercetează 2–3 produse zilnic
2. Validează fiecare produs cu scoring-ul din Sheet 2
3. Introdu metricile în KPI Calculator (Sheet 3)
4. Urmărește zilnic rezultatele în Daily Profit Calculator (Sheet 4)

---

## 2. PRODUCT VALIDATION (Sheet 2)

### Criterii de calificare

| Câmp | Formula | Exemplu (Smart Sleep Mask) |
|---|---|---|
| Selling Price (AOV) | input manual — minim $30, include shipping | $39.95 |
| COGS (incl. shipping) | input manual | $5.92 |
| **Profit brut** | `= Selling Price − COGS` | $34.03 |
| **Marginal Ratio** | `= Selling Price / COGS` | 6.75x |

### Regula principală
> **Marginal Ratio trebuie să fie ≥ 2.5x.** Sub această valoare, produsul NU suportă costurile de advertising și riscă să fie neprofitabil chiar dacă se vinde.

**Exemple de calcul:**
- Product 1: $39.99 / $8.91 = **4.49x** ✅
- Product 2: $79.98 / $22.82 = **3.50x** ✅
- Product 3: $59.99 / $22.82 = **2.63x** ✅ (marginal)

### Structura de validare completă
Pe lângă calcule, se documentează:
- Link produs AliExpress / AutoDS / furnizor backup
- Data ultimei validări
- Link reclamă activă top competitor
- Link magazin competitor #1, #2, #3
- Câmpul VALIDATED: Yes/No

---

## 3. KPI CALCULATOR (Sheet 3)

### Variabile de intrare (celule tan)

| Celulă | Variabilă | Exemplu |
|---|---|---|
| C5 | Average Order Value (AOV) | $39.95 |
| C6 | Average Fees % (Shopify) | 1.0% |
| C7 | Average COGS incl. shipping | $5.92 |
| C8 | Profit Target % | 20% |
| C11 | Add to Cart rate (%) | 6.0% |
| C12 | Reached Checkout rate (%) | 4.5% |
| C13 | Purchase Conversion Rate (%) | 2.5% |
| D16 | Currency Conversion (1 USD = ?) | 1.0 (USD) |

> **Ratele de conversie** (6% ATC, 4.5% checkout, 2.5% purchase) sunt estimări baseline industry. Se actualizează cu datele reale ale contului.

---

### 3.1 BREAK-EVEN KPIs — formulele exacte

#### CPP_BE (Cost Per Purchase — Break-Even)
```
L11 = (C5 × (100 - C6) / 100 − C7) × D16
     = (AOV × (1 − feeRate) − COGS) × currencyConversion
```
**Semnificație:** Suma maximă pe care o poți cheltui per comandă și să nu pierzi bani. La această valoare profitul = 0.

**Exemplu:** (39.95 × 0.99 − 5.92) × 1 = **$33.63**

---

#### ROAS_BE (Break-Even ROAS)
```
L12 = C5 / (C5 − C7 − C5 × C6 / 100)
     = AOV / (AOV − COGS − AOV × feeRate)
     = AOV / CPP_BE
```
**Semnificație:** ROAS minim pentru a nu pierde bani.

**Exemplu:** 39.95 / 33.63 = **1.19x**

---

#### ½ CPP_BE (Primul cut-off)
```
J6 = L11 / 2 = CPP_BE / 2
```
**Semnificație:** Dacă ai cheltuit jumătate din CPP_BE fără nicio comandă, evaluează oprirea reclamei.

**Exemplu:** 33.63 / 2 = **$16.81**

---

#### CPATC_BE (Cost Per Add to Cart — Break-Even)
```
L9 = K6 = L11 × (C13 / C11)
         = CPP_BE × (purchaseRate / atcRate)
```
**Semnificație:** Dacă 2.5% din clicks cumpără și 6% adaugă în coș, atunci 2.5/6 = 41.7% din ATC-uri se convertesc. CPATC_BE = CPP_BE × acel raport.

**Exemplu:** 33.63 × (2.5/6.0) = **$14.01**

---

#### CPULC_BE (Cost Per Unique Link Click — Break-Even)
```
L10 = L11 × (C13 / 100)
     = CPP_BE × purchaseRate%
```
**Semnificație:** Dacă 2.5% din click-uri convertesc, poți plăti maxim CPP_BE × 2.5% per click.

**Exemplu:** 33.63 × 0.025 = **$0.84**

---

### 3.2 TARGET KPIs (cu marjă de profit)

#### CPP_Target
```
U6 = (C5 × (100 - C6) / 100 − C7 − C5 × (C8 / 100)) × D16
   = (AOV × (1 − feeRate) − COGS − AOV × profitTarget%) × currencyConversion
   = CPP_BE − AOV × profitTarget%
```
**Semnificație:** CPP maxim pentru a atinge marja de profit dorită (implicit 20%).

**Exemplu:** (39.95 × 0.99 − 5.92 − 39.95 × 0.20) × 1 = **$25.64**

---

#### ROAS_Target
```
U5 = C5 / (U6 / D16)
   = AOV / CPP_Target
```
**Exemplu:** 39.95 / 25.64 = **1.56x**

---

#### CPATC_Target
```
U7 = U6 × (C13 / C11)
   = CPP_Target × (purchaseRate / atcRate)
```
**Exemplu:** 25.64 × (2.5/6.0) = **$10.68**

---

#### CPULC_Target
```
U8 = U6 × (C13 / 100)
   = CPP_Target × purchaseRate%
```
**Exemplu:** 25.64 × 0.025 = **$0.64**

---

#### CPIC_Target (Cost Per Initiate Checkout — Target)
```
U9 = U6 × (C13 / C12)
   = CPP_Target × (purchaseRate / checkoutRate)
```
**Exemplu:** 25.64 × (2.5/4.5) = **$14.24**

---

### 3.3 TABEL BENCHMARKS CREATIVE TEST

Reclame noi, trafic rece, **înainte** de prima comandă:

| Metrică | Benchmark |
|---|---|
| CPM | ≤ $15.00 |
| CPC | ≤ $1.00 |
| CPULC (Cost Per Unique Link Click) | ≤ $1.00 |
| CTR (link) | ≥ 2.50% |
| Video plays la 95% | ≥ 10 |
| Video average watch time | ≥ 0:06 sec |

---

### 3.4 TABEL COLD AUDIENCE TEST + DECIZIE SCALARE

#### Cut-off #1 — fără comenzi
> Dacă ai cheltuit **½ CPP_BE** fără nicio comandă → evaluează oprirea.

#### KPIs Break-Even (targetul minim acceptabil)
| Metrică | Formula | Exemplu |
|---|---|---|
| CPATC | CPP_BE × (purchaseRate/atcRate) | $14.01 |
| CPULC | CPP_BE × purchaseRate% | $0.84 |
| CPP | CPP_BE | $33.63 |
| ROAS | AOV / CPP_BE | 1.19x |

#### Progresie per comandă (Spend Cutoffs)
La fiecare comandă, suma maximă cheltuită cumulat înainte de aceea comanda = n × CPP_BE:

| Comanda | Max Spend (B/E) | Formula |
|---|---|---|
| 1 | $33.63 | CPP_BE |
| 2 | $67.26 | 2 × CPP_BE |
| 3 | $100.89 | 3 × CPP_BE |
| 4 | $134.52 | 4 × CPP_BE |
| 5 | $168.15 | 5 × CPP_BE |
| 6 | $201.78 | 6 × CPP_BE |
| 7 | $235.41 | 7 × CPP_BE |
| 8 | $269.04 | 8 × CPP_BE |
| 9 | $302.67 | 9 × CPP_BE |

**Formula generală:** `O_n = n × CPP_BE`

#### Coluna P — Spend Cutoff "cu marjă de profit"
Adaugă progresiv marja de profit la fiecare comandă ulterioară:
```
P6 = CPP_BE × (1 + Q6)           -- Q6=0%
P7 = P6 + (AOV×(1-fee) - COGS - AOV×Q7) × conv   -- Q7=7.5%
P8, P9+: idem cu Q=17.5%
```

#### Decizia de scalare (end of day 3)
> Dacă ai comenzi profitabile și KPI-uri bune la finalul zilei 3:
> **"Duplicate best performing adset 10x, increase budget to equal $10/ad set still using CBO, change ads to the best performing ones"**

---

### 3.5 PROFIT TARGET KPIs TABLE (rezumat)

Calculat automat din AOV + COGS + profitTarget% (20%):

| KPI | Formula | Exemplu ($39.95 AOV, 20% target) |
|---|---|---|
| ROAS Target | AOV / CPP_Target | **1.56x** |
| CPP Target | CPP_BE − AOV × profitTarget% | **$25.64** |
| CPATC Target | CPP_Target × (PR/ATCR) | **$10.68** |
| CPULC Target | CPP_Target × PR% | **$0.64** |
| CPIC Target | CPP_Target × (PR/COR) | **$14.24** |

---

## 4. DAILY PROFIT CALCULATOR (Sheet 4)

### Structura tabelului zilnic

| Coloană | Label | Formula |
|---|---|---|
| A | Date | secvențial (+1) |
| B | Daily Advertising Expense | input manual (din Ad Manager) |
| C | Daily COGS | input manual (AliExpress/CJ/etc.) |
| D | Shopify Total Daily Sales | input manual (din Shopify Analytics) |
| E | **Daily Profit** | `= D − C − B` |
| F | **Profit Margin** | `= IFERROR((D−(C+B))/D, "−")` |
| G | **Marginal Ratio** | `= IFERROR(D/(C+B), "−")` |

### Celule sumar (coloana I)

| Label | Formula |
|---|---|
| Total Revenue | `=SUM(D2:D1000)` |
| Total Profit | `=SUM(E2:E1000)` |
| **Total Profit Margin** | `=IFERROR((SUM(D2:D1000)−(SUM(C2:C1000)+SUM(B2:B1000)))/SUM(D2:D1000), "−")` |
| **Total Marginal Ratio** | `=IFERROR(SUM(D2:D1000)/(SUM(C2:C1000)+SUM(B2:B1000)), "−")` |

### Instrucțiuni de completare
- **B (Ads):** Ia din Ad Manager, dezactivează filtrele, refresh — suma totală cheltuită în ziua respectivă
- **C (COGS):** Totalul comenzilor procesate în ziua respectivă (cu shipping inclus)
- **D (Sales):** Shopify Analytics → Dashboard → filtrează pe ziua respectivă

### Exemplu de date reale (primele 9 zile)
| Date | Ads | COGS | Sales | Profit | Margin | Ratio |
|---|---|---|---|---|---|---|
| Day 1 | $100 | $50 | $500 | $350 | 70% | 3.33x |
| Day 2 | $100 | $15 | $150 | $35 | 23% | 1.30x |
| Day 3 | $250 | $15 | $150 | -$115 | -77% | 0.57x |
| Day 4 | $50 | $5 | $50 | -$5 | -10% | 0.91x |
| Day 5 | $250 | $5 | $50 | -$205 | -410% | 0.20x |
| Day 6 | $0 | $5 | $50 | $45 | 90% | 10.0x |
| Day 7 | $87 | $30 | $300 | $183 | 61% | 2.56x |
| Day 8 | $100 | $20 | $300 | $180 | 60% | 2.50x |

---

## 5. FORMULE COMPLETE — INDEX RAPID

### Validare produs
```
Profit brut         = Selling Price − COGS
Marginal Ratio      = Selling Price / COGS         [target: ≥ 2.5x]
```

### Break-Even
```
CPP_BE     = (AOV × (1 − feeRate) − COGS) × fxRate
ROAS_BE    = AOV / CPP_BE
½CPP_BE    = CPP_BE / 2                            [cut-off fără comenzi]
CPATC_BE   = CPP_BE × (purchaseRate / atcRate)
CPULC_BE   = CPP_BE × purchaseRate
CPIC_BE    = CPP_BE × (purchaseRate / checkoutRate)
```

### Target (cu profit margin)
```
CPP_Target   = (AOV × (1 − feeRate) − COGS − AOV × profitTarget%) × fxRate
             = CPP_BE − AOV × profitTarget%
ROAS_Target  = AOV / CPP_Target
CPATC_Target = CPP_Target × (purchaseRate / atcRate)
CPULC_Target = CPP_Target × purchaseRate
CPIC_Target  = CPP_Target × (purchaseRate / checkoutRate)
```

### Daily tracking
```
Daily Profit       = Sales − COGS − Ads
Profit Margin      = Profit / Sales
Marginal Ratio     = Sales / (COGS + Ads)
Total Profit Margin = Total Profit / Total Revenue
Total Marginal Ratio = Total Revenue / Total (COGS + Ads)
```

---

## 6. RATE DE CONVERSIE BASELINE (estimări industrie)

| Eveniment | Rată | Relație |
|---|---|---|
| Add to Cart (ATC) | 6.0% din click-uri | — |
| Reached Checkout | 4.5% din click-uri | 75% din ATC |
| Purchase | 2.5% din click-uri | 55.6% din checkout |

> Aceste rate sunt punctul de start. Un cont matur cu date reale va folosi propriile rate.

---

## 7. LOGICA DECIZIONALĂ COMPLETĂ

### Faza 1 — Validare produs (înainte de lansare)
1. Marginal Ratio ≥ 2.5x? → dacă nu, exclude produsul
2. Există ≥ 3 competitori cu reclame active? → validare cerere
3. Preț ≥ $30 (cu shipping)? → profitabilitate minimă asigurată

### Faza 2 — Creative Test (ziua 1-2, $5-10/reclamă/zi)
- Monitorizează: CPM, CPC, CPULC, CTR, video metrics
- Benchmark: CPM ≤ $15, CTR ≥ 2.5%, CPULC ≤ $1

### Faza 3 — Cold Audience Test (CBO)
- Dacă cheltui ½ CPP_BE fără comenzi → oprește
- Dacă primești comenzi, urmărește CPP vs CPP_BE
- La ziua 3 cu comenzi profitabile → scalare 10x adset

### Faza 4 — Scalare
- Duplică cel mai bun adset de 10 ori
- $10/adset, CBO
- Schimbă reclamele cu cele mai performante

### Decizie zilnică
- Daily Marginal Ratio ≥ 2.5x → profitabil, continuă
- Daily Marginal Ratio < 1.0x → pierderi, revizuiește
- Total Profit Margin ≥ profitTarget% → campanie sănătoasă

---

## 8. MAPARE PE PLATFORMA RISE (azora-rise)

### Unde sunt implementate formulele
| Formula Blueprint | Fișier Rise | Note |
|---|---|---|
| CPP_BE | `lib/profitability-engine.ts` → `cppBe` | `(avgPriceExVat × (1 − shopifyFeeRate)) − cogs` |
| ROAS_BE | `lib/profitability-engine.ts` → `roasBe` | `avgSellingPrice / cppBe` |
| ½ CPP_BE | `lib/profitability-engine.ts` → `halfBeCpp` | `cppBe / 2` |
| CPP_Target | `lib/profitability-engine.ts` → `cppTarget` | `cppBe − avgSellingPrice × targetProfitMarginPct` |
| ROAS_Target | `lib/profitability-engine.ts` → `roasTarget` | `avgSellingPrice / cppTarget` |
| CPATC_Target | `lib/profitability-engine.ts` → `cpatcTarget` | `cppTarget × (0.025/0.06)` |
| CPULC_Target | `lib/profitability-engine.ts` → `cpulcTarget` | `cppTarget × 0.025` |
| CPIC_Target | `lib/profitability-engine.ts` → `cpicTarget` | `cppTarget × (0.025/0.045)` |
| Marginal Ratio produs | `lib/profitability-engine.ts` → `productMarginalRatio` | `avgSellingPrice / cogs` |
| Marginal Ratio campanie | `lib/profitability-engine.ts` → `marginalRatio` | `grossRevenue / (totalCogs + adsSpend)` |
| Daily Profit | `features/meta/campaigns-sync.ts` | `purchaseValue - spend` per zi |
| Total Profit Margin | `app/(dashboard)/profitability/page.tsx` | calculat din comenzi + costuri configurate |
| ½ CPP_BE alert | `features/meta/alerts.ts` → `HALF_BE_CPP_NO_PURCHASE` | trigger după 3 zile fără comenzi |

### Diferențe față de Blueprint (intenționat)
| Blueprint | Rise | Motiv |
|---|---|---|
| Fee = Shopify % plat | Fee = Shopify % pe revenueNet, nu AOV | Mai precis: taxa se aplică pe ce colectezi, nu prețul afișat |
| AOV = prețul listat | AOV = price/(1+vatRate) pentru CPP_BE | TVA nu este venit real |
| Currency = USD fix | eurToRon configurabil per organizație | Adaptare pentru piața RO |
| profitTarget = 20% default | targetProfitMarginPct pe Organization model | Configurabil per client |

---

## 9. CONSTANTS RATE DE CONVERSIE (în cod)

Din `lib/profitability-engine.ts`:
```typescript
const BLUEPRINT_PURCHASE_RATE  = 0.025  // 2.5% — din sheet C13
const BLUEPRINT_ATC_RATE       = 0.06   // 6.0% — din sheet C11
const BLUEPRINT_CHECKOUT_RATE  = 0.045  // 4.5% — din sheet C12
```
