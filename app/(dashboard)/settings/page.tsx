import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)

  const org = orgId ? await db.organization.findUnique({
    where: { id: orgId },
    select: {
      shopifyFeeRate: true,
      incomeTaxType: true,
      packagingCostDefault: true,
      returnRateDefault: true,
      shopifyMonthlyFee: true,
      packagingMonthlyBudget: true,
      shippingCostDefault: true,
      isVatPayer: true,
      eurToRonFixed: true,
    },
  }) : null

  const metaConnection = orgId ? await db.metaConnection.findUnique({
    where: { organizationId: orgId },
    select: { id: true, adAccountId: true, pageId: true, pixelId: true, updatedAt: true },
  }) : null

  const orgSettings = {
    shopifyFeeRate: org?.shopifyFeeRate ?? 0.02,
    incomeTaxType: (org?.incomeTaxType ?? 'MICRO_1') as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16',
    packagingCostDefault: org?.packagingCostDefault ?? 0,
    returnRateDefault: org?.returnRateDefault ?? 0.05,
    shopifyMonthlyFee: org?.shopifyMonthlyFee ?? 140,
    packagingMonthlyBudget: org?.packagingMonthlyBudget ?? 0,
    shippingCostDefault: org?.shippingCostDefault ?? 20,
    isVatPayer: org?.isVatPayer ?? true,
    eurToRonFixed: org?.eurToRonFixed ?? null,
  }

  const metaConn = metaConnection
    ? { ...metaConnection, updatedAt: metaConnection.updatedAt.toISOString() }
    : null

  return (
    <SettingsClient
      orgSettings={orgSettings}
      metaConnection={metaConn}
      userEmail={session.user?.email ?? ''}
      userName={session.user?.name ?? session.user?.email?.split('@')[0] ?? ''}
    />
  )
}
