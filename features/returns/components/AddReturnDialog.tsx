'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/Toaster'

const fieldClass = 'mt-1 w-full rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] px-3 py-2 text-sm text-[#1C1917] placeholder:text-[#A8A29E] outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors'

interface OrderItem {
  shopifyProductId: string
  productId: string | null
  productTitle: string
  variantTitle: string | null
  sku: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  orgId: string
}

export function AddReturnDialog({ open, onClose, onCreated, orgId }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [form, setForm] = useState({
    orderNumber: '',
    shopifyOrderId: '',
    customerName: '',
    customerEmail: '',
    returnType: 'REFUND' as 'REFUND' | 'EXCHANGE',
    productTitle: '',
    variantTitle: '',
    sku: '',
    productId: '',
    reason: '',
    awbNumber: '',
    iban: '',
    ibanHolder: '',
    adminNotes: '',
  })

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  async function handleLookup() {
    const raw = form.orderNumber.replace('#', '').trim()
    if (!raw) return
    setLookupLoading(true)
    try {
      const res = await fetch(`/api/returns/lookup-order?orderNumber=${encodeURIComponent(raw)}&orgId=${orgId}`)
      const data = await res.json()
      if (!res.ok) {
        toast({ type: 'error', title: 'Comandă negăsită', description: data.error || 'Verifică numărul comenzii.' })
        return
      }
      setOrderItems(data.orderItems ?? [])
      const first = data.orderItems?.[0]
      setForm((prev) => ({
        ...prev,
        shopifyOrderId: data.shopifyOrderId || prev.shopifyOrderId,
        customerName: data.customerName || prev.customerName,
        customerEmail: data.customerEmail || prev.customerEmail,
        productTitle: first?.productTitle || prev.productTitle,
        variantTitle: first?.variantTitle || '',
        sku: first?.sku || '',
        productId: first?.productId || '',
      }))
    } catch {
      toast({ type: 'error', title: 'Eroare', description: 'Nu s-a putut contacta serverul.' })
    } finally {
      setLookupLoading(false)
    }
  }

  function handleProductSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const item = orderItems.find((i) => i.shopifyProductId === e.target.value)
    if (!item) return
    setForm((prev) => ({
      ...prev,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle || '',
      sku: item.sku || '',
      productId: item.productId || '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          customerEmail: form.customerEmail || undefined,
          variantTitle: form.variantTitle || null,
          sku: form.sku || null,
          productId: form.productId || null,
          awbNumber: form.awbNumber || null,
          iban: form.iban || null,
          ibanHolder: form.ibanHolder || null,
          adminNotes: form.adminNotes || null,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }
      toast({ type: 'success', title: 'Retur creat', description: `Returul pentru comanda #${form.orderNumber} a fost adăugat.` })
      onCreated()
      onClose()
    } catch (err) {
      toast({ type: 'error', title: 'Eroare', description: err instanceof Error ? err.message : 'Eroare necunoscută' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adaugă retur manual</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Order lookup */}
          <div>
            <Label htmlFor="orderNumber" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Nr. comandă *</Label>
            <div className="flex gap-2 mt-1">
              <input
                id="orderNumber"
                className={fieldClass.replace('mt-1 ', '')}
                value={form.orderNumber}
                onChange={(e) => set('orderNumber', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
                required
                placeholder="#1023"
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookupLoading}
                className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border border-[#D4AF37] text-[#D4AF37] hover:bg-[#FFFBEB] disabled:opacity-50 transition-colors"
              >
                {lookupLoading ? '...' : 'Caută'}
              </button>
            </div>
          </div>

          {/* Customer fields — auto-filled from lookup */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="customerName" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Nume client *</Label>
              <input id="customerName" className={fieldClass} value={form.customerName} onChange={(e) => set('customerName', e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="customerEmail" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Email client</Label>
              <input id="customerEmail" type="email" className={fieldClass} value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} placeholder="opțional" />
            </div>
          </div>

          {/* Return type */}
          <div>
            <Label className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Tip retur *</Label>
            <div className="flex gap-6 mt-2">
              {(['REFUND', 'EXCHANGE'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="returnType" value={t} checked={form.returnType === t} onChange={() => set('returnType', t)} className="accent-[#D4AF37]" />
                  <span className="text-sm font-medium text-[#1C1917]">{t === 'REFUND' ? 'Ramburs bani' : 'Schimb produs'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Product — dropdown if items loaded, text input otherwise */}
          <div>
            <Label htmlFor="productTitle" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Produs *</Label>
            {orderItems.length > 0 ? (
              <select
                className={fieldClass}
                onChange={handleProductSelect}
                defaultValue={orderItems[0]?.shopifyProductId}
              >
                {orderItems.map((item) => (
                  <option key={item.shopifyProductId} value={item.shopifyProductId}>
                    {item.productTitle}{item.variantTitle && item.variantTitle !== 'Default Title' ? ` — ${item.variantTitle}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input id="productTitle" className={fieldClass} value={form.productTitle} onChange={(e) => set('productTitle', e.target.value)} required />
            )}
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Motiv *</Label>
            <textarea id="reason" className={`${fieldClass} resize-none`} value={form.reason} onChange={(e) => set('reason', e.target.value)} required rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="awbNumber" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">AWB colet</Label>
              <input id="awbNumber" className={fieldClass} value={form.awbNumber} onChange={(e) => set('awbNumber', e.target.value)} placeholder="opțional" />
            </div>
            <div>
              <Label htmlFor="variantTitle" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Variantă produs</Label>
              <input id="variantTitle" className={fieldClass} value={form.variantTitle} onChange={(e) => set('variantTitle', e.target.value)} placeholder="opțional" />
            </div>
          </div>

          {form.returnType === 'REFUND' && (
            <div className="rounded-lg border border-[#D4AF37]/30 bg-[#FFFBEB] p-3 space-y-3">
              <p className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wide">Date rambursare</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="iban" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">IBAN</Label>
                  <input id="iban" className={fieldClass} value={form.iban} onChange={(e) => set('iban', e.target.value)} placeholder="RO49 RZBR..." />
                </div>
                <div>
                  <Label htmlFor="ibanHolder" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Titular cont</Label>
                  <input id="ibanHolder" className={fieldClass} value={form.ibanHolder} onChange={(e) => set('ibanHolder', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="adminNotes" className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Note admin</Label>
            <textarea id="adminNotes" className={`${fieldClass} resize-none`} value={form.adminNotes} onChange={(e) => set('adminNotes', e.target.value)} rows={2} placeholder="opțional" />
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-[#E7E5E4]">
            <Button type="button" variant="outline" onClick={onClose}>Anulează</Button>
            <Button type="submit" disabled={loading} style={{ background: '#D4AF37', color: '#1C1917', fontWeight: 600 }}>
              {loading ? 'Se salvează...' : 'Adaugă returul'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
