import type { ReturnStatus, ReturnType } from '@prisma/client'

export type { ReturnStatus, ReturnType }

export interface ReturnRecord {
  id: string
  organizationId: string
  orderId: string | null
  shopifyOrderId: string
  orderNumber: string
  customerName: string
  customerEmail: string | null
  returnType: ReturnType
  productTitle: string
  variantTitle: string | null
  sku: string | null
  reason: string
  awbNumber: string | null
  iban: string | null
  ibanHolder: string | null
  status: ReturnStatus
  adminNotes: string | null
  createdAt: string | Date
  updatedAt: string | Date
  order?: { id: string; orderNumber: number } | null
}

export interface ReturnsListResponse {
  returns: ReturnRecord[]
  total: number
  page: number
  totalPages: number
  stats: {
    total: number
    new: number
    received: number
    completed: number
  }
}
