/**
 * «Pedidos por reposición» (ODD restock-backorder T1, S3-S5). Types exactly per the contract
 * (backend docs/proposals/restock-backorder-contract.md §6.5 and §9): `BackorderStaff` is
 * `BackorderBot` plus the staff fields. Timestamps are ISO 8601 with offset; money is in cents.
 */

/** Contract §1 states. CONFIRMED, EXPIRED and CANCELLED are terminal. */
export type BackorderStatus = 'WAITING' | 'RESERVED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'

/** Status of the linked sale (L4: SaleStatus, one L in CANCELED). */
export type BackorderSaleStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELED'

export type BackorderCancelledByKind = 'STAFF' | 'CUSTOMER'

/** §6.5 — what the bot sees. */
export interface BackorderBot {
  id: string
  /** `BO-000012` */
  folio: string
  status: BackorderStatus
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  quantity: number
  referencePriceCents: number
  currentPriceCents: number
  finalPriceCents: number
  scheduledAt: string
  estimatedAt: string
  estimatedArrivalDays: number
  reservedAt: string | null
  reservedUntil: string | null
  reminderAt: string | null
  /** 1-based; only while WAITING. */
  queuePosition: number | null
  saleId: string | null
  cancelledByKind: BackorderCancelledByKind | null
  cancelReason: string | null
  branchName: string
  customerFirstName: string
}

export interface BackorderCustomer {
  id: string
  name: string
  phone: string
}

export interface BackorderCancelledBy {
  id: string
  name: string
}

/** §9.1 — `GET /backorders` item and `GET /backorders/:id`. */
export interface BackorderStaff extends BackorderBot {
  /** Optimistic-lock version, sent back on cancel. */
  version: number
  customer: BackorderCustomer
  origin: 'CHATBOT'
  chatbotRequestId: string
  productImageUrl: string | null
  priceListId: string | null
  confirmedAt: string | null
  cancelledAt: string | null
  expiredAt: string | null
  cancelledBy: BackorderCancelledBy | null
  saleStatus: BackorderSaleStatus | null
  /** The estimated arrival has passed and the stock has not arrived. */
  etaOverdue: boolean
  /** POS flag: a WAITING head that keeps being passed over (Q1). */
  passedOverCount: number
}

export type BackorderSortBy = 'scheduledAt' | 'status' | 'reservedUntil'
export type BackorderSortOrder = 'asc' | 'desc'

export interface BackorderListParams {
  page?: number
  limit?: number
  /** Sent as a comma list. */
  status?: BackorderStatus[]
  productId?: string
  variantId?: string
  customerId?: string
  /** Customer name/phone or product/variant name. */
  q?: string
  /** `scheduledAt` range, ISO with zone. */
  from?: string
  to?: string
  sortBy?: BackorderSortBy
  sortOrder?: BackorderSortOrder
}

/** Counts honour every filter except `status`. */
export type BackorderCounts = Record<BackorderStatus, number>

export interface BackorderListResponse {
  items: BackorderStaff[]
  page: number
  limit: number
  total: number
  counts: BackorderCounts
}

/** `POST /backorders/:id/cancel` body; `reason` ≤ 280. */
export interface CancelBackorderBody {
  reason?: string
  version: number
}

export const BACKORDER_REASON_MAX = 280
