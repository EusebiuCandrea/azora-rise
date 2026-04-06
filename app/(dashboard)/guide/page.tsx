import { BookOpen } from "lucide-react"
import { GuideClient } from "./GuideClient"

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#E7E5E4] px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FDF8E7] border border-[#D4AF37]/30 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#D4AF37]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1C1917]">Manual de utilizare</h1>
            <p className="text-xs text-[#78716C]">Ghid complet Rise · Azora — toate funcționalitățile explicate</p>
          </div>
        </div>
      </div>

      <GuideClient />
    </div>
  )
}
