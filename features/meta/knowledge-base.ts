// ─── Benchmarks piata RO — Meta Ads ──────────────────────────────────────────
// Surse:
//   1. AC Hampton "Complete Facebook Ads Course 2026" (piata US, CPM $15-40)
//   2. Blueprint Supreme Ecom KPI Sheet (Dec 2025) — framework break-even
//   3. Ajustari proprii piata RO ($1 ≈ 4.5 RON, CPM RO mult sub US)
//
// Formula Break-Even ROAS (din spreadsheet):
//   BE_ROAS = AOV / (AOV - COGS - Fees%)
//   CPP_BE  = AOV - COGS - Fees%          (cost maxim per achizitie la break-even)
//   CPATC   = CPP_BE × (purchase_rate / atc_rate)
//   CPULC   = CPATC × atc_rate
//   Marginal Ratio = AOV / COGS ≥ 2.5x   (criteriu validare produs)
//   Daily Profit = Revenue - AdSpend - COGS
//
// Exemplu Azora (produs mediu 250 RON, COGS 80 RON, fees 1%):
//   BE ROAS  = 250 / (250 - 80 - 2.5) = 1.49x
//   CPP BE   = 167.5 RON
//   CPATC BE = 167.5 × (2.5/6) = 69.8 RON
//   CPULC BE = 69.8 × 0.06 = 4.2 RON

export const RO_BENCHMARKS = {
  // ROAS (Return on Ad Spend)
  // BE ROAS pentru Azora ≈ 1.5x (marjă ~35%). Sub 1.5x = pierdere.
  // Target cu 20% profit: ~2.1x. Scalare: 3.5x+.
  roas: {
    poor:      1.5,  // sub break-even (pierdere netă)
    ok:        2.5,  // acoperă costurile + profit minim (~15%)
    good:      3.5,  // profitabil solid, candidate scalare
    excellent: 5.0,  // scaling agresiv
  },

  // CTR (Click-Through Rate %)
  // Spreadsheet: ≥ 2.5% = creative test pass. Sub 1% = hook slab.
  ctr: {
    poor:      0.9,  // hook nu funcționează, schimbă creativul
    ok:        1.5,  // sub-optim
    good:      2.5,  // baseline Blueprint / AC Hampton
    excellent: 4.0,  // hook foarte puternic
  },

  // CPM (Cost per 1000 impressions, RON)
  // Spreadsheet: ≤ $15 USD = ≤ 68 RON. RO e mai ieftin — 15-40 RON = normal.
  cpm: {
    excellent: 15,  // RON — audiență accesibilă
    good:      30,  // RON — normal piața RO
    ok:        50,  // RON — scump, verifică audiența
    poor:      70,  // RON — competiție mare sau creativ slab
  },

  // Frequency (de câte ori aceeași persoană a văzut reclama)
  frequency: {
    safe:    2.0,  // audiență fresh
    warning: 3.0,  // începe saturația
    danger:  3.5,  // Blueprint: roteaza creative imediat
  },

  // Hook Rate (video_p25 / video_plays) — câți trec de primele 25%
  // Spreadsheet: video plays la 95% ≥ 10 ca test minim
  hookRate: {
    poor:      0.20,  // sub 20% — hook slab
    ok:        0.30,  // mediocru
    good:      0.45,  // hook bun (Blueprint: 45%+)
    excellent: 0.60,  // câștigător potențial
  },

  // Landing Page View Rate (landing_page_views / clicks)
  landingPageViewRate: {
    poor:      0.50,  // URL greșit sau pagina lentă
    ok:        0.65,
    good:      0.80,
    excellent: 0.90,
  },

  // Add to Cart Rate (add_to_cart / landing_page_views)
  // Spreadsheet: 6% = baseline asumat în calculul CPATC
  addToCartRate: {
    poor:      0.03,  // sub 3% — oferta sau pagina produsului e problema
    ok:        0.06,  // 6% — baseline Blueprint
    good:      0.12,
    excellent: 0.20,
  },

  // CPULC (Cost Per Unique Link Click, RON)
  // Spreadsheet: ≤ $1 USD = ≤ 4.5 RON. Calculat: CPATC × atc_rate
  cpulc: {
    good: 4.5,   // RON — sub benchmark Blueprint
    ok:   8.0,   // RON — acceptabil
    poor: 12.0,  // RON — trafic prea scump
  },

  // CPATC (Cost Per Add to Cart, RON)
  // Spreadsheet: ~$14 USD = ~63 RON. Calculat: CPP_BE × (purchase_rate / atc_rate)
  // Azora (produs 250 RON): CPATC_BE ≈ 70 RON
  cpatc: {
    good: 50,   // RON
    ok:   80,   // RON
    poor: 120,  // RON
  },

  // CPP (Cost Per Purchase / CPA, RON)
  // Spreadsheet: CPP_BE = AOV - COGS - Fees. Azora: ≈ 167 RON BE.
  // Target cu profit 20%: ≈ 117 RON
  cpp: {
    good: 100,  // RON — profitabil cu marjă bună
    ok:   150,  // RON — aproape de break-even
    poor: 200,  // RON — pierdere pentru produse standard
  },

  // Marginal Ratio (AOV / COGS) — criteriu validare produs (Blueprint)
  // Sub 2.5x = produsul nu e viabil pentru ads
  marginalRatio: {
    minimum: 2.5,  // minim absolut
    good:    4.0,  // marja confortabilă pentru ads
    excellent: 6.0,
  },

  // Reguli de decizie (Break-Even Ladder)
  minSpendBeforeDecision: 150,  // RON — nu opri înainte
  minDaysBeforeDecision:  3,
  minSpendForKill:        300,  // RON — fără rezultate = oprești
  minDaysForKill:         7,

  learningPhaseConversions: 50,
  maxBudgetIncreasePercent: 20,
  minDaysBetweenBudgetChanges: 3,
} as const

// ─── Contextul specific Azora.ro ──────────────────────────────────────────────

export const AZORA_CONTEXT = `
Azora.ro este un magazin e-commerce românesc specializat în dispozitive beauty/wellness (dispozitive anti-celulită, LED, EMS) și produse cadou (ursulet flori, bijuterii).

Caracteristici importante:
- Prețuri produse: 150-500 RON
- Livrare: curier, plata la ramburs (COD) sau card
- Piața: România exclusiv
- Sezon: produse cadou au vârf în noiembrie-decembrie
- Concurență: medie-ridicată pentru dispozitive beauty în RO

Benchmarks adaptate pieței RO:
- CPM normal: 15-40 RON (mult sub US/EN)
- CPA target: 80-150 RON (depinde de produs)
- ROAS minimum pentru profitabilitate: 2.5x (marje 30-40%)
- CTR bun pentru RO: 2%+ (similar US)
` as const

// ─── Tipuri de probleme identificate (pentru structurarea răspunsului AI) ────

export type ProblemSeverity = "high" | "medium" | "low"
export type CampaignStatus = "excellent" | "good" | "warning" | "critical"

export interface CampaignProblem {
  title: string
  severity: ProblemSeverity
  metric: string
  value: number | string
  benchmark: number | string
  description: string
}

export interface CampaignSuggestion {
  action: string
  priority: 1 | 2 | 3
  expectedImpact: string
  howTo: string
}

export interface VideoBrief {
  diagnosis: string
  hook: {
    type: "pain_point" | "curiosity" | "social_proof" | "demonstration"
    script: string
    visual: string
    duration_sec: number
  }
  body: {
    structure: "demo_product" | "testimonial" | "before_after" | "educational"
    key_points: string[]
    duration_sec: number
  }
  social_proof: {
    type: "overlay_text" | "voiceover" | "ugc_clip"
    content: string
    duration_sec: number
  }
  cta: {
    script: string
    visual: string
    duration_sec: number
  }
  format: "9:16" | "4:5" | "1:1"
  total_duration_sec: number
  notes: string[]
}

export interface AIReportContent {
  summary: string
  campaigns: Array<{
    id: string
    healthScore: number
    status: CampaignStatus
    problems: CampaignProblem[]
    suggestions: CampaignSuggestion[]
    videoBrief?: VideoBrief
  }>
}
