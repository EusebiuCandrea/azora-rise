'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export function ReturnsFilters({
  currentStatus,
  currentType,
}: {
  currentStatus?: string
  currentType?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-medium text-[#78716C]">Filtrează după:</span>
      <select
        value={currentStatus ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className="text-sm px-3 py-1.5 rounded-lg bg-[#EEEEED] text-[#1C1917] border-none outline-none focus:ring-2 focus:ring-[#D4AF37]"
      >
        <option value="">Toate Statusurile</option>
        <option value="NEW">Nou</option>
        <option value="RECEIVED">Receptionat</option>
        <option value="APPROVED">Aprobat</option>
        <option value="COMPLETED">Finalizat</option>
        <option value="REJECTED">Respins</option>
      </select>
      <select
        value={currentType ?? ''}
        onChange={(e) => update('returnType', e.target.value)}
        className="text-sm px-3 py-1.5 rounded-lg bg-[#EEEEED] text-[#1C1917] border-none outline-none focus:ring-2 focus:ring-[#D4AF37]"
      >
        <option value="">Toate Tipurile</option>
        <option value="REFUND">Ramburs</option>
        <option value="EXCHANGE">Schimb</option>
      </select>
      {(currentStatus || currentType) && (
        <button
          onClick={() => router.push('?')}
          className="text-xs text-[#78716C] hover:text-[#1C1917] transition-colors"
        >
          Resetează filtrele
        </button>
      )}
    </div>
  )
}
