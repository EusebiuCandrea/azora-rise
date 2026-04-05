const META_API_VERSION = "v21.0"
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetaCampaign {
  id: string
  name: string
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED"
  objective: string
  daily_budget?: string
  start_time?: string
  stop_time?: string
  created_time: string
}

export interface MetaAdSet {
  id: string
  campaign_id: string
  name: string
  status: string
  daily_budget?: string
  targeting?: object
  bid_strategy?: string
  start_time?: string
  stop_time?: string
}

export interface MetaAd {
  id: string
  adset_id: string
  name: string
  status: string
  creative?: {
    id: string
    thumbnail_url?: string
  }
}

export interface MetaInsights {
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  clicks: string
  cpm?: string
  ctr?: string
  reach?: string
  frequency?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
  video_avg_time_watched_actions?: Array<{ action_type: string; value: string }>
  video_play_actions?: Array<{ action_type: string; value: string }>
  video_p25_watched_actions?: Array<{ action_type: string; value: string }>
  video_p50_watched_actions?: Array<{ action_type: string; value: string }>
  video_p75_watched_actions?: Array<{ action_type: string; value: string }>
  video_p95_watched_actions?: Array<{ action_type: string; value: string }>
  video_thruplay_watched_actions?: Array<{ action_type: string; value: string }>
  landing_page_views?: Array<{ action_type: string; value: string }>
}

export interface TokenValidation {
  valid: boolean
  reason?: string
  adAccountName?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function parseMetaBudget(budgetStr?: string): number {
  if (!budgetStr) return 0
  return parseInt(budgetStr, 10) / 100
}

export function parsePurchases(insights: MetaInsights): number {
  const action = insights.actions?.find(
    (a) =>
      a.action_type === "purchase" ||
      a.action_type === "offsite_conversion.fb_pixel_purchase"
  )
  return action ? parseInt(action.value, 10) : 0
}

export function parsePurchaseValue(insights: MetaInsights): number {
  const actionValue = insights.action_values?.find(
    (a) =>
      a.action_type === "purchase" ||
      a.action_type === "offsite_conversion.fb_pixel_purchase"
  )
  return actionValue ? parseFloat(actionValue.value) : 0
}

export function parseActionCount(
  insights: MetaInsights,
  actionType: string
): number | null {
  const action = insights.actions?.find((a) => a.action_type === actionType)
  return action ? parseInt(action.value, 10) : null
}

export function parseVideoMetric(
  arr: Array<{ action_type: string; value: string }> | undefined
): number | null {
  if (!arr || arr.length === 0) return null
  const total = arr.reduce((sum, a) => sum + parseFloat(a.value), 0)
  return total || null
}

export function parseVideoAvgWatchTime(
  arr: Array<{ action_type: string; value: string }> | undefined
): number | null {
  if (!arr || arr.length === 0) return null
  return parseFloat(arr[0].value)
}

async function metaFetch<T>(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${META_API_BASE}/${endpoint}`)
  url.searchParams.set("access_token", accessToken)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data.error) {
    throw new Error(`Meta API Error ${data.error.code}: ${data.error.message}`)
  }

  return data as T
}

// ─── Token validation ─────────────────────────────────────────────────────────

export async function validateMetaToken(
  accessToken: string,
  adAccountId: string
): Promise<TokenValidation> {
  try {
    const data = await metaFetch<{ id: string; name: string; currency: string }>(
      adAccountId,
      accessToken,
      { fields: "id,name,currency,account_status" }
    )
    return { valid: true, adAccountName: data.name }
  } catch (error) {
    return {
      valid: false,
      reason:
        error instanceof Error
          ? error.message
          : "Token invalid sau lipsă acces",
    }
  }
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function fetchCampaigns(
  accessToken: string,
  adAccountId: string
): Promise<MetaCampaign[]> {
  const fields =
    "id,name,status,objective,daily_budget,start_time,stop_time,created_time"
  const data = await metaFetch<{ data: MetaCampaign[] }>(
    `${adAccountId}/campaigns`,
    accessToken,
    {
      fields,
      limit: "500",
      effective_status: '["ACTIVE","PAUSED","ARCHIVED"]',
    }
  )
  return data.data
}

export async function createCampaign(
  accessToken: string,
  adAccountId: string,
  params: {
    name: string
    objective: string
    dailyBudget: number
    startDate?: string
    endDate?: string
  }
): Promise<{ id: string }> {
  const url = new URL(`${META_API_BASE}/${adAccountId}/campaigns`)
  url.searchParams.set("access_token", accessToken)

  const body = new URLSearchParams({
    name: params.name,
    objective: params.objective,
    status: "PAUSED",
    daily_budget: String(Math.round(params.dailyBudget * 100)),
    special_ad_categories: "[]",
  })

  if (params.startDate) {
    body.set("start_time", new Date(params.startDate).toISOString())
  }
  if (params.endDate) {
    body.set("stop_time", new Date(params.endDate).toISOString())
  }

  const response = await fetch(url.toString(), { method: "POST", body })
  const data = await response.json()

  if (data.error) {
    throw new Error(`Eroare creare campanie: ${data.error.message}`)
  }

  return { id: data.id }
}

export async function updateCampaignStatus(
  accessToken: string,
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED" | "DELETED"
): Promise<void> {
  const url = new URL(`${META_API_BASE}/${metaCampaignId}`)
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams({ status }),
  })
  const data = await response.json()

  if (data.error) {
    throw new Error(`Eroare update status: ${data.error.message}`)
  }
}

export async function updateCampaignBudget(
  accessToken: string,
  metaCampaignId: string,
  dailyBudget: number
): Promise<void> {
  const url = new URL(`${META_API_BASE}/${metaCampaignId}`)
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams({
      daily_budget: String(Math.round(dailyBudget * 100)),
    }),
  })
  const data = await response.json()

  if (data.error) {
    throw new Error(`Eroare update buget: ${data.error.message}`)
  }
}

// ─── AdSets ───────────────────────────────────────────────────────────────────

export async function fetchAdSets(
  accessToken: string,
  campaignId: string
): Promise<MetaAdSet[]> {
  const fields =
    "id,campaign_id,name,status,daily_budget,targeting,bid_strategy,start_time,stop_time"
  const data = await metaFetch<{ data: MetaAdSet[] }>(
    `${campaignId}/adsets`,
    accessToken,
    { fields, limit: "200" }
  )
  return data.data
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

export async function fetchAds(
  accessToken: string,
  adSetId: string
): Promise<MetaAd[]> {
  const fields = "id,adset_id,name,status,creative{thumbnail_url}"
  const data = await metaFetch<{ data: MetaAd[] }>(`${adSetId}/ads`, accessToken, {
    fields,
    limit: "200",
  })
  return data.data
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export async function fetchCampaignInsights(
  accessToken: string,
  adAccountId: string,
  dateFrom: string,
  dateTo: string,
  level: "campaign" | "adset" | "ad" = "campaign"
): Promise<MetaInsights[]> {
  const fields = [
    "campaign_id",
    "adset_id",
    "ad_id",
    "date_start",
    "date_stop",
    "spend",
    "impressions",
    "clicks",
    "cpm",
    "ctr",
    "reach",
    "frequency",
    "actions",
    "action_values",
    "landing_page_views",
    "video_play_actions",
    "video_avg_time_watched_actions",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p95_watched_actions",
    "video_thruplay_watched_actions",
  ].join(",")

  const data = await metaFetch<{ data: MetaInsights[] }>(
    `${adAccountId}/insights`,
    accessToken,
    {
      fields,
      level,
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: "1",
      use_account_attribution_setting: "true",
      limit: "2000",
    }
  )

  return data.data
}

export async function fetchCampaignMetricsSummary(
  accessToken: string,
  metaCampaignId: string,
  days: number = 30
): Promise<{
  totalSpend: number
  totalImpressions: number
  totalClicks: number
  totalPurchases: number
  avgRoas: number
  avgCpm: number
  avgCtr: number
}> {
  const dateTo = new Date().toISOString().split("T")[0]
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  const fields =
    "spend,impressions,clicks,cpm,ctr,actions,action_values"

  const data = await metaFetch<{ data: MetaInsights[] }>(
    `${metaCampaignId}/insights`,
    accessToken,
    {
      fields,
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      limit: "1",
    }
  )

  const insight = data.data[0]
  if (!insight) {
    return {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalPurchases: 0,
      avgRoas: 0,
      avgCpm: 0,
      avgCtr: 0,
    }
  }

  const spend = parseFloat(insight.spend || "0")
  const purchases = parsePurchases(insight)
  const revenue = parsePurchaseValue(insight)
  const roas = spend > 0 ? revenue / spend : 0

  return {
    totalSpend: spend,
    totalImpressions: parseInt(insight.impressions || "0", 10),
    totalClicks: parseInt(insight.clicks || "0", 10),
    totalPurchases: purchases,
    avgRoas: roas,
    avgCpm: parseFloat(insight.cpm || "0"),
    avgCtr: parseFloat(insight.ctr || "0"),
  }
}
