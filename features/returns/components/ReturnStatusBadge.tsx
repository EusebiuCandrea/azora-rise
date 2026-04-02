import type { ReturnStatus } from '../types'

const STATUS_CONFIG: Record<ReturnStatus, { bg: string; text: string; label: string }> = {
  NEW: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Nou' },
  RECEIVED: { bg: '#FEF9C3', text: '#D97706', label: 'Receptionat' },
  APPROVED: { bg: '#F3E8FF', text: '#7C3AED', label: 'Aprobat' },
  COMPLETED: { bg: '#DCFCE7', text: '#15803D', label: 'Finalizat' },
  REJECTED: { bg: '#FEF2F2', text: '#DC2626', label: 'Respins' },
}

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.NEW
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  )
}
