import { requireAuth, getCurrentOrgId } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ReturnStatusBadge } from '@/features/returns/components/ReturnStatusBadge'
import { ReturnEditPanel } from '@/features/returns/components/ReturnEditPanel'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAuth()
  const orgId = await getCurrentOrgId(session)
  if (!orgId) return null

  const { id } = await params

  const returnRecord = await db.return.findFirst({
    where: { id, organizationId: orgId },
    include: { order: { select: { id: true, orderNumber: true } } },
  })

  if (!returnRecord) notFound()

  const createdAt = new Intl.DateTimeFormat('ro', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(returnRecord.createdAt))

  return (
    <div className="max-w-[1200px] space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#78716C]">
        <Link
          href="/returns"
          className="flex items-center gap-1 hover:text-[#1C1917] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Retururi
        </Link>
        <span>/</span>
        <span className="text-[#D4AF37] font-medium">#{returnRecord.orderNumber}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1C1917]">Detalii Retur</h1>
          <p className="text-sm text-[#78716C] mt-0.5">Înregistrat la {createdAt}</p>
        </div>
        <ReturnStatusBadge status={returnRecord.status} />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: info (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1C1917]">Informații Solicitare</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#78716C] font-semibold mb-1">
                  Comandă originală
                </p>
                {returnRecord.order ? (
                  <Link
                    href={`/orders/${returnRecord.order.id}`}
                    className="text-sm font-medium text-[#D4AF37] hover:underline flex items-center gap-1"
                  >
                    #{returnRecord.order.orderNumber}
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-[#1C1917]">
                    #{returnRecord.orderNumber}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#78716C] font-semibold mb-1">
                  Data depunerii
                </p>
                <p className="text-sm text-[#1C1917]">{createdAt}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-[#FAFAF9] rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-[#78716C] font-semibold mb-2">
                  Client
                </p>
                <p className="text-sm font-semibold text-[#1C1917]">{returnRecord.customerName}</p>
                {returnRecord.customerEmail && (
                  <p className="text-xs text-[#78716C] mt-0.5">{returnRecord.customerEmail}</p>
                )}
              </div>
              <div className="bg-[#FAFAF9] rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-[#78716C] font-semibold mb-2">
                  Produs returnat
                </p>
                <p className="text-sm font-semibold text-[#1C1917]">{returnRecord.productTitle}</p>
                {returnRecord.variantTitle && (
                  <p className="text-xs text-[#78716C] mt-0.5">{returnRecord.variantTitle}</p>
                )}
                {returnRecord.sku && (
                  <p className="text-xs text-[#78716C]">SKU: {returnRecord.sku}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#78716C] font-semibold mb-1">
                  Motiv retur
                </p>
                <p className="text-sm text-[#1C1917]">{returnRecord.reason}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#78716C] font-semibold mb-1">
                  Metodă rambursare
                </p>
                <p className="text-sm text-[#1C1917]">
                  {returnRecord.returnType === 'REFUND'
                    ? 'Ramburs (Cont Bancar)'
                    : 'Schimb produs'}
                </p>
              </div>
            </div>

            {returnRecord.awbNumber && (
              <div>
                <p className="text-xs uppercase tracking-wide text-[#78716C] font-semibold mb-1">
                  AWB colet trimis
                </p>
                <p className="text-sm font-mono text-[#1C1917]">{returnRecord.awbNumber}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: edit panel (1/3) */}
        <div className="lg:col-span-1">
          <ReturnEditPanel
            returnId={returnRecord.id}
            initial={{
              awbNumber: returnRecord.awbNumber,
              iban: returnRecord.iban,
              ibanHolder: returnRecord.ibanHolder,
              adminNotes: returnRecord.adminNotes,
              status: returnRecord.status,
              returnType: returnRecord.returnType,
            }}
          />
        </div>
      </div>
    </div>
  )
}
