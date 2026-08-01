/**
 * Quotation (Cotización) type contracts.
 *
 * Single source of truth for the DTOs the backend returns + the params we
 * send. Mirrors the contract documented in
 * `houndfe-backend/docs/quotations-frontend.md §4` (response shapes).
 *
 * GUARDRAIL: 'CANCELLED' uses TWO L's. The sales module uses 'CANCELED' (ONE
 * L). They are two different backend contracts — sharing one constant across
 * modules would silently break one of them.
 */

import type {
  CANCEL_REASONS,
  QUOTATION_STATUS,
} from '../constants/quotation.constants'

// ─── Status & enum unions (derived from value objects) ────────────────────────

/** Lifecycle: DRAFT → SENT → (EXPIRED lazily) | CANCELLED. */
export type QuotationStatus = (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS]

/** Required body of POST /quotations/drafts/:id/cancel. */
export type CancelReason = (typeof CANCEL_REASONS)[keyof typeof CANCEL_REASONS]

/** Per-line pricing provenance (backend §4 QuotationItemResponseDto). */
export type PriceSource = 'PRICE_LIST' | 'TIER_PRICE' | 'CUSTOM' | 'PROMOTION'

/** Line discount shape (nullable when no discount applied). */
export type DiscountType = 'PERCENTAGE' | 'FIXED' | null

// ─── Embedded entities ────────────────────────────────────────────────────────

export interface QuotationCustomer {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
}

export interface QuotationItemProduct {
  id: string
  name: string
  sku: string
  imageUrl: string | null
}

export interface QuotationItemVariant {
  id: string
  name: string
  sku: string
}

// ─── Line item ────────────────────────────────────────────────────────────────

export interface QuotationItemResponseDto {
  id: string
  productId: string
  variantId: string | null
  quantity: number
  product: QuotationItemProduct
  variant: QuotationItemVariant | null
  unitPriceCents: number
  priceSource: PriceSource
  discountType: DiscountType
  discountValue: number | null
  discountAmountCents: number
  discountTitle: string | null
  promotionId: string | null
  manuallyAdjusted: boolean
  overrideNote: string | null
  createdAt: string
  updatedAt: string
}

// ─── Promotions ───────────────────────────────────────────────────────────────

export interface AppliedPromotion {
  id: string
  promotionId: string
  title: string
  discountCents: number
}

// ─── Top-level DTO ────────────────────────────────────────────────────────────

export interface QuotationResponseDto {
  id: string
  customerId: string | null
  customer: QuotationCustomer | null
  globalPriceListId: string | null
  /** True when the cashier explicitly chose a price list. Backend preserves
   *  it across customer reassignments (see backend §3.5). */
  priceListExplicitlySet: boolean
  status: QuotationStatus
  /** ISO 8601, or null = never expires. */
  expiresAt: string | null
  cancelReason: CancelReason | null
  canceledAt: string | null
  subtotalCents: number
  discountCents: number
  totalCents: number
  /** Internal flag — always false for quotations (no sale conversion yet). */
  manuallyEnded: boolean
  items: QuotationItemResponseDto[]
  appliedPromotions: AppliedPromotion[]
  vetoedPromotionIds: string[]
  optedInManualPromotionIds: string[]
  createdAt: string
  updatedAt: string
}

// ─── List params ──────────────────────────────────────────────────────────────

export interface QuotationListParams {
  page?: number
  limit?: number
  status?: QuotationStatus
  customerId?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ─── Paginated envelope ───────────────────────────────────────────────────────

export interface PaginatedQuotationsMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedQuotations {
  data: QuotationResponseDto[]
  meta: PaginatedQuotationsMeta
}