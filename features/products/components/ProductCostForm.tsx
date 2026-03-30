'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import type { ProductCost } from '@prisma/client'
import { BarChart2 } from 'lucide-react'

const costSchema = z.object({
  cogs: z.coerce.number().min(0),
  supplierVatDeductible: z.boolean(),
  vatRate: z.coerce.number().min(0).max(1),
})

type CostFormValues = z.infer<typeof costSchema>

interface OrgSettings {
  shopifyFeeRate: number
  incomeTaxType: 'MICRO_1' | 'MICRO_3' | 'PROFIT_16'
  shippingCostDefault: number
  packagingCostDefault: number
  returnRateDefault: number
}

interface ProductCostFormProps {
  productId: string
  cost: ProductCost | null
  price: number
  orgSettings: OrgSettings
}

const TAX_LABELS: Record<OrgSettings['incomeTaxType'], string> = {
  MICRO_1: 'Micro 1%',
  MICRO_3: 'Micro 3%',
  PROFIT_16: 'Impozit Profit 16%',
}

const TAX_RATES: Record<OrgSettings['incomeTaxType'], number> = {
  MICRO_1: 0.01,
  MICRO_3: 0.03,
  PROFIT_16: 0.16,
}

function CurrencyInput({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#78716C]">{label}</label>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          className="w-full h-10 px-3 pr-12 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
          {...props}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">RON</span>
      </div>
    </div>
  )
}

export function ProductCostForm({ productId, cost, price, orgSettings }: ProductCostFormProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const form = useForm<CostFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(costSchema) as any,
    defaultValues: {
      cogs: cost?.cogs ?? 0,
      supplierVatDeductible: cost?.supplierVatDeductible ?? false,
      vatRate: cost?.vatRate === 0.19 ? 0.21 : (cost?.vatRate ?? 0.21),
    },
  })

  const values = useWatch({ control: form.control })

  // Live profitability calculation
  const cogs = Number(values.cogs) || 0
  const shipping = orgSettings.shippingCostDefault
  const packaging = orgSettings.packagingCostDefault
  const vatRate = Number(values.vatRate) || 0.21
  const supplierVatDeductible = values.supplierVatDeductible ?? false

  // Use org-level defaults
  const returnRate = orgSettings.returnRateDefault
  const shopifyFeeRate = orgSettings.shopifyFeeRate
  const taxRate = TAX_RATES[orgSettings.incomeTaxType]

  const shopifyFee = price * shopifyFeeRate
  const vatCollected = price * vatRate
  const vatDeducted = supplierVatDeductible ? (cogs + shipping + packaging) * vatRate : 0
  const returnLoss = price * returnRate
  const totalCosts = cogs + shipping + packaging
  const profit = price - totalCosts + vatDeducted - shopifyFee - vatCollected - returnLoss
  const margin = price > 0 ? (profit / price) * 100 : 0
  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0
  const taxEstimate = price * taxRate
  const profitAfterTax = profit - taxEstimate

  const returnRatePercent = Math.round(returnRate * 100)

  async function onSubmit(vals: CostFormValues) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/products/${productId}/cost`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...vals, returnRate: orgSettings.returnRateDefault }),
      })
      if (!res.ok) throw new Error('Eroare la salvare')
      setMessage({ type: 'success', text: 'Modificările au fost salvate.' })
    } catch {
      setMessage({ type: 'error', text: 'Eroare la salvare. Încearcă din nou.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Cost configuration card */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-[#1C1917]">Configurare costuri</h2>
          <button
            onClick={form.handleSubmit(onSubmit)}
            disabled={saving}
            className="px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Cost inputs grid */}
          <div className="grid grid-cols-1 gap-4">
            <CurrencyInput label="Cost achiziție (COGS)" {...form.register('cogs')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Shopify fee readonly */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#78716C]">Taxa Shopify</label>
              <div className="h-10 px-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg flex items-center">
                <span className="text-sm text-[#78716C]">{(shopifyFeeRate * 100).toFixed(1)}%</span>
                <span className="ml-auto text-[10px] text-[#78716C] bg-[#E7E5E4] px-1.5 py-0.5 rounded">auto</span>
              </div>
            </div>

            {/* VAT rate */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#78716C]">Cota TVA</label>
              <select
                {...form.register('vatRate')}
                className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] appearance-none"
              >
                <option value={0.21}>21%</option>
                <option value={0.19}>19% (pre-2026)</option>
                <option value={0.09}>9%</option>
                <option value={0.05}>5%</option>
                <option value={0}>0%</option>
              </select>
            </div>
          </div>

          {/* Supplier VAT toggle */}
          <div className="flex items-center justify-between py-1">
            <label className="text-sm text-[#1C1917]">TVA furnizor deductibil</label>
            <button
              type="button"
              onClick={() => form.setValue('supplierVatDeductible', !values.supplierVatDeductible)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                values.supplierVatDeductible ? 'bg-[#D4AF37]' : 'bg-[#E7E5E4]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                  values.supplierVatDeductible ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Inherited org settings info */}
          <div className="pt-1 border-t border-[#F5F5F4]">
            <p className="text-[11px] text-[#78716C] mb-2">Setări moștenite din magazin:</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-full text-[11px] text-[#78716C]">
                impozitare: {TAX_LABELS[orgSettings.incomeTaxType]}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-full text-[11px] text-[#78716C]">
                rată retur: {returnRatePercent}%
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-full text-[11px] text-[#78716C]">
                transport: {orgSettings.shippingCostDefault.toFixed(2)} RON
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-full text-[11px] text-[#78716C]">
                ambalare: {orgSettings.packagingCostDefault.toFixed(2)} RON
              </span>
            </div>
          </div>

          {message && (
            <p
              className={`text-sm px-3 py-2 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-[#DCFCE7] border-[#BBF7D0] text-[#15803D]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
              }`}
            >
              {message.text}
            </p>
          )}
        </form>
      </div>

      {/* Profitability card */}
      <div className="bg-[#FAFAF9] border border-[#D4AF37]/30 rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-[#D4AF37]" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-[#1C1917]">Profitabilitate estimată</h2>
        </div>

        <p className="text-xs text-[#78716C] mb-3 font-medium uppercase tracking-wide">Calcul profit per unitate</p>

        <div className="space-y-1.5">
          {[
            { label: 'Preț vânzare', value: `${price.toFixed(2)} RON`, bold: false, color: '#1C1917' },
            { label: '− COGS', value: `− ${cogs.toFixed(2)} RON`, bold: false, color: '#78716C' },
            { label: '− Transport & Ambalare', value: `− ${(shipping + packaging).toFixed(2)} RON`, bold: false, color: '#78716C' },
            {
              label: supplierVatDeductible ? 'TVA (Colectată − Deductibilă)' : 'TVA colectată',
              value: `− ${(vatCollected - vatDeducted).toFixed(2)} RON`,
              bold: false,
              color: '#78716C',
            },
            { label: `Shopify Fee (${(shopifyFeeRate * 100).toFixed(1)}%)`, value: `− ${shopifyFee.toFixed(2)} RON`, bold: false, color: '#78716C' },
            { label: `Provizion Retur (${returnRatePercent}%)`, value: `− ${returnLoss.toFixed(2)} RON`, bold: false, color: '#78716C' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-1 border-b border-[#F5F5F4] last:border-0">
              <span className="text-sm text-[#78716C]">{row.label}</span>
              <span className="text-sm font-medium" style={{ color: row.color }}>{row.value}</span>
            </div>
          ))}

          <div className="pt-2 mt-1 border-t-2 border-[#E7E5E4]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#78716C] font-medium">PROFIT NET / UNITATE</p>
                <p className={`text-2xl font-bold mt-0.5 ${profit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {profit.toFixed(2)} RON
                </p>
              </div>
              <div className="text-right space-y-1">
                <div>
                  <p className="text-[10px] text-[#78716C] uppercase tracking-wide">MARJĂ NETĂ</p>
                  <p className={`text-lg font-bold ${margin >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    {margin.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#78716C] uppercase tracking-wide">ROI ESTIMAT</p>
                  <p className={`text-lg font-bold ${roi >= 0 ? 'text-[#D4AF37]' : 'text-[#DC2626]'}`}>
                    {roi.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tax estimate */}
        <div className="mt-4 pt-4 border-t border-[#E7E5E4]">
          <p className="text-xs text-[#78716C]">
            <span className="font-medium text-[#1C1917]">Impozit estimat ({TAX_LABELS[orgSettings.incomeTaxType]}):</span>{' '}
            {taxEstimate.toFixed(2)} RON · Profit după impozit:{' '}
            <span className="font-medium text-[#16A34A]">{profitAfterTax.toFixed(2)} RON</span>
          </p>
        </div>

        <p className="text-xs text-[#78716C] italic mt-3">
          Valorile se actualizează live pe măsură ce modifici costurile.
        </p>
      </div>

    </div>
  )
}
