'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/Toaster'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function AddReturnDialog({ open, onClose, onCreated }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    orderNumber: '',
    shopifyOrderId: '',
    customerName: '',
    customerEmail: '',
    returnType: 'REFUND' as 'REFUND' | 'EXCHANGE',
    productTitle: '',
    variantTitle: '',
    reason: '',
    awbNumber: '',
    iban: '',
    ibanHolder: '',
    adminNotes: '',
  })

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="orderNumber">Nr. comandă *</Label>
              <Input id="orderNumber" value={form.orderNumber} onChange={(e) => set('orderNumber', e.target.value)} required placeholder="#1023" />
            </div>
            <div>
              <Label htmlFor="shopifyOrderId">Shopify Order ID *</Label>
              <Input id="shopifyOrderId" value={form.shopifyOrderId} onChange={(e) => set('shopifyOrderId', e.target.value)} required placeholder="gid://shopify/Order/..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="customerName">Nume client *</Label>
              <Input id="customerName" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="customerEmail">Email client</Label>
              <Input id="customerEmail" type="email" value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} placeholder="opțional" />
            </div>
          </div>
          <div>
            <Label>Tip retur *</Label>
            <div className="flex gap-4 mt-1">
              {(['REFUND', 'EXCHANGE'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="returnType" value={t} checked={form.returnType === t} onChange={() => set('returnType', t)} />
                  <span className="text-sm">{t === 'REFUND' ? 'Ramburs bani' : 'Schimb produs'}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="productTitle">Produs *</Label>
            <Input id="productTitle" value={form.productTitle} onChange={(e) => set('productTitle', e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="reason">Motiv *</Label>
            <Textarea id="reason" value={form.reason} onChange={(e) => set('reason', e.target.value)} required rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="awbNumber">AWB colet</Label>
              <Input id="awbNumber" value={form.awbNumber} onChange={(e) => set('awbNumber', e.target.value)} placeholder="opțional" />
            </div>
            <div>
              <Label htmlFor="variantTitle">Variantă produs</Label>
              <Input id="variantTitle" value={form.variantTitle} onChange={(e) => set('variantTitle', e.target.value)} placeholder="opțional" />
            </div>
          </div>
          {form.returnType === 'REFUND' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" value={form.iban} onChange={(e) => set('iban', e.target.value)} placeholder="RO..." />
              </div>
              <div>
                <Label htmlFor="ibanHolder">Titular cont</Label>
                <Input id="ibanHolder" value={form.ibanHolder} onChange={(e) => set('ibanHolder', e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="adminNotes">Note admin</Label>
            <Textarea id="adminNotes" value={form.adminNotes} onChange={(e) => set('adminNotes', e.target.value)} rows={2} placeholder="opțional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Anulează</Button>
            <Button type="submit" disabled={loading} style={{ background: '#D4AF37', color: '#1C1917' }}>
              {loading ? 'Se salvează...' : 'Adaugă returul'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
