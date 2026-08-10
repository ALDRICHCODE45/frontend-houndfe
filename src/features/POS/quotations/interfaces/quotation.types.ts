/**
 * Quotation (Cotización) type contracts.
 *
 * GUARDRAIL: 'CANCELLED' uses TWO L's. The sales module uses 'CANCELED' (ONE
 * L). They are two different backend contracts.
 */

import type {
  CANCEL_REASONS,
  QUOTATION_STATUS,
} from '../constants/quotation.constants'

export type QuotationStatus = (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS]
export type CancelReason = (typeof CANCEL_REASONS)[keyof typeof CANCEL_REASONS]
export type PriceSource = 'PRICE_LIST' | 'TIER_PRICE' | 'CUSTOM' | 'PROMOTION'
export type DiscountType = 'PERCENTAGE' | 'FIXED' | null

// ─── Embedded entities (used in tests, not returned by backend) ──────────────

export interface QuotationCustomer {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  /** Optional phone for the customer card. The current backend payload
   *  does NOT include phone, so the field is optional and the card
   *  gracefully omits the phone row when null/missing. */
  phone?: string | null
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

/**
 * The backend returns product/variant info as flat fields (productName,
 * variantName) — NOT nested objects. However the test suite and existing
 * code expect the nested shape too. We accept both: flat fields are
 * required (backend contract), nested objects are kept as optional for
 * backward-compatibility with tests.
 */
export interface QuotationItemResponseDto {
  id: string
  /** Optional: present when backend embeds nested product (not in current API). */
  product?: QuotationItemProduct
  /** Optional: present when backend embeds nested variant (not in current API). */
  variant?: QuotationItemVariant | null
  productId: string
  variantId: string | null
  /** Backend flat field — REQUIRED by the API. */
  productName: string
  /** Backend flat field — the display name of the variant, or null. */
  variantName: string | null
  quantity: number
  unitPriceCents: number
  priceSource: PriceSource
  discountType: DiscountType
  discountValue: number | null
  discountAmountCents: number
  discountTitle: string | null
  promotionId: string | null
  /** Kept for test backward-compat; backend doesn't return this. */
  manuallyAdjusted?: boolean
  /** Kept for test backward-compat; backend doesn't return this. */
  overrideNote?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Promotions ───────────────────────────────────────────────────────────────

export interface AppliedPromotion {
  /** Backend-assigned id (may be omitted — use promotionId as the stable key). */
  id?: string
  promotionId: string
  title: string
  discountCents: number
}

// ─── Top-level DTO ────────────────────────────────────────────────────────────

/** Compact seller reference embedded in the quotation response.
 *  Mirrors `SaleActorRef` (POS sales module) — id + display name only,
 *  no email/avatar in the wire. */
export interface QuotationSellerDto {
  id: string
  name: string
}

export interface QuotationResponseDto {
  id: string
  customerId: string | null
  customer: QuotationCustomer | null
  globalPriceListId: string | null
  priceListExplicitlySet: boolean
  status: QuotationStatus
  expiresAt: string | null
  cancelReason: CancelReason | null
  canceledAt: string | null
  subtotalCents: number
  discountCents: number
  totalCents: number
  /**
   * Backend-computed IVA rate (e.g. `0.16` for 16%). `null` when the backend
   * didn't stamp a tax (older payloads, tax-exempt line items, etc.).
   * Pairs with `taxCents` — both must be non-null for the UI to render the
   * IVA row in the RESUMEN sidebar.
   */
  taxRate: number | null
  /** Backend-computed IVA amount in cents. See `taxRate` for the null contract. */
  taxCents: number | null
  /** Free-form customer notes (max 280 chars). Edited via PATCH …/drafts/:id/notes. */
  customerNotes: string | null
  manuallyEnded: boolean
  items: QuotationItemResponseDto[]
  appliedPromotions: AppliedPromotion[]
  vetoedPromotionIds: string[]
  optedInManualPromotionIds: string[]
  /** Status with lazy EXPIRED applied server-side (DRAFT | SENT | EXPIRED | CANCELLED). */
  effectiveStatus: QuotationStatus
  /** Raw UUID of the assigned seller. May be `''` in older payloads where
   *  no seller was assigned (the backend keeps it as a string to match the
   *  wire). Paired with `seller` (resolved name) for display. */
  sellerUserId: string
  /** Resolved seller reference. `null` when `sellerUserId` is empty. */
  seller: QuotationSellerDto | null
  createdAt: string
  updatedAt: string
}

// ─── List params ──────────────────────────────────────────────────────────────

/**
 * QuotationListParams — contract for `GET /quotations` query string.
 *
 * REQ-QAF-006 widening: multi-value filters (`status`, `customerId`) accept
 * either a single value (legacy / single-select), a CSV string (server
 * normalizes both), or an array (Axios + csvParamsSerializer join by comma).
 * The backend's `@CsvEnum` / `@CsvUuid` decorators accept all three shapes.
 *
 * `expiresFrom` / `expiresTo` (ISO date strings) feed the expiry date-range.
 * `minTotalCents` / `maxTotalCents` (non-negative integers) feed the total
 * numeric-range; the FE multiplies by 100 in the UI to render currency.
 */
export interface QuotationListParams {
  page?: number
  limit?: number
  status?: QuotationStatus | QuotationStatus[] | string
  customerId?: string | string[]
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  /** ISO date string (YYYY-MM-DD or full ISO). Inclusive `gte` on `expiresAt`. */
  expiresFrom?: string
  /** ISO date string. Inclusive `lte` on `expiresAt`. */
  expiresTo?: string
  /** ISO date string. Inclusive `gte` on `createdAt` (pre-existing backend param). */
  createdFrom?: string
  /** ISO date string. Inclusive `lte` on `createdAt` (pre-existing backend param). */
  createdTo?: string
  /** Non-negative integer; inclusive `gte` on `totalCents`. */
  minTotalCents?: number
  /** Non-negative integer; inclusive `lte` on `totalCents`. */
  maxTotalCents?: number
}

// ─── Paginated envelope ───────────────────────────────────────────────────────

export interface PaginatedQuotationsPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedQuotations {
  data: QuotationResponseDto[]
  pagination: PaginatedQuotationsPagination
}
