"use client"

const OBJECTIVES_RO: Record<string, string> = {
  OUTCOME_SALES: "Vanzari",
  OUTCOME_LEADS: "LeadGen",
  OUTCOME_TRAFFIC: "Trafic",
  OUTCOME_AWARENESS: "Awareness",
}

export function generateCampaignName(
  product: string,
  objective: string,
  audience: string,
  date: Date = new Date()
): string {
  const month = date
    .toLocaleDateString("ro-RO", { month: "short", year: "numeric" })
    .replace(" ", "")
    .replace(".", "")
  const obj = OBJECTIVES_RO[objective] ?? objective
  return `${product} - ${obj} - ${audience} - ${month}`
}

interface Props {
  value: string
  onChange: (v: string) => void
  product?: string
  objective?: string
  audience?: string
}

export function CampaignNameField({ value, onChange, product, objective, audience }: Props) {
  const suggest = () => {
    if (product && objective && audience) {
      onChange(generateCampaignName(product, objective, audience))
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm text-[#78716C]">Denumire campanie *</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: EP-2011 - Vanzari - Femei 25-45 - Mar2026"
          className="flex-1 rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] px-3 py-2 text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10"
        />
        {product && objective && audience && (
          <button
            type="button"
            onClick={suggest}
            className="whitespace-nowrap rounded-lg border border-[#E7E5E4] bg-white px-3 py-2 text-xs text-[#78716C] transition-colors hover:bg-[#F5F5F4] hover:text-[#1C1917]"
          >
            Auto-fill
          </button>
        )}
      </div>
      <p className="text-xs text-[#78716C]">Format: [Produs] - [Obiectiv] - [Audiență] - [LunăAn]</p>
    </div>
  )
}
