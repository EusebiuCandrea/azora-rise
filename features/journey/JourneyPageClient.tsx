'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { JourneyAlertBanner } from './JourneyAlertBanner'
import { JourneyFilters, type Period } from './JourneyFilters'
import { JourneyFunnel } from './JourneyFunnel'
import { JourneyKPICards } from './JourneyKPICards'
import { JourneyMetricsChart } from './JourneyMetricsChart'
import { JourneyProductTable } from './JourneyProductTable'
import { JourneyAIPanel } from './JourneyAIPanel'
import { JourneyCampaignTable } from './JourneyCampaignTable'
import { useJourneyData } from './hooks/useJourneyData'

export function JourneyPageClient() {
  const [period, setPeriod] = useState<Period>('30')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useJourneyData(Number(period) as 7 | 30 | 90)

  const snapshot = data?.snapshot ?? null
  const aiReport = data?.aiReport ?? null
  const alerts = data?.alerts ?? []
  const history = data?.history ?? []
  const paymentSplit = data?.paymentSplit ?? null
  const campaigns = snapshot?.campaignBreakdown ?? []

  const criticalAlert = alerts.find((a) => a.severity === 'critical')

  async function handleAnalyze() {
    setIsAnalyzing(true)
    try {
      await fetch('/api/journey/snapshot', { method: 'POST' })
      const reportRes = await fetch('/api/journey/report', { method: 'POST' })
      if (!reportRes.ok) {
        const err = await reportRes.json().catch(() => ({}))
        const msg = (err as { error?: string }).error ?? `Eroare ${reportRes.status}`
        alert(`Generare raport eșuată: ${msg}`)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['journey'] })
    } catch (e) {
      alert('Eroare de rețea. Verifică conexiunea și încearcă din nou.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="max-w-[1200px] space-y-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-bold text-[#1C1917] leading-tight tracking-tight">
            Parcurs Client
          </h1>
          <p className="text-[#78716C] text-lg mt-2">Analiza detaliată a fluxului de conversie</p>
        </div>
        <JourneyFilters
          period={period}
          onPeriodChange={setPeriod}
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
        />
      </section>

      {/* Alert */}
      {criticalAlert && (
        <JourneyAlertBanner
          message={`${criticalAlert.metric} a scăzut cu ${(criticalAlert.deltaPercent * 100).toFixed(0)}% față de săptămâna precedentă.`}
        />
      )}

      {/* Funnel */}
      <JourneyFunnel snapshot={snapshot} isLoading={isLoading} />

      {/* KPI Cards */}
      <JourneyKPICards snapshot={snapshot} paymentSplit={paymentSplit} isLoading={isLoading} />

      {/* Split view */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        <div className="lg:col-span-2 space-y-8">
          <JourneyMetricsChart history={history} period={period} />
          <JourneyCampaignTable campaigns={campaigns} />
          <JourneyProductTable products={snapshot?.productBreakdown} />
        </div>
        <JourneyAIPanel
          report={aiReport}
          onRegenerate={handleAnalyze}
          isRegenerating={isAnalyzing}
        />
      </section>
    </div>
  )
}
