# Rise — Costuri Transport & Ambalaj la nivel de Magazin + Statut TVA

**Data:** 2026-03-29
**Status:** Aprobat — pregătit pentru implementare
**Autor:** Claude (Product Manager & Arhitect Software)

---

## Obiectiv

Muta costurile de transport și ambalaj din configurarea per-produs în setările magazinului. Adaugă câmp pentru statutul de plătitor TVA al firmei, care afectează toate calculele de profitabilitate.

---

## Motivație

- Costul de ambalaj este același pentru toate produsele dintr-un magazin — nu are sens să fie configurat per produs.
- Costul de transport implicit (Fan Courier, Cargus etc.) este standard per magazin (~20 RON) — per-produs adaugă fricțiune inutilă.
- Statutul de plătitor TVA este o proprietate a firmei, nu a produsului — afectează toate calculele uniform.

---

## Schema Prisma — modificări

### Organization — câmpuri noi

```prisma
model Organization {
  // ... câmpuri existente ...
  shippingCostDefault  Float   @default(20)    // RON/comandă — cost transport implicit Fan Courier/Cargus
  isVatPayer           Boolean @default(true)  // firmă plătitoare de TVA (înregistrată în scop TVA)
}
```

`packagingCostDefault Float @default(0)` — **deja există**, nu se modifică.

### ProductCost — câmpuri eliminate

```prisma
model ProductCost {
  // Se elimină:
  // shippingCost   Float  — mutat la org level
  // packagingCost  Float  — mutat la org level
}
```

Migrație: `ALTER TABLE "ProductCost" DROP COLUMN "shippingCost", DROP COLUMN "packagingCost"`

---

## lib/profitability.ts — modificări

### OrgSettings — câmpuri noi

```typescript
export interface OrgSettings {
  shopifyFeeRate: number
  incomeTaxType: IncomeTaxType
  shippingCost: number       // din Organization.shippingCostDefault
  packagingCost: number      // din Organization.packagingCostDefault
  isVatPayer: boolean        // din Organization.isVatPayer
}
```

### ProductCostInput — câmpuri eliminate

```typescript
export interface ProductCostInput {
  cogs: number
  supplierVatDeductible: boolean
  vatRate: number
  returnRate: number
  // Eliminate: shippingCost, packagingCost — acum în OrgSettings
}
```

### calculateProductProfitability — logică isVatPayer

```typescript
// Dacă firma NU este plătitoare de TVA:
// - revenueNet = price (nu se deduce TVA colectată)
// - cogsNet = cogs (nu se deduce TVA furnizor, indiferent de supplierVatDeductible)
// - vatCollected = 0, vatDeducted = 0

const effectiveVatRate = orgSettings.isVatPayer ? cost.vatRate : 0
const revenueNet = price / (1 + effectiveVatRate)
const vatCollected = price - revenueNet

const cogsNet = (orgSettings.isVatPayer && cost.supplierVatDeductible)
  ? cost.cogs / (1 + effectiveVatRate)
  : cost.cogs
const vatDeducted = cogsNet < cost.cogs ? cost.cogs - cogsNet : 0

const grossProfit = revenueNet - cogsNet
  - orgSettings.shippingCost
  - orgSettings.packagingCost
  - shopifyFee
```

---

## ProductCostForm — modificări UI

### Câmpuri eliminate din formular
- "Cost transport (RON)" — eliminat
- "Cost ambalare (RON)" — eliminat

### Label informativ adăugat
Sub câmpul COGS, afișează:
```
Setări moștenite din magazin:
· Transport: 20 RON  · Ambalaj: 5 RON
```
(valorile reale din orgSettings)

### Zod schema — actualizată
Elimină `shippingCost` și `packagingCost` din schema de validare.

### Calcul inline de profitabilitate
Folosește `orgSettings.shippingCost` și `orgSettings.packagingCost` în loc de valorile din formular.

---

## API /api/products/[id]/cost (PUT) — modificări

Elimină `shippingCost` și `packagingCost` din:
- Schema Zod de validare
- Operația `db.productCost.upsert()`

---

## API /api/products/[id]/profitability (GET) — modificări

Construiește `OrgSettings` cu noile câmpuri:

```typescript
const orgSettings: OrgSettings = {
  shopifyFeeRate: org.shopifyFeeRate,
  incomeTaxType: org.incomeTaxType as IncomeTaxType,
  shippingCost: org.shippingCostDefault,
  packagingCost: org.packagingCostDefault,
  isVatPayer: org.isVatPayer,
}
```

Selectează câmpurile noi din Organization query:
```typescript
select: {
  shopifyFeeRate: true,
  incomeTaxType: true,
  shippingCostDefault: true,   // nou
  packagingCostDefault: true,
  isVatPayer: true,            // nou
}
```

Elimină `shippingCostDisplay` și `packagingCostDisplay` din răspuns (nu mai sunt per-produs).
Adaugă `shippingCost` și `packagingCost` direct din `orgSettings` în răspuns.

---

## Settings — modificări UI (SettingsClient.tsx)

### Câmpuri noi în secțiunea "Setări magazin"

**Cost transport implicit (RON)**
- Input numeric, default 20
- Label: "Cost livrare per comandă (Fan Courier, Cargus etc.)"
- Afișat alături de "Cost ambalaj implicit"

**Firmă plătitoare de TVA**
- Toggle (boolean)
- Label: "Firmă înregistrată în scop de TVA"
- Descriere sub toggle: "Dezactivează dacă firma nu depășește plafonul de TVA (300.000 RON/an)"

### API /api/settings (sau echivalent) — câmpuri noi salvate
- `shippingCostDefault`
- `isVatPayer`

---

## Migrație Prisma

```bash
cd rise
npm run db:migrate -- --name org_shipping_vat_product_cost_cleanup
```

Migrația va:
1. Adăuga `shippingCostDefault Float DEFAULT 20` în `Organization`
2. Adăuga `isVatPayer Boolean DEFAULT true` în `Organization`
3. Elimina `shippingCost` din `ProductCost`
4. Elimina `packagingCost` din `ProductCost`

---

## Ordine implementare recomandată

1. Schema Prisma + migrație
2. `lib/profitability.ts` — actualizare tipuri și logică
3. API `/api/products/[id]/cost` — elimină câmpuri din schema și upsert
4. API `/api/products/[id]/profitability` — actualizare OrgSettings
5. API `/api/settings` — adaugă câmpuri noi
6. `SettingsClient.tsx` — câmpuri noi în formular
7. `ProductCostForm.tsx` — elimină câmpuri, adaugă label informativ

---

## Checklist verificare

- [ ] Migrația rulează fără erori
- [ ] `calculateProductProfitability` cu `isVatPayer=false` → `vatCollected=0`, `cogsNet=cogs`
- [ ] `calculateProductProfitability` cu `isVatPayer=true` — comportament identic cu cel anterior
- [ ] ProductCostForm nu mai afișează câmpurile transport/ambalaj
- [ ] Labelul informativ afișează valorile reale din orgSettings
- [ ] Settings salvează `shippingCostDefault` și `isVatPayer`
- [ ] API profitability folosește valorile din org, nu din ProductCost
- [ ] TypeScript fără erori noi

---

*Document creat: 2026-03-29*
