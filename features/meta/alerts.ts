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
  frequencyHighThreshold?: number      // default 3.5
  landingPageViewMinRate?: number      // default 0.5
  noAddToCartSpendThreshold?: number   // default 200
  hookRateMinThreshold?: number        // default 0.25
  hookRateMinPlays?: number            // default 100
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
  frequencyHighThreshold: 3.5,
  landingPageViewMinRate: 0.5,
  noAddToCartSpendThreshold: 200,
  hookRateMinThreshold: 0.25,
  hookRateMinPlays: 100,
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

async function checkFrequencyAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
): Promise<void> {
  const recentMetrics = campaign.metrics.slice(0, 3)
  if (recentMetrics.length < 3) return

  const validMetrics = recentMetrics.filter((m) => m.frequency != null)
  if (validMetrics.length < 3) return

  const avgFrequency = validMetrics.reduce((sum, m) => sum + m.frequency!, 0) / validMetrics.length
  const threshold = config.frequencyHighThreshold ?? 3.5

  if (avgFrequency <= threshold) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.FREQUENCY_HIGH, {
    frequency: avgFrequency,
    threshold,
    message: `Frecvență ridicată (${avgFrequency.toFixed(2)}) în ultimele 3 zile — audiența poate fi obosită de anunț`,
  })
}

async function checkLandingPageAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
): Promise<void> {
  const recentMetrics = campaign.metrics.slice(0, 7)
  const totalClicks = recentMetrics.reduce((sum, m) => sum + (m.clicks ?? 0), 0)
  const totalLpv = recentMetrics.reduce((sum, m) => sum + (m.landingPageViews ?? 0), 0)

  if (totalClicks < 100) return

  const lpvRate = totalLpv / totalClicks
  const lpvThreshold = config.landingPageViewMinRate ?? 0.5
  if (lpvRate >= lpvThreshold) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.LANDING_PAGE_DROP, {
    landingPageViewRate: lpvRate,
    threshold: lpvThreshold,
    totalClicks,
    message: `Rata landing page (${(lpvRate * 100).toFixed(1)}%) sub ${(lpvThreshold * 100).toFixed(0)}% din ${totalClicks} click-uri — verifică viteza paginii sau redirecționările`,
  })
}

async function checkNoAddToCartAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
): Promise<void> {
  const recentMetrics = campaign.metrics.slice(0, 3)
  if (recentMetrics.length < 3) return

  const totalSpend = recentMetrics.reduce((sum, m) => sum + (m.spend ?? 0), 0)
  const totalAddToCart = recentMetrics.reduce((sum, m) => sum + (m.addToCart ?? 0), 0)

  const spendThreshold = config.noAddToCartSpendThreshold ?? 200
  if (totalSpend < spendThreshold) return
  if (totalAddToCart > 0) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.NO_ADD_TO_CART, {
    spend: totalSpend,
    addToCart: totalAddToCart,
    message: `Spend de ${totalSpend.toFixed(0)} RON în 3 zile fără niciun Add to Cart — consideră schimbarea targetării sau a ofertei`,
  })
}

async function checkHookRateAlert(
  campaign: CampaignWithMetrics,
  config: AlertConfig,
  organizationId: string
): Promise<void> {
  const recentMetrics = campaign.metrics.slice(0, 3)

  const totalPlays = recentMetrics.reduce((sum, m) => sum + (m.videoPlays ?? 0), 0)
  const totalP25 = recentMetrics.reduce((sum, m) => sum + (m.videoP25 ?? 0), 0)

  const minPlays = config.hookRateMinPlays ?? 100
  if (totalPlays < minPlays) return

  const hookRate = totalP25 / totalPlays
  const hookThreshold = config.hookRateMinThreshold ?? 0.25
  if (hookRate >= hookThreshold) return

  await createAlertIfNotExists(campaign.id, organizationId, AlertType.HOOK_RATE_LOW, {
    hookRate,
    threshold: hookThreshold,
    videoPlays: totalPlays,
    message: `Hook rate scăzut (${(hookRate * 100).toFixed(1)}%) din ${totalPlays} vizionări — primele 3 secunde ale video-ului nu captează atenția`,
  })
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
      },
    },
  })

  for (const campaign of campaigns) {
    await checkRoasAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkSpendAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCtrAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCpmAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkFrequencyAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkLandingPageAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkNoAddToCartAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkHookRateAlert(campaign as CampaignWithMetrics, config, organizationId)
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
