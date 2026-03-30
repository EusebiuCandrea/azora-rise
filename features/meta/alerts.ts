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
      },
    },
  })

  for (const campaign of campaigns) {
    await checkRoasAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkSpendAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCtrAlert(campaign as CampaignWithMetrics, config, organizationId)
    await checkCpmAlert(campaign as CampaignWithMetrics, config, organizationId)
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
