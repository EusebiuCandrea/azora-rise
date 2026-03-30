'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Expense {
  id: string
  category: string
  description: string
  amount: number
  currency: string
}

interface Props {
  expenses: Expense[]
  year: number
  month: number
}

const CATEGORIES = [
  { value: 'RENT', label: 'Chirie' },
  { value: 'SALARY', label: 'Salarii' },
  { value: 'COURIER', label: 'Curier' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'MARKETING_OTHER', label: 'Marketing' },
  { value: 'ACCOUNTING', label: 'Contabilitate' },
  { value: 'BANK_FEES', label: 'Bănci' },
  { value: 'OTHER', label: 'Diverse' },
]

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

export function ExpensesPanel({ expenses, year, month }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category: 'SOFTWARE',
    description: '',
    amount: '',
  })

  async function handleAdd() {
    if (!form.description || !form.amount) return
    setLoading(true)
    try {
      await fetch('/api/analytics/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          category: form.category,
          description: form.description,
          amount: parseFloat(form.amount),
        }),
      })
      setForm({ category: 'SOFTWARE', description: '', amount: '' })
      setShowForm(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/analytics/expenses/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div>
      {expenses.length === 0 && !showForm ? (
        <div className="px-5 py-8 text-center text-sm text-[#78716C]">
          <p>Nicio cheltuială manuală înregistrată.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adaugă cheltuială
          </button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[#E7E5E4]">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#78716C] bg-[#F5F5F4] px-2 py-0.5 rounded">
                    {CATEGORY_LABEL[e.category] ?? e.category}
                  </span>
                  <span className="text-sm text-[#1C1917]">{e.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#1C1917]">{e.amount.toFixed(0)} {e.currency}</span>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="p-1 text-[#78716C] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {showForm ? (
            <div className="px-5 py-4 bg-[#FAFAF9] border-t border-[#E7E5E4]">
              <div className="flex gap-3">
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="text-sm border border-[#E7E5E4] rounded-lg px-3 py-2 bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input
                  placeholder="Descriere (ex: Shopify Basic)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="flex-1 text-sm border border-[#E7E5E4] rounded-lg px-3 py-2 bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
                <input
                  type="number"
                  placeholder="Sumă RON"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-28 text-sm border border-[#E7E5E4] rounded-lg px-3 py-2 bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Salvează
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-2 border border-[#E7E5E4] text-sm text-[#78716C] hover:bg-[#F5F5F4] rounded-lg transition-colors"
                >
                  Anulează
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-3 border-t border-[#E7E5E4]">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 text-sm text-[#D4AF37] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Adaugă cheltuială
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
