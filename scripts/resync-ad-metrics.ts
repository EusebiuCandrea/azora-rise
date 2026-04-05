#!/usr/bin/env tsx
// One-time script to re-sync all campaigns + ad metrics from Mar 7, 2026
import { syncCampaignsFromMeta, syncAdMetrics, syncAdSetMetrics, syncDailyMetrics } from "../features/meta/campaigns-sync"
import { db } from "../lib/db"

async function main() {
  const connections = await db.metaConnection.findMany({ select: { organizationId: true } })
  if (connections.length === 0) {
    console.error("No Meta connections found")
    process.exit(1)
  }

  const dateFrom = "2026-03-07"
  const dateTo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  for (const { organizationId } of connections) {
    console.log(`\n=== Syncing org: ${organizationId} ===`)

    console.log("1/4 Syncing campaigns + adsets + ads...")
    const campaignsResult = await syncCampaignsFromMeta(organizationId)
    console.log(`   campaigns=${campaignsResult.campaignsSynced} adsets=${campaignsResult.adSetsSynced} ads=${campaignsResult.adsSynced}`)

    console.log(`2/4 Syncing campaign metrics (${dateFrom} → ${dateTo})...`)
    const campaignMetrics = await syncDailyMetrics(organizationId, dateFrom, dateTo)
    console.log(`   metricsUpserted=${campaignMetrics.metricsUpserted}`)

    console.log(`3/4 Syncing adset metrics (${dateFrom} → ${dateTo})...`)
    const adSetMetrics = await syncAdSetMetrics(organizationId, dateFrom, dateTo)
    console.log(`   metricsUpserted=${adSetMetrics.metricsUpserted}`)

    console.log(`4/4 Syncing ad metrics (${dateFrom} → ${dateTo})...`)
    const adMetrics = await syncAdMetrics(organizationId, dateFrom, dateTo)
    console.log(`   metricsUpserted=${adMetrics.metricsUpserted}`)
  }

  console.log("\n✓ Re-sync complete")
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
