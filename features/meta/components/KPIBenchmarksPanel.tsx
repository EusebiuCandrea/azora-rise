"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { RO_BENCHMARKS } from "@/features/meta/knowledge-base"

interface BenchmarkRow {
  metric: string
  description: string
  formula?: string
  good: string
  ok: string
  poor: string
}

const ROWS: BenchmarkRow[] = [
  {
    metric: "ROAS",
    description: "Venit generat per RON cheltuit pe reclame",
    formula: "Venituri ÷ Cheltuieli Ads",
    good: `≥ ${RO_BENCHMARKS.roas.good}x`,
    ok: `${RO_BENCHMARKS.roas.ok}–${RO_BENCHMARKS.roas.good}x`,
    poor: `< ${RO_BENCHMARKS.roas.poor}x (pierdere)`,
  },
  {
    metric: "CTR",
    description: "Procentul de persoane care dau click pe reclamă",
    formula: "Clicks ÷ Impresii × 100",
    good: `≥ ${RO_BENCHMARKS.ctr.good}%`,
    ok: `${RO_BENCHMARKS.ctr.ok}–${RO_BENCHMARKS.ctr.good}%`,
    poor: `< ${RO_BENCHMARKS.ctr.poor}%`,
  },
  {
    metric: "CPM",
    description: "Cost per 1000 impresii (cât plătești pentru vizibilitate)",
    formula: "Cheltuieli ÷ Impresii × 1000",
    good: `< ${RO_BENCHMARKS.cpm.good} RON`,
    ok: `${RO_BENCHMARKS.cpm.good}–${RO_BENCHMARKS.cpm.ok} RON`,
    poor: `> ${RO_BENCHMARKS.cpm.poor} RON`,
  },
  {
    metric: "CPULC",
    description: "Cost per click unic pe link (cât plătești per vizitator)",
    formula: "CPATC × rata_ATC",
    good: `< ${RO_BENCHMARKS.cpulc.good} RON`,
    ok: `${RO_BENCHMARKS.cpulc.good}–${RO_BENCHMARKS.cpulc.ok} RON`,
    poor: `> ${RO_BENCHMARKS.cpulc.poor} RON`,
  },
  {
    metric: "CPATC",
    description: "Cost per adăugare în coș",
    formula: "CPP_BE × (rata_PUR ÷ rata_ATC)",
    good: `< ${RO_BENCHMARKS.cpatc.good} RON`,
    ok: `${RO_BENCHMARKS.cpatc.good}–${RO_BENCHMARKS.cpatc.ok} RON`,
    poor: `> ${RO_BENCHMARKS.cpatc.poor} RON`,
  },
  {
    metric: "CPA / CPP",
    description: "Cost per achiziție (cumpărare). Break-even = AOV − COGS − Fees",
    formula: "Cheltuieli ÷ Achiziții",
    good: `< ${RO_BENCHMARKS.cpp.good} RON`,
    ok: `${RO_BENCHMARKS.cpp.good}–${RO_BENCHMARKS.cpp.ok} RON`,
    poor: `> ${RO_BENCHMARKS.cpp.poor} RON`,
  },
  {
    metric: "Frequency",
    description: "De câte ori a văzut aceeași persoană reclama ta",
    formula: "Impresii ÷ Reach",
    good: `< ${RO_BENCHMARKS.frequency.safe}`,
    ok: `${RO_BENCHMARKS.frequency.safe}–${RO_BENCHMARKS.frequency.warning}`,
    poor: `> ${RO_BENCHMARKS.frequency.danger} (oboseală audiență)`,
  },
  {
    metric: "Hook Rate",
    description: "Procentul care trece de primele 25% din video (primele ~3s)",
    formula: "VideoP25 ÷ VideoPlays",
    good: `≥ ${RO_BENCHMARKS.hookRate.good * 100}%`,
    ok: `${RO_BENCHMARKS.hookRate.ok * 100}–${RO_BENCHMARKS.hookRate.good * 100}%`,
    poor: `< ${RO_BENCHMARKS.hookRate.poor * 100}%`,
  },
  {
    metric: "LPV Rate",
    description: "Câți din cei care dau click ajung efectiv pe site",
    formula: "LandingPageViews ÷ Clicks",
    good: `≥ ${RO_BENCHMARKS.landingPageViewRate.good * 100}%`,
    ok: `${RO_BENCHMARKS.landingPageViewRate.ok * 100}–${RO_BENCHMARKS.landingPageViewRate.good * 100}%`,
    poor: `< ${RO_BENCHMARKS.landingPageViewRate.poor * 100}% (URL/pagina lentă)`,
  },
  {
    metric: "ATC Rate",
    description: "Câți vizitatori adaugă în coș (calitatea paginii produsului)",
    formula: "AddToCart ÷ LandingPageViews",
    good: `≥ ${RO_BENCHMARKS.addToCartRate.good * 100}%`,
    ok: `${RO_BENCHMARKS.addToCartRate.ok * 100}–${RO_BENCHMARKS.addToCartRate.good * 100}%`,
    poor: `< ${RO_BENCHMARKS.addToCartRate.poor * 100}%`,
  },
]

export function KPIBenchmarksPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[#E7E5E4] bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#78716C]" />
          <span className="text-sm font-semibold text-[#1C1917]">Benchmarkuri KPI folosite în analiza AI</span>
          <span className="text-xs text-[#A8A29E]">· Blueprint Supreme Ecom + AC Hampton + piața RO</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[#78716C]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#78716C]" />
        )}
      </button>

      {open && (
        <div className="border-t border-[#E7E5E4]">
          {/* Formula BE ROAS */}
          <div className="px-5 py-4 bg-[#FFFBEB] border-b border-[#FDE68A]">
            <p className="text-xs font-semibold text-[#92400E] uppercase tracking-wide mb-2">Formula Break-Even ROAS (din Blueprint Supreme Ecom KPI Sheet)</p>
            <div className="grid gap-1 text-xs text-[#78716C] font-mono">
              <p><span className="text-[#1C1917] font-semibold">BE ROAS</span> = AOV ÷ (AOV − COGS − Fees%)</p>
              <p><span className="text-[#1C1917] font-semibold">CPP BE</span> = AOV − COGS − Fees%</p>
              <p><span className="text-[#1C1917] font-semibold">CPATC</span> = CPP_BE × (rata_cumpărare ÷ rata_ATC)</p>
              <p><span className="text-[#1C1917] font-semibold">CPULC</span> = CPATC × rata_ATC</p>
              <p><span className="text-[#1C1917] font-semibold">Marginal Ratio</span> = AOV ÷ COGS ≥ 2.5x (validare produs)</p>
              <p><span className="text-[#1C1917] font-semibold">Profit zilnic</span> = Venituri − Cheltuieli Ads − COGS</p>
            </div>
            <p className="mt-2 text-xs text-[#A16207]">
              Exemplu Azora (produs 250 RON, COGS 80 RON, fees 1%): BE ROAS = 1.49x · CPP BE = 167.5 RON · Target 20% profit → ROAS ≥ 2.1x
            </p>
          </div>

          {/* Tabel benchmarkuri */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E7E5E4] bg-[#F5F5F4] text-[10px] uppercase tracking-wide text-[#78716C]">
                  <th className="px-4 py-2.5 text-left">Metric</th>
                  <th className="px-4 py-2.5 text-left">Descriere</th>
                  <th className="px-4 py-2.5 text-left">Formula</th>
                  <th className="px-4 py-2.5 text-center text-[#166534]">Bun</th>
                  <th className="px-4 py-2.5 text-center text-[#92400E]">OK</th>
                  <th className="px-4 py-2.5 text-center text-[#DC2626]">Slab</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-[#E7E5E4] hover:bg-[#FAFAF9]">
                    <td className="px-4 py-2.5 font-semibold text-[#1C1917] whitespace-nowrap">{row.metric}</td>
                    <td className="px-4 py-2.5 text-[#57534E] max-w-[200px]">{row.description}</td>
                    <td className="px-4 py-2.5 font-mono text-[#78716C] whitespace-nowrap">{row.formula ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center font-medium text-[#166534] whitespace-nowrap">{row.good}</td>
                    <td className="px-4 py-2.5 text-center text-[#92400E] whitespace-nowrap">{row.ok}</td>
                    <td className="px-4 py-2.5 text-center text-[#DC2626] whitespace-nowrap">{row.poor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reguli decizie */}
          <div className="px-5 py-4 border-t border-[#E7E5E4] bg-[#FAFAF9]">
            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Reguli de decizie (Break-Even Ladder)</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-[#57534E]">
              <p>Cheltuieli minime înainte de decizie: <span className="font-semibold text-[#1C1917]">{RO_BENCHMARKS.minSpendBeforeDecision} RON</span></p>
              <p>Zile minime înainte de decizie: <span className="font-semibold text-[#1C1917]">{RO_BENCHMARKS.minDaysBeforeDecision} zile</span></p>
              <p>Cheltuieli maxime fără rezultate (kill): <span className="font-semibold text-[#1C1917]">{RO_BENCHMARKS.minSpendForKill} RON</span></p>
              <p>Zile maxime fără rezultate (kill): <span className="font-semibold text-[#1C1917]">{RO_BENCHMARKS.minDaysForKill} zile</span></p>
              <p>Mărire buget maximă per pas: <span className="font-semibold text-[#1C1917]">{RO_BENCHMARKS.maxBudgetIncreasePercent}%</span></p>
              <p>Interval minim între modificări buget: <span className="font-semibold text-[#1C1917]">{RO_BENCHMARKS.minDaysBetweenBudgetChanges} zile</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
