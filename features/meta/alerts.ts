import { db } from "@/lib/db"
import { AlertType } from "@prisma/client"
import { decrypt } from "@/lib/crypto"
import { updateCampaignStatus } from "./client"

interface AlertConfig {
  roasLowThreshold: number
  roasLowDays: number
  roasAutoPauseDays: number
  roasAutoPauseThreshold: number
  spendExceededRatio: number
  ctrLowThreshold: number
  ctrMinImpressions: number
  cpmHighThreshold: number
}

const DEFAULT_CONFIG: AlertConfig = {
  roasLowThreshold: 1.5,
  roasLowDays: 3,
  roasAutoPauseDays: 5,
  roasAutoPauseThreshold: 0.8,
  spendExceededRatio: 1.1,
  ctrLowThreshold: 0.8,
  ctrMinImpressions: 1000,
  cpmHighThreshold: 40,
}

type CampaignWithMetrics = Awaited<
  ReturnType<typeof db.campaign.findFirst>
> & {
  metrics: Array<{
    spend: number
    impressions: number
    clicks: number
    roas: number | null
    cpm: number | null
    ctr: number | null
    purchases: number
    frequency: number | null
    landingPageViews: number | null
    addToCart: number | null
    videoPlays: number | null
    videoP25: number | null
  }>
}

export async function checkAlertsForOrganization(
  organizationId: string,
  config: AlertConfig = DEFAULT_CONFIG
): Promise<void> {
  const campaigns = await db.campaign.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: {
      metrics: {
        orderBy: { date: "desc" },
        take: 7,
        select: {
          spend: true,
          impressions: true,
          clicks: true,
          roas: true,
          cpm: true,
          ctr: true,
          purchases: true,
          frequency: true,
          landingPageViews: true,
          addToCart: true,
          videoPlays: true,
          videoP25: true,
        },
      },
    },
  })

  for (const campaign of campaigns) {
    await checkRoasAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkSpendAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCtrAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCpmAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkFrequencyAlert(campaign as CampaignWithMetrics, organizationId)
    await checkLandingPageDropAlert(campaign as CampaignWithMetrics, organizationId)
    await checkNoAddToCartAlert(campaign as CampaignWithMetrics, organizationId)
    await checkHookRateAlert(campaign as CampaignWithMetrics, organizationId)
  }
}

async function checkRoasAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const recentMetrics = campaign.metrics.filter((m) => m.roas !== null)
  if (recentMetrics.length === 0) return

  const lowRoasDays = recentMetrics.filter(
    (m) => m.roas !== null && m.roas < config.roasLowThreshold
  )

  if (lowRoasDays.length >= config.roasLowDays) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.ROAS_LOW, {
      roas: lowRoasDays[0].roas,
      threshold: config.roasLowThreshold,
      daysBelow: lowRoasDays.length,
      message: `ROAS sub ${config.roasLowThreshold}x timp de ${lowRoasDays.length} zile consecutive`,
    })
  }

  const autoPauseDays = recentMetrics.filter(
    (m) => m.roas !== null && m.roas < config.roasAutoPauseThreshold
  )

  if (autoPauseDays.length >= config.roasAutoPauseDays && campaign.metaCampaignId) {
    const connection = await db.metaConnection.findUnique({
      where: { organizationId },
    })

    if (connection) {
      const accessToken = decrypt(connection.accessTokenEncrypted)
      await updateCampaignStatus(accessToken, campaign.metaCampaignId, "PAUSED")
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "PAUSED" },
      })

      await createAlertIfNotExists(campaign.id, organizationId, AlertType.AUTO_PAUSED, {
        roas: autoPauseDays[0].roas,
        threshold: config.roasAutoPauseThreshold,
        daysBelow: autoPauseDays.length,
        message: `Campanie oprită automat: ROAS sub ${config.roasAutoPauseThreshold}x pentru ${autoPauseDays.length} zile consecutive`,
      })
    }
  }
}

async function checkSpendAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const today = campaign.metrics[0]
  if (!today) return

  const spendThreshold = campaign.budget * config.spendExceededRatio
  if (today.spend > spendThreshold) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.SPEND_EXCEEDED, {
      spend: today.spend,
      budget: campaign.budget,
      ratio: today.spend / campaign.budget,
      message: `Spend zilnic (${today.spend} RON) depășește bugetul (${campaign.budget} RON) cu ${Math.round((today.spend / campaign.budget - 1) * 100)}%`,
    })
  }
}

async function checkCtrAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const today = campaign.metrics[0]
  if (!today || today.impressions < config.ctrMinImpressions) return

  if (today.ctr !== null && today.ctr < config.ctrLowThreshold) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.CTR_LOW, {
      ctr: today.ctr,
      threshold: config.ctrLowThreshold,
      impressions: today.impressions,
      message: `CTR scăzut (${today.ctr.toFixed(2)}%) după ${today.impressions.toLocaleString("ro-RO")} impresii — consideră schimbarea creative-ului`,
    })
  }
}

async function checkCpmAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
) {
  const today = campaign.metrics[0]
  if (!today || today.cpm === null) return

  if (today.cpm > config.cpmHighThreshold) {
    await createAlertIfNotExists(campaign.id, organizationId, AlertType.CPM_HIGH, {
      cpm: today.cpm,
      threshold: config.cpmHighThreshold,
      message: `CPM ridicat (${today.cpm.toFixed(1)} RON) — audiența poate fi prea scumpă sau concurența ridicată`,
    })
  }
}

async function checkFrequencyAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  const recentMetrics = campaign.metrics.slice(0, 3)
  if (recentMetrics.length < 3) return

  const allHighFrequency = recentMetrics.every(
    (m) => m.frequency !== null && m.frequency > 3.5
  )
  if (!allHighFrequency) return

  const avgFrequency = recentMetrics.reduce((sum, m) => sum + (m.frequency ?? 0), 0) / recentMetrics.length

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.FREQUENCY_HIGH, {
    frequency: avgFrequency,
    threshold: 3.5,
    message: `Audiența obosită — aceeași persoană vede reclama de ${avgFrequency.toFixed(1)}x în ultimele 3 zile`,
  })
}

async function checkLandingPageDropAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  const today = campaign.metrics[0]
  if (!today || today.clicks === 0) return
  if (today.landingPageViews === null) return

  const ratio = today.landingPageViews / today.clicks
  if (ratio >= 0.5) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.LANDING_PAGE_DROP, {
    ratio,
    clicks: today.clicks,
    landingPageViews: today.landingPageViews,
    message: `Doar ${Math.round(ratio * 100)}% din click-uri ajung pe site — verifică URL-ul reclamei`,
  })
}

async function checkNoAddToCartAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  const totalSpend = campaign.metrics.reduce((sum, m) => sum + m.spend, 0)
  const totalAddToCart = campaign.metrics.reduce((sum, m) => sum + (m.addToCart ?? 0), 0)

  if (totalSpend < 200 || totalAddToCart > 0) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.NO_ADD_TO_CART, {
    spend: totalSpend,
    message: `Nicio adăugare în coș după ${totalSpend.toFixed(0)} RON cheltuit — problema e la landing page`,
  })
}

async function checkHookRateAlert(
  campaign: CampaignWithMetrics,
  organizationId: string
) {
  const today = campaign.metrics[0]
  if (!today || !today.videoPlays || today.videoPlays === 0) return
  if (today.videoP25 === null) return

  const hookRate = today.videoP25 / today.videoPlays
  if (hookRate >= 0.25) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.HOOK_RATE_LOW, {
    hookRate,
    videoPlays: today.videoPlays,
    videoP25: today.videoP25,
    message: `Hook slab — doar ${Math.round(hookRate * 100)}% din vizionatori trec de primele 25%`,
  })
}

async function createAlertIfNotExists(
  campaignId: string,
  organizationId: string,
  type: AlertType,
  metadata: Record<string, unknown> & { message: string }
): Promise<void> {
  const existing = await db.campaignAlert.findFirst({
    where: {
      campaignId,
      type,
      isResolved: false,
      triggeredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })

  if (existing) return

  await db.campaignAlert.create({
    data: {
      organizationId,
      campaignId,
      type,
      message: metadata.message,
      metadata: metadata as object,
    },
  })
}
