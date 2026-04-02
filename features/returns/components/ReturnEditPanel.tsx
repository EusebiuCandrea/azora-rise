'use client'
import { useState } from 'react'
import { useToast } from '@/components/ui/Toaster'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { ReturnStatus } from '@prisma/client'

const STATUS_LABELS: Record<ReturnStatus, string> = {
  NEW: 'Nou',
  RECEIVED: 'Receptionat',
  APPROVED: 'Aprobat',
  COMPLETED: 'Finalizat',
  REJECTED: 'Respins',
}

interface Props {
  returnId: string
  initial: {
    awbNumber: string | null
    iban: string | null
    ibanHolder: string | null
    adminNotes: string | null
    status: ReturnStatus
    returnType: 'REFUND' | 'EXCHANGE'
  }
}

export function ReturnEditPanel({ returnId, initial }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    awbNumber: initial.awbNumber ?? '',
    iban: initial.iban ?? '',
    ibanHolder: initial.ibanHolder ?? '',
    adminNotes: initial.adminNotes ?? '',
    status: initial.status,
  })
  const [saving, setSaving] = useState(false)

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awbNumber: form.awbNumber || null,
          iban: form.iban || null,
          ibanHolder: form.ibanHolder || null,
          adminNotes: form.adminNotes || null,
          status: form.status,
        }),
      })
      if (!res.ok) throw new Error('Eroare la salvare')
      toast({ type: 'success', title: 'Salvat', description: 'Modificările au fost salvate.' })
    } catch {
      toast({ type: 'error', title: 'Eroare', description: 'Nu s-au putut salva modificările.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 space-y-4">
      <h2 className="text-base font-semibold text-[#1C1917]">Procesare Administrativă</h2>

      <div>
        <Label className="text-xs uppercase tracking-wide text-[#78716C] font-semibold">Status retur</Label>
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          className="mt-1 w-full text-sm px-3 py-2.5 rounded-lg bg-[#EEEEED] text-[#1C1917] border-none outline-none focus:ring-2 focus:ring-[#D4AF37]"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-[#78716C] font-semibold">AWB retur</Label>
        <Input
          value={form.awbNumber}
          onChange={(e) => set('awbNumber', e.target.value)}
          placeholder="Ex: FAN2938102391"
          className="mt-1 bg-[#EEEEED] border-none focus-visible:ring-[#D4AF37]"
        />
      </div>

      {initial.returnType === 'REFUND' && (
        <div className="space-y-3 pt-1">
          <p className="text-xs uppercase tracking-wide font-semibold text-[#D4AF37]">Date rambursare</p>
          <div>
            <Label className="text-xs uppercase tracking-wide text-[#78716C] font-semibold">IBAN</Label>
            <Input
              value={form.iban}
              onChange={(e) => set('iban', e.target.value)}
              placeholder="RO49 RZBR..."
              className="mt-1 bg-[#EEEEED] border-none focus-visible:ring-[#D4AF37]"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-[#78716C] font-semibold">Titular cont</Label>
            <Input
              value={form.ibanHolder}
              onChange={(e) => set('ibanHolder', e.target.value)}
              className="mt-1 bg-[#EEEEED] border-none focus-visible:ring-[#D4AF37]"
            />
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs uppercase tracking-wide text-[#78716C] font-semibold">Note admin</Label>
        <Textarea
          value={form.adminNotes}
          onChange={(e) => set('adminNotes', e.target.value)}
          placeholder="Adaugă observații interne..."
          rows={3}
          className="mt-1 bg-[#EEEEED] border-none focus-visible:ring-[#D4AF37] resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors"
        style={{ background: '#735c00', color: '#ffffff' }}
      >
        {saving ? 'Se salvează...' : 'Salvează modificările'}
      </button>
    </div>
  )
}
