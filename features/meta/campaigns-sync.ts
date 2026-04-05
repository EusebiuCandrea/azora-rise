import { db } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import {
  fetchCampaigns,
  fetchAdSets,
  fetchAds,
  fetchCampaignInsights,
  parseMetaBudget,
  parsePurchases,
  parsePurchaseValue,
  parseActionCount,
  parseVideoMetric,
  parseVideoAvgWatchTime,
  type MetaInsights,
} from "./client"

// ─── Sync complet: campanii + ad sets + ads ───────────────────────────────────

export async function syncCampaignsFromMeta(organizationId: string): Promise<{
  campaignsSynced: number
  adSetsSynced: number
  adsSynced: number
  error?: string
}> {
  const connection = await db.metaConnection.findUnique({
    where: { organizationId },
  })

  if (!connection) {
    throw new Error("Meta connection not found for organizationId: " + organizationId)
  }

  const accessToken = decrypt(connection.accessTokenEncrypted)
  const adAccountId = connection.adAccountId

  try {
    const metaCampaigns = await fetchCampaigns(accessToken, adAccountId)

    let adSetsSynced = 0
    let adsSynced = 0

    for (const mc of metaCampaigns) {
      const campaign = await db.campaign.upsert({
        where: { metaCampaignId: mc.id },
        create: {
          organizationId,
          metaCampaignId: mc.id,
          name: mc.name,
          status: mapMetaStatus(mc.status),
          budget: parseMetaBudget(mc.daily_budget),
          objective: mc.objective,
          startDate: mc.start_time ? new Date(mc.start_time) : null,
          endDate: mc.stop_time ? new Date(mc.stop_time) : null,
          lastSyncAt: new Date(),
        },
        update: {
          name: mc.name,
          status: mapMetaStatus(mc.status),
          budget: parseMetaBudget(mc.daily_budget),
          startDate: mc.start_time ? new Date(mc.start_time) : null,
          endDate: mc.stop_time ? new Date(mc.stop_time) : null,
          lastSyncAt: new Date(),
        },
      })

      const metaAdSets = await fetchAdSets(accessToken, mc.id)
      for (const mas of metaAdSets) {
        const adSet = await db.adSet.upsert({
          where: { metaAdSetId: mas.id },
          create: {
            organizationId,
            campaignId: campaign.id,
            metaAdSetId: mas.id,
            name: mas.name,
            status: mas.status,
            dailyBudget: parseMetaBudget(mas.daily_budget),
            targeting: mas.targeting ?? undefined,
            bidStrategy: mas.bid_strategy ?? null,
            startTime: mas.start_time ? new Date(mas.start_time) : null,
            stopTime: mas.stop_time ? new Date(mas.stop_time) : null,
          },
          update: {
            name: mas.name,
            status: mas.status,
            dailyBudget: parseMetaBudget(mas.daily_budget),
            targeting: mas.targeting ?? undefined,
          },
        })
        adSetsSynced++

        const metaAds = await fetchAds(accessToken, mas.id)
        for (const ma of metaAds) {
          await db.ad.upsert({
            where: { metaAdId: ma.id },
            create: {
              organizationId,
              adSetId: adSet.id,
              metaAdId: ma.id,
              name: ma.name,
              status: ma.status,
              creativeType: null,
              creativeUrl: ma.creative?.thumbnail_url ?? null,
            },
            update: {
              name: ma.name,
              status: ma.status,
              creativeUrl: ma.creative?.thumbnail_url ?? null,
            },
          })
          adsSynced++
        }
      }
    }

    return {
      campaignsSynced: metaCampaigns.length,
      adSetsSynced,
      adsSynced,
    }
  } catch (error) {
    console.error("[Meta Sync] Error:", error)
    return {
      campaignsSynced: 0,
      adSetsSynced: 0,
      adsSynced: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// ─── Sync metrici zilnice ─────────────────────────────────────────────────────

export async function syncDailyMetrics(
  organizationId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ metricsUpserted: number; error?: string }> {
  const resolvedFrom = dateFrom ?? getYesterday()
  const resolvedTo = dateTo ?? getYesterday()

  const connection = await db.metaConnection.findUnique({
    where: { organizationId },
  })
  if (!connection) throw new Error("No Meta connection")

  const accessToken = decrypt(connection.accessTokenEncrypted)

  try {
    const insights = await fetchCampaignInsights(
      accessToken,
      connection.adAccountId,
      resolvedFrom,
      resolvedTo,
      "campaign"
    )

    let metricsUpserted = 0

    for (const insight of insights) {
      if (!insight.campaign_id) continue

      const campaign = await db.campaign.findFirst({
        where: { organizationId, metaCampaignId: insight.campaign_id },
      })
      if (!campaign) continue

      const insightDate = insight.date_start
      const spend = parseFloat(insight.spend || "0")
      const purchases = parsePurchases(insight)
      const purchaseValue = parsePurchaseValue(insight)
      const impressions = parseInt(insight.impressions || "0", 10)
      const clicks = parseInt(insight.clicks || "0", 10)
      const cpm = parseFloat(insight.cpm || "0")
      const ctr = parseFloat(insight.ctr || "0")
      const roas = spend > 0 ? purchaseValue / spend : null

      await db.campaignMetrics.upsert({
        where: {
          campaignId_date: {
            campaignId: campaign.id,
            date: new Date(insightDate),
          },
        },
        create: {
          campaignId: campaign.id,
          date: new Date(insightDate),
          spend,
          impressions,
          clicks,
          purchases,
          roas,
          cpm,
          ctr,
          ...buildExtendedMetricFields(insight, purchaseValue),
        },
        update: {
          spend,
          impressions,
          clicks,
          purchases,
          roas,
          cpm,
          ctr,
          ...buildExtendedMetricFields(insight, purchaseValue),
        },
      })

      metricsUpserted++
    }

    return { metricsUpserted }
  } catch (error) {
    console.error("[Meta Sync Campaign] Error:", error)
    return {
      metricsUpserted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// ─── Sync metrici adset zilnice ───────────────────────────────────────────────

export async function syncAdSetMetrics(
  organizationId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ metricsUpserted: number; error?: string }> {
  const resolvedFrom = dateFrom ?? getYesterday()
  const resolvedTo = dateTo ?? getYesterday()

  const connection = await db.metaConnection.findUnique({
    where: { organizationId },
  })
  if (!connection) throw new Error("No Meta connection")

  const accessToken = decrypt(connection.accessTokenEncrypted)

  try {
    const insights = await fetchCampaignInsights(
      accessToken,
      connection.adAccountId,
      resolvedFrom,
      resolvedTo,
      "adset"
    )

    let metricsUpserted = 0

    for (const insight of insights) {
      if (!insight.adset_id) continue

      const adSet = await db.adSet.findFirst({
        where: { organizationId, metaAdSetId: insight.adset_id },
      })
      if (!adSet) continue

      const insightDate = insight.date_start
      const spend = parseFloat(insight.spend || "0")
      const purchases = parsePurchases(insight)
      const purchaseValue = parsePurchaseValue(insight)
      const impressions = parseInt(insight.impressions || "0", 10)
      const clicks = parseInt(insight.clicks || "0", 10)
      const cpm = parseFloat(insight.cpm || "0")
      const ctr = parseFloat(insight.ctr || "0")
      const roas = spend > 0 ? purchaseValue / spend : null

      await db.adSetMetrics.upsert({
        where: {
          adSetId_date: {
            adSetId: adSet.id,
            date: new Date(insightDate),
          },
        },
        create: {
          adSetId: adSet.id,
          date: new Date(insightDate),
          spend,
          impressions,
          clicks,
          purchases,
          roas,
          cpm,
          ctr,
          ...buildExtendedMetricFields(insight, purchaseValue),
        },
        update: {
          spend,
          impressions,
          clicks,
          purchases,
          roas,
          cpm,
          ctr,
          ...buildExtendedMetricFields(insight, purchaseValue),
        },
      })

      metricsUpserted++
    }

    return { metricsUpserted }
  } catch (error) {
    console.error("[Meta Sync AdSet] Error:", error)
    return {
      metricsUpserted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildExtendedMetricFields(insight: MetaInsights, purchaseValue: number) {
  return {
    reach: insight.reach ? parseInt(insight.reach, 10) : null,
    frequency: insight.frequency ? parseFloat(insight.frequency) : null,
    purchaseValue: purchaseValue > 0 ? purchaseValue : null,
    landingPageViews: parseActionCount(insight.landing_page_views, "landing_page_view"),
    addToCart: parseActionCount(insight.actions, "add_to_cart"),
    initiateCheckout: parseActionCount(insight.actions, "initiate_checkout"),
    videoPlays: parseVideoMetric(insight.video_play_actions),
    videoP25: parseVideoMetric(insight.video_p25_watched_actions),
    videoP50: parseVideoMetric(insight.video_p50_watched_actions),
    videoP75: parseVideoMetric(insight.video_p75_watched_actions),
    videoP95: parseVideoMetric(insight.video_p95_watched_actions),
    videoAvgWatchTimeSec: parseVideoAvgWatchTime(insight.video_avg_time_watch_actions),
    videoThruPlays: parseVideoMetric(insight.video_thruplay_watched_actions),
  }
}

function mapMetaStatus(status: string): "ACTIVE" | "PAUSED" | "COMPLETED" | "DRAFT" {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE"
    case "PAUSED":
      return "PAUSED"
    case "ARCHIVED":
    case "DELETED":
      return "COMPLETED"
    default:
      return "DRAFT"
  }
}

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}
