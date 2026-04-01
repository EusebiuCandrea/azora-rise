export interface ProductBreakdownItem {
  productId: string
  visits: number
  scrollToForm: number
  formStarts: number
  formSubmits: number
  orders: number
  abandonRate: number
}

export interface CampaignBreakdownItem {
  campaignId: string
  sessions: number
  orders: number
  conversionRate: number
}

export interface JourneySnapshotDTO {
  id: string
  organizationId: string
  date: string
  periodDays: number
  totalImpressions: number
  totalAdClicks: number
  totalProductViews: number
  totalScrollToForm: number
  totalFormStarts: number
  totalFormSubmits: number
  totalOrders: number
  ctrAd: number
  rateVisitToScroll: number
  rateScrollToStart: number
  rateStartToSubmit: number
  rateSubmitToOrder: number
  overallConversion: number
  totalReturns: number
  totalUndelivered: number
  returnRate: number
  undeliveredRate: number
  productBreakdown: ProductBreakdownItem[]
  campaignBreakdown: CampaignBreakdownItem[]
  createdAt: string
}

export interface AIReportProblem {
  title: string
  severity: 'critical' | 'medium' | 'low'
  description: string
  metric: string
  benchmark: string
}

export interface AIReportSuggestion {
  problemRef: string
  action: string
  example: string
  expectedImpact: string
}

export interface AIReportQuickWin {
  action: string
  effort: 'low' | 'medium'
  impact: 'low' | 'medium' | 'high'
}

export interface JourneyAIReportDTO {
  id: string
  snapshotId: string
  problems: AIReportProblem[]
  suggestions: AIReportSuggestion[]
  quickWins: AIReportQuickWin[]
  generatedAt: string
  modelUsed: string
}

export interface JourneyAlertDTO {
  id: string
  type: string
  severity: string
  metric: string
  currentValue: number
  baselineValue: number
  deltaPercent: number
  createdAt: string
}

export interface JourneyHistoryPoint {
  date: string
  overallConversion: number
  totalOrders: number
  totalProductViews: number
}

export interface PaymentSplit {
  codPct: number
  cardPct: number
  total: number
}

export interface JourneyDataResponse {
  snapshot: JourneySnapshotDTO | null
  aiReport: JourneyAIReportDTO | null
  alerts: JourneyAlertDTO[]
  history: JourneyHistoryPoint[]
  paymentSplit: PaymentSplit | null
}
