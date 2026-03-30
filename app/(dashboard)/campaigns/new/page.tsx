"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertCircle, Check } from "lucide-react"
import { CampaignNameField, generateCampaignName } from "@/features/meta/components/CampaignNameTemplate"

const OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "Vânzări", desc: "Maximizează achizițiile în magazin" },
  { value: "OUTCOME_LEADS", label: "Lead Generation", desc: "Colectează date de contact" },
  { value: "OUTCOME_TRAFFIC", label: "Trafic", desc: "Aduce vizitatori pe site" },
  { value: "OUTCOME_AWARENESS", label: "Awareness", desc: "Crește vizibilitatea brandului" },
]

const STEPS = [
  { id: 1, label: "Informații de bază" },
  { id: 2, label: "Review" },
  { id: 3, label: "Confirmare" },
]

export default function NewCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [objective, setObjective] = useState("OUTCOME_SALES")
  const [product, setProduct] = useState("")
  const [audience, setAudience] = useState("")
  const [dailyBudget, setDailyBudget] = useState("50")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/meta/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          objective,
          dailyBudget: parseFloat(dailyBudget),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Eroare necunoscută")
      router.push(`/campaigns/${data.campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare")
      setLoading(false)
    }
  }

  const generatedPreview = generateCampaignName(product || "Produs", objective, audience || "Audienta")

  return (
    <div className="max-w-[1180px] space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/campaigns"
          className="rounded-lg p-2 text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Campanie nouă</h1>
          <p className="mt-1 text-sm text-[#78716C]">Configurează campania într-un flux simplu, clar și ușor de revizuit.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E7E5E4] bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {STEPS.map((current, index) => (
            <div key={current.id} className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  current.id < step
                    ? "border-[#D4AF37] bg-[#D4AF37] text-[#1C1917]"
                    : current.id === step
                      ? "border-[#D4AF37] bg-[#FFFBEB] text-[#B8971F]"
                      : "border-[#E7E5E4] bg-[#F5F5F4] text-[#78716C]"
                }`}
              >
                {current.id < step ? <Check className="h-4 w-4" /> : current.id}
              </div>
              <div>
                <p className={`text-sm font-medium ${current.id === step ? "text-[#1C1917]" : "text-[#78716C]"}`}>
                  Pasul {current.id}
                </p>
                <p className="text-xs text-[#78716C]">{current.label}</p>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-px w-10 ${current.id < step ? "bg-[#D4AF37]" : "bg-[#E7E5E4]"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-[#78716C]">Produs (opțional)</label>
                <input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="EP-2011"
                  className="w-full rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] px-3 py-2 text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#78716C]">Audiență (opțional)</label>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Femei 25-45"
                  className="w-full rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] px-3 py-2 text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10"
                />
              </div>
            </div>

            <CampaignNameField
              value={name}
              onChange={setName}
              product={product}
              objective={objective}
              audience={audience}
            />

            <div>
              <label className="mb-2 block text-sm text-[#78716C]">Obiectiv *</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {OBJECTIVES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setObjective(item.value)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      objective === item.value
                        ? "border-[#D4AF37] bg-[#FFFBEB] shadow-sm"
                        : "border-[#E7E5E4] bg-white hover:border-[#D4AF37]/40 hover:bg-[#FAFAF9]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#1C1917]">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#78716C]">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-[#78716C]">Buget zilnic (RON) *</label>
              <input
                type="number"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                min="5"
                step="5"
                className="w-full rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10"
              />
              <p className="mt-1 text-xs text-[#78716C]">Recomandat: 20-50 RON pentru testing, 50-100 RON pentru validare</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-[#78716C]">Data start (opțional)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#78716C]">Data end (opțional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!name || !objective || !dailyBudget}
                className="flex h-9 items-center gap-2 rounded-lg bg-[#D4AF37] px-5 text-sm font-semibold text-[#1C1917] transition-colors hover:bg-[#B8971F] disabled:opacity-50"
              >
                Continuă →
              </button>
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8971F]">Preview</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1C1917]">Consistență cu restul platformei</h2>
              <p className="mt-2 text-sm leading-6 text-[#78716C]">
                Folosim aceleași suprafețe luminoase, accent auriu și aceeași ierarhie vizuală ca în dashboard și produse.
              </p>
            </div>

            <div className="rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#78716C]">Nume generat</p>
              <p className="mt-2 break-words text-sm font-medium text-[#1C1917]">{name || generatedPreview}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-[#F5F5F4] px-3 py-2">
                <span className="text-[#78716C]">Obiectiv</span>
                <span className="font-medium text-[#1C1917]">{OBJECTIVES.find((item) => item.value === objective)?.label}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#F5F5F4] px-3 py-2">
                <span className="text-[#78716C]">Buget</span>
                <span className="font-medium text-[#1C1917]">{dailyBudget || "0"} RON/zi</span>
              </div>
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-3 text-xs leading-5 text-[#92690A]">
                Campania va fi creată inițial în status <span className="font-semibold text-[#A16207]">PAUZAT</span>, pentru a putea adăuga ad set-uri și reclame în siguranță.
              </div>
            </div>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1C1917]">Review campanie</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#E7E5E4] py-2">
              <span className="text-[#78716C]">Denumire</span>
              <span className="font-medium text-[#1C1917]">{name}</span>
            </div>
            <div className="flex justify-between border-b border-[#E7E5E4] py-2">
              <span className="text-[#78716C]">Obiectiv</span>
              <span className="text-[#1C1917]">{OBJECTIVES.find((item) => item.value === objective)?.label}</span>
            </div>
            <div className="flex justify-between border-b border-[#E7E5E4] py-2">
              <span className="text-[#78716C]">Buget zilnic</span>
              <span className="text-[#1C1917]">{dailyBudget} RON/zi</span>
            </div>
            {startDate && (
              <div className="flex justify-between border-b border-[#E7E5E4] py-2">
                <span className="text-[#78716C]">Data start</span>
                <span className="text-[#1C1917]">{startDate}</span>
              </div>
            )}
            {endDate && (
              <div className="flex justify-between border-b border-[#E7E5E4] py-2">
                <span className="text-[#78716C]">Data end</span>
                <span className="text-[#1C1917]">{endDate}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#D97706]">
            <p className="font-medium">Campania va fi creată PAUZATĂ</p>
            <p className="mt-1 text-[#92690A]">O vei activa manual din Meta Ads Manager după ce adaugi ad sets și creative-uri.</p>
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="h-9 rounded-lg border border-[#E7E5E4] px-4 text-sm text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917]"
            >
              ← Înapoi
            </button>
            <button
              onClick={() => setStep(3)}
              className="h-9 rounded-lg bg-[#D4AF37] px-5 text-sm font-semibold text-[#1C1917] transition-colors hover:bg-[#B8971F]"
            >
              Confirmă →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1C1917]">Creează campania în Meta</h2>
          <p className="text-sm text-[#78716C]">
            Campania <strong className="text-[#1C1917]">{name}</strong> va fi creată în contul tău Meta cu status <strong className="text-[#D97706]">PAUZAT</strong>.
          </p>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-[#DC2626]">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="h-9 rounded-lg border border-[#E7E5E4] px-4 text-sm text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917] disabled:opacity-50"
            >
              ← Înapoi
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="h-9 rounded-lg bg-[#D4AF37] px-5 text-sm font-semibold text-[#1C1917] transition-colors hover:bg-[#B8971F] disabled:opacity-50"
            >
              {loading ? "Se creează..." : "Creează campanie în Meta"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
