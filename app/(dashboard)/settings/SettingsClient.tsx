'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { RefreshCw, Trash2, ShoppingBag, Link as LinkIcon, Settings } from 'lucide-react'
import { MetaConnectionCard } from '@/features/meta/components/MetaConnectionCard'

interface OrgSettings {
  shopifyFeeRate: number
  incomeTaxType: 'MICRO_1' | 'MICRO_3' | 'PROFIT_16'
  packagingCostDefault: number
  returnRateDefault: number
  shopifyMonthlyFee: number
  packagingMonthlyBudget: number
  shippingCostDefault: number
  isVatPayer: boolean
  eurToRonFixed: number | null
}

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
      Conectat
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F4] text-[#78716C]">
      Neconectat
    </span>
  )
}

function StoreSettingsForm({ orgSettings }: { orgSettings: OrgSettings }) {
  const [shopifyFeeRate, setShopifyFeeRate] = useState(
    (orgSettings.shopifyFeeRate * 100).toFixed(1)
  )
  const [incomeTaxType, setIncomeTaxType] = useState<'MICRO_1' | 'MICRO_3' | 'PROFIT_16'>(
    orgSettings.incomeTaxType
  )
  const [packagingCostDefault, setPackagingCostDefault] = useState(
    orgSettings.packagingCostDefault.toFixed(2)
  )
  const [returnRateDefault, setReturnRateDefault] = useState(
    (orgSettings.returnRateDefault * 100).toFixed(1)
  )
  const [shopifyMonthlyFee, setShopifyMonthlyFee] = useState(
    ((orgSettings.shopifyMonthlyFee ?? 140)).toFixed(2)
  )
  const [packagingMonthlyBudget, setPackagingMonthlyBudget] = useState(
    ((orgSettings.packagingMonthlyBudget ?? 0)).toFixed(2)
  )
  const [shippingCostDefault, setShippingCostDefault] = useState(
    (orgSettings.shippingCostDefault ?? 20).toFixed(2)
  )
  const [isVatPayer, setIsVatPayer] = useState(orgSettings.isVatPayer ?? true)
  const [eurToRonFixed, setEurToRonFixed] = useState((orgSettings.eurToRonFixed ?? 4.97).toFixed(4))
  const [fetchingRate, setFetchingRate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchBnrRate() {
    setFetchingRate(true)
    try {
      const res = await fetch('https://www.bnr.ro/nbrfxrates.xml')
      const text = await res.text()
      // Parse EUR rate from XML: <Rate currency="EUR">4.9753</Rate>
      const match = text.match(/<Rate currency="EUR">([\d.]+)<\/Rate>/)
      if (match) {
        setEurToRonFixed(parseFloat(match[1]).toFixed(4))
      }
    } catch {
      // silently fail — user can type manually
    } finally {
      setFetchingRate(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/organizations/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopifyFeeRate: parseFloat(shopifyFeeRate) / 100,
          incomeTaxType,
          packagingCostDefault: parseFloat(packagingCostDefault),
          returnRateDefault: parseFloat(returnRateDefault) / 100,
          shopifyMonthlyFee: parseFloat(shopifyMonthlyFee),
          packagingMonthlyBudget: parseFloat(packagingMonthlyBudget),
          shippingCostDefault: parseFloat(shippingCostDefault),
          isVatPayer,
          eurToRonFixed: parseFloat(eurToRonFixed),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Eroare la salvare')
      }
      setMessage({ type: 'success', text: 'Setările au fost salvate.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: `Eroare: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Tax type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#78716C]">Tip impozitare</label>
          <select
            value={incomeTaxType}
            onChange={(e) => setIncomeTaxType(e.target.value as 'MICRO_1' | 'MICRO_3' | 'PROFIT_16')}
            className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 appearance-none"
          >
            <option value="MICRO_1">Micro 1%</option>
            <option value="MICRO_3">Micro 3%</option>
            <option value="PROFIT_16">Impozit Profit 16%</option>
          </select>
        </div>

        {/* Shopify fee */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#78716C]">Taxa Shopify</label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={shopifyFeeRate}
              onChange={(e) => setShopifyFeeRate(e.target.value)}
              className="w-full h-10 px-3 pr-8 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">%</span>
          </div>
          <p className="text-[11px] text-[#78716C]">Comision per tranzacție</p>
        </div>

        {/* Packaging cost */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#78716C]">Cost ambalare implicit (RON)</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={packagingCostDefault}
              onChange={(e) => setPackagingCostDefault(e.target.value)}
              className="w-full h-10 px-3 pr-12 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">RON</span>
          </div>
          <p className="text-[11px] text-[#78716C]">Pre-completat pentru produse noi</p>
        </div>

        {/* Shipping cost */}
        <div>
          <label className="text-xs font-medium text-[#78716C] block mb-1.5">
            Cost transport implicit (RON)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={shippingCostDefault}
              onChange={(e) => setShippingCostDefault(e.target.value)}
              className="w-full h-10 px-3 pr-12 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">RON</span>
          </div>
          <p className="text-[11px] text-[#78716C] mt-1">Cost livrare per comandă (Fan Courier, Cargus etc.)</p>
        </div>

        {/* Return rate */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#78716C]">Rată retur implicită</label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={returnRateDefault}
              onChange={(e) => setReturnRateDefault(e.target.value)}
              className="w-full h-10 px-3 pr-8 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">%</span>
          </div>
          <p className="text-[11px] text-[#78716C]">Se va calcula automat după sincronizarea comenzilor</p>
        </div>

        {/* EUR/RON rate */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#78716C]">Curs EUR/RON</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.0001"
                min="1"
                value={eurToRonFixed}
                onChange={(e) => setEurToRonFixed(e.target.value)}
                className="w-full h-10 px-3 pr-12 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">RON</span>
            </div>
            <button
              type="button"
              onClick={fetchBnrRate}
              disabled={fetchingRate}
              className="h-10 px-3 border border-[#E7E5E4] bg-white rounded-lg text-xs text-[#78716C] hover:bg-[#F5F5F4] transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {fetchingRate ? '...' : 'BNR live'}
            </button>
          </div>
          <p className="text-[11px] text-[#78716C]">Folosit pentru conversia cheltuielilor Meta (EUR → RON)</p>
        </div>
      </div>

      {/* VAT toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-[#1C1917]">Firmă plătitoare de TVA</p>
          <p className="text-[11px] text-[#78716C] mt-0.5">Dezactivează dacă nu depășești plafonul de 300.000 RON/an</p>
        </div>
        <button
          type="button"
          onClick={() => setIsVatPayer(v => !v)}
          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
            isVatPayer ? 'bg-[#D4AF37]' : 'bg-[#E7E5E4]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
              isVatPayer ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Monthly expenses divider */}
      <div className="pt-2">
        <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-3">Cheltuieli lunare fixe</p>
        <div className="grid grid-cols-2 gap-4">
          {/* Shopify monthly fee */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#78716C]">Abonament Shopify (RON/lună)</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={shopifyMonthlyFee}
                onChange={(e) => setShopifyMonthlyFee(e.target.value)}
                className="w-full h-10 px-3 pr-12 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">RON</span>
            </div>
            <p className="text-[11px] text-[#78716C]">Basic ~140 RON · Shopify ~280 RON</p>
          </div>

          {/* Packaging monthly budget */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#78716C]">Buget ambalaje (RON/lună)</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={packagingMonthlyBudget}
                onChange={(e) => setPackagingMonthlyBudget(e.target.value)}
                className="w-full h-10 px-3 pr-12 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C] font-medium">RON</span>
            </div>
            <p className="text-[11px] text-[#78716C]">Cumpărare cutii, folie, bandă etc.</p>
          </div>
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

      <button
        type="submit"
        disabled={saving}
        className="px-5 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
      >
        {saving ? 'Se salvează...' : 'Salvează setările'}
      </button>
    </form>
  )
}

interface SettingsClientProps {
  orgSettings: OrgSettings
  metaConnection: {
    id: string
    adAccountId: string
    pageId?: string | null
    pixelId?: string | null
    updatedAt: string
  } | null
  userEmail: string
  userName: string
}

export default function SettingsClient({ orgSettings, metaConnection, userEmail, userName }: SettingsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [shopDomain, setShopDomain] = useState('azora-shop-3.myshopify.com')
  const [accessToken, setAccessToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  function showMessage(msg: { type: 'success' | 'error'; text: string }) {
    setMessage(msg)
    if (msg.type === 'success') setTimeout(() => setMessage(null), 4000)
  }
  const [shopifyStatus, setShopifyStatus] = useState<{ connected: boolean; shopDomain: string | null; productCount?: number } | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  function refreshStatus() {
    fetch('/api/shopify/status')
      .then(r => r.json())
      .then(setShopifyStatus)
      .catch(() => {})
  }

  useEffect(() => { refreshStatus() }, [])

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'shopify_connected') {
      showMessage({ type: 'success', text: 'Shopify conectat cu succes!' })
      refreshStatus()
    } else if (error) {
      const detail = searchParams.get('detail') ?? ''
      const messages: Record<string, string> = {
        manual_connect_only: 'Conectarea Shopify se face acum doar manual, din formularul de mai jos.',
        invalid_token: `Token Shopify invalid. ${detail}`,
      }
      setMessage({ type: 'error', text: messages[error] ?? error })
    }
  }, [searchParams])

  async function handleManualConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/shopify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain, accessToken, webhookSecret }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Eroare conexiune')
      showMessage({ type: 'success', text: 'Shopify conectat cu succes!' })
      setAccessToken('')
      refreshStatus()
    } catch (err: any) {
      setMessage({ type: 'error', text: `Eroare: ${err.message}` })
    } finally {
      setConnecting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/shopify/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Eroare sync')
      setTimeout(() => setSyncing(false), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Eroare: ${err.message}` })
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    setShowDisconnectModal(false)
    setMessage(null)
    try {
      const res = await fetch('/api/shopify/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Eroare la deconectare')
      showMessage({ type: 'success', text: 'Shopify deconectat.' })
      refreshStatus()
    } catch (err: any) {
      setMessage({ type: 'error', text: `Eroare: ${err.message}` })
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Parolele nu coincid.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Parola trebuie să aibă cel puțin 8 caractere.' })
      return
    }
    setChangingPassword(true)
    setPasswordMsg(null)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Eroare')
      }
      setPasswordMsg({ type: 'success', text: 'Parola a fost schimbată.' })
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message })
    } finally {
      setChangingPassword(false)
    }
  }

  const connected = shopifyStatus?.connected ?? false

  return (
    <div className="max-w-2xl space-y-5">
      {/* Page header */}
      <h1 className="text-[22px] font-bold text-[#1C1917]">Setări</h1>

      {/* Global message */}
      {message && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
            message.type === 'success'
              ? 'bg-[#DCFCE7] border-[#BBF7D0] text-[#15803D]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Shopify card */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#96BF48]/10 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-[#96BF48]" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold text-[#1C1917]">Shopify</span>
          </div>
          {shopifyStatus !== null && <StatusBadge connected={connected} />}
        </div>

        <div className="p-5">
          {connected ? (
            /* CONNECTED STATE */
            <div className="space-y-4">
              {/* Store info */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F4] rounded-full border border-[#E7E5E4]">
                  <LinkIcon className="w-3 h-3 text-[#78716C]" strokeWidth={1.5} />
                  <span className="text-xs font-mono text-[#78716C]">{shopifyStatus?.shopDomain}</span>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-medium bg-[#F5F5F4] text-[#78716C] rounded border border-[#E7E5E4]">
                  Custom App
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 text-xs text-[#78716C]">
                <span>📦 Produse importate</span>
                <span>🕐 Shopify API: v2024-01</span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                  <span>Webhooks: Activ</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 h-9 border border-[#E7E5E4] bg-white rounded-lg text-sm text-[#1C1917] hover:bg-[#F5F5F4] transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  {syncing ? 'Se sincronizează...' : 'Sincronizează acum'}
                </button>
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  disabled={disconnecting}
                  className="flex items-center gap-2 px-4 h-9 border border-[#DC2626] bg-white rounded-lg text-sm text-[#DC2626] hover:bg-[#FEF2F2] transition-colors disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Deconectează
                </button>
              </div>
            </div>
          ) : (
            /* DISCONNECTED STATE */
            <div className="space-y-5">
              {/* Manual token section */}
              <form onSubmit={handleManualConnect} className="space-y-3">
                <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Conectare manuală</p>
                <p className="text-xs text-[#78716C]">
                  Store-ul se conectează direct din interfață, fără secrete Shopify păstrate în variabilele de mediu.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#78716C]">Shop domain</label>
                  <input
                    placeholder="azora.myshopify.com"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#78716C]">Access token</label>
                  <input
                    type="password"
                    placeholder="shpat_..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#78716C]">Webhook secret</label>
                  <input
                    type="password"
                    placeholder="orice string aleator"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={connecting || !shopDomain || !accessToken || !webhookSecret}
                  className="px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {connecting ? 'Se conectează...' : 'Conectează'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Meta Ads card */}
      <MetaConnectionCard
        connection={metaConnection}
        onConnect={() => router.refresh()}
      />

      {/* Store Settings card */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E7E5E4]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-[#D4AF37]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1C1917]">Configurare Magazin</p>
              <p className="text-xs text-[#78716C]">Setări de cost aplicabile tuturor produselor</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <StoreSettingsForm orgSettings={orgSettings} />
        </div>
      </div>

      {/* Account card */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E7E5E4]">
          <span className="text-sm font-semibold text-[#1C1917]">Cont</span>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center">
                <span className="text-xs font-bold text-[#1C1917]">{userName.slice(0, 2).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#1C1917]">{userName}</p>
                <p className="text-xs text-[#78716C]">{userEmail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordForm(v => !v)}
              className="px-3 h-8 border border-[#E7E5E4] bg-white rounded-lg text-xs text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
            >
              Schimbă parola
            </button>
          </div>
          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="mt-3 space-y-2 border border-[#E7E5E4] rounded-lg p-3 bg-[#FAFAF9]">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  placeholder="Parolă nouă (min. 8 car.)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="h-9 px-3 bg-white border border-[#E7E5E4] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#D4AF37]"
                />
                <input
                  type="password"
                  placeholder="Confirmă parola"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-9 px-3 bg-white border border-[#E7E5E4] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              {passwordMsg && (
                <p className={`text-xs px-2 py-1 rounded ${passwordMsg.type === 'success' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                  {passwordMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 h-8 bg-[#1C1917] text-white text-xs font-medium rounded-lg hover:bg-[#292524] transition-colors disabled:opacity-60"
              >
                {changingPassword ? 'Se schimbă...' : 'Salvează parola'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* About card */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm px-5 py-4">
        <p className="text-xs text-[#78716C]">Rise v1.0.0 · Azora SRL · 2026</p>
      </div>

      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowDisconnectModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-[#E7E5E4] p-7 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-[#1C1917] mb-2">Ești sigur că vrei să te deconectezi?</h2>
            <p className="text-sm text-[#78716C] mb-6">
              Toate produsele importate vor fi șterse din Rise. Produsele din Shopify nu vor fi afectate.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="flex-1 h-10 border border-[#E7E5E4] bg-white rounded-lg text-sm text-[#1C1917] font-medium hover:bg-[#F5F5F4] transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleDisconnect}
                className="flex-1 h-10 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Deconectează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
