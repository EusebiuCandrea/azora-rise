// lib/recommendations.ts

export type RecommendationType = 'SCALE_UP' | 'MONITOR' | 'REVIEW_COSTS' | 'KILL_ADS' | 'DEAD_STOCK' | 'BREAK_EVEN'

export interface RecommendationResult {
  type: RecommendationType
  note: string
}

interface SnapshotInput {
  netMarginPct: number
  adsRoas?: number | null
  unitsSold: number
  adsSpendRON: number
  periodDays: number
  maxSustainableAdsBudget?: number
}

const THRESHOLDS = {
  scaleUpMargin: 30,
  reviewMargin: 10,
  killAdsRoas: 1.5,
  minUnitsForScaleUp: 10,
}

export function generateRecommendation(snap: SnapshotInput): RecommendationResult {
  const { netMarginPct, adsRoas, unitsSold, adsSpendRON, periodDays, maxSustainableAdsBudget } = snap

  if (unitsSold === 0) {
    return {
      type: 'DEAD_STOCK',
      note: `Nicio vânzare în ultimele ${periodDays} zile. Evaluează lichidare sau promoție agresivă.`,
    }
  }

  if (adsSpendRON > 0 && adsRoas !== null && adsRoas !== undefined && adsRoas < THRESHOLDS.killAdsRoas) {
    const loss = ((1 - adsRoas) * adsSpendRON).toFixed(0)
    return {
      type: 'KILL_ADS',
      note: `ROAS ${adsRoas.toFixed(2)}x sub pragul de 1.5x. Oprește sau restructurează campania Meta. Pierzi ${loss} RON din ads.`,
    }
  }

  if (netMarginPct < THRESHOLDS.reviewMargin) {
    if (netMarginPct < 0) {
      return {
        type: 'REVIEW_COSTS',
        note: `Produs NEPROFITABIL — pierdere de ${Math.abs(netMarginPct).toFixed(1)}% din revenue. Renegociază prețul cu furnizorul sau crește prețul de vânzare.`,
      }
    }
    return {
      type: 'REVIEW_COSTS',
      note: `Margine sub 10% (${netMarginPct.toFixed(1)}%). Analizează reducerea costurilor sau creșterea prețului.`,
    }
  }

  if (netMarginPct > THRESHOLDS.scaleUpMargin && unitsSold >= THRESHOLDS.minUnitsForScaleUp) {
    const budgetNote = maxSustainableAdsBudget
      ? ` Budget max sustenabil: ${maxSustainableAdsBudget.toFixed(0)} RON/lună.`
      : ''
    return {
      type: 'SCALE_UP',
      note: `Margin ${netMarginPct.toFixed(1)}% cu volum bun (${unitsSold} unități). Mărește stocul și bugetul de ads.${budgetNote}`,
    }
  }

  return {
    type: 'MONITOR',
    note: `Performanță stabilă. Margin ${netMarginPct.toFixed(1)}%.`,
  }
}
