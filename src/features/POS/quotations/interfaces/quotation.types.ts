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
import type { Sale } from '@/features/POS/sales/interfaces/sale.types'
import type { SuppressedPromotion } from '@/features/POS/sales/composables/useSuppressedPromotions'

export type { SuppressedPromotion }

export type QuotationStatus = (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS]
export type CancelReason = (typeof CANCEL_REASONS)[keyof typeof CANCEL_REASONS]
export type PriceSource = 'PRICE_LIST' | 'TIER_PRICE' | 'CUSTOM' | 'PROMOTION'
export type DiscountType = 'PERCENTAGE' | 'FIXED' | null
/** Status of the sale a quotation became (sales contract: CANCELED with ONE L). */
export type QuotationSaleStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELED'

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

/** IVA classification of a quotation line's fiscal snapshot (docs/quotations-frontend.md §3.18).
 *  `NOT_TAXABLE` = product with `chargeProductTaxes = false`. */
export type IvaClassification = 'IVA_16' | 'IVA_8' | 'IVA_0' | 'IVA_EXENTO' | 'NOT_TAXABLE'

export interface IvaBreakdownLine {
  classification: IvaClassification
  /** Integer cents, `>= 0` (may be `0`, e.g. `IVA_0`). */
  amountCents: number
}

/** Compact seller reference embedded in the quotation response.
 *  Mirrors `SaleActorRef` (POS sales module) — id + display name only,
 *  no email/avatar in the wire. */
interface QuotationSellerDto {
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
   * docs/quotations-frontend.md §3.18: IVA included per classification (only those present, in
   * backend order). `[]` = show no IVA (no items, or an old quotation without fiscal snapshots).
   * Optional only so fixtures from before the field existed still type-check. The legacy
   * `taxRate`/`taxCents` are no longer on the wire.
   */
  ivaBreakdown?: IvaBreakdownLine[]
  /** Free-form customer notes (max 280 chars). Edited via PATCH …/drafts/:id/notes. */
  customerNotes: string | null
  manuallyEnded: boolean
  items: QuotationItemResponseDto[]
  appliedPromotions: AppliedPromotion[]
  vetoedPromotionIds: string[]
  optedInManualPromotionIds: string[]
  /** Status with lazy EXPIRED applied server-side (DRAFT | SENT | EXPIRED | CANCELLED |
   *  CONVERTED_TO_SALE — the lazy expiry never turns a converted quotation into EXPIRED). */
  effectiveStatus: QuotationStatus
  /** Raw UUID of the assigned seller. May be `''` in older payloads where
   *  no seller was assigned (the backend keeps it as a string to match the
   *  wire). Paired with `seller` (resolved name) for display. */
  sellerUserId: string
  /** Resolved seller reference. `null` when `sellerUserId` is empty. */
  seller: QuotationSellerDto | null
  /**
   * Handoff 23 §3: the POS sale draft this quotation became. `null` when not converted, or when
   * that draft was later deleted (status stays CONVERTED_TO_SALE and it can be converted again).
   * Optional only so payloads/fixtures from before the field existed still type-check.
   */
  saleId?: string | null
  /** Handoff 23 §3: ISO timestamp of the conversion; `null` when never converted. */
  convertedAt?: string | null
  /**
   * Handoff 23 §3: live status of the linked sale (`null` = no link, or the sale was deleted).
   * Drives «Ver venta»: DRAFT → the POS draft (only its converter has it), CONFIRMED/CANCELED →
   * sale detail, null → no link. Optional only for payloads from before the field existed.
   */
  saleStatus?: QuotationSaleStatus | null
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
  sortBy?: 'createdAt' | 'updatedAt' | 'totalCents' | 'expiresAt'
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

interface PaginatedQuotationsPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedQuotations {
  data: QuotationResponseDto[]
  pagination: PaginatedQuotationsPagination
}

// ─── Quotation ↔ sale conversion (backend handoff 23) ────────────────────────

/** What a quotation cannot carry over from the sale draft. `UNKNOWN` = a kind this FE does not know yet. */
export type DroppedAdjustmentKind = 'ORDER_PROMOTION' | 'LINE_PROMOTION' | 'REWARD_PROMOTION' | 'UNKNOWN'

/** One discount the customer no longer gets on the quotation; `discountCents` is what they stop saving. */
export interface DroppedAdjustment {
  kind: DroppedAdjustmentKind
  saleItemId: string | null
  productId: string | null
  variantId: string | null
  promotionId: string | null
  title: string
  discountCents: number
}

/** Body of POST /quotations/from-sale/:saleId. `customerNotes` ≤ 280 chars (backend 400 otherwise). */
export interface CreateQuotationFromSalePayload {
  customerNotes?: string | null
}

/** 201 of POST /quotations/from-sale/:saleId: the sale draft `discardedSaleId` no longer exists. */
export interface CreateQuotationFromSaleResponse {
  quotation: QuotationResponseDto
  discardedSaleId: string
  droppedAdjustments: DroppedAdjustment[]
}

/** 201 of POST /quotations/:id/convert-to-sale: open the POS with `sale.id`. */
export interface ConvertQuotationToSaleResponse {
  quotation: QuotationResponseDto
  /** POS draft (same shape as GET /sales/drafts) with `quotationId` set. */
  sale: Sale
  /** Automatic promotions active today, vetoed on the new sale to keep the exact quoted total
   *  (`[]` when none). GET /sales/drafts does not expose vetoes: keep this list. */
  suppressedPromotions: SuppressedPromotion[]
}

/** Why a line cannot become a sale line. `UNKNOWN` = a reason this FE does not know yet. */
export type UnavailableLineReason =
  | 'PRODUCT_NOT_FOUND'
  | 'VARIANT_NOT_FOUND'
  | 'PRODUCT_NOT_SELLABLE'
  | 'INSUFFICIENT_STOCK'
  | 'UNKNOWN'

/** Entry of `lines[]` on QUOTATION_LINES_UNAVAILABLE / SALE_LINES_UNAVAILABLE. */
export interface UnavailableLine {
  lineId: string
  productId: string | null
  variantId: string | null
  productName: string
  variantName: string | null
  reason: UnavailableLineReason
  requestedQuantity: number
  /** Sellable stock for INSUFFICIENT_STOCK; `null` for the other reasons. */
  availableQuantity: number | null
}

/** Decoded rejection of either conversion route (`decodeQuotationConversionError`). */
export type QuotationConversionFailure =
  // quotation → sale
  | { code: 'QUOTATION_EXPIRED' }
  | { code: 'QUOTATION_CANCELLED' }
  | { code: 'QUOTATION_ALREADY_CONVERTED'; saleId: string | null }
  | { code: 'QUOTATION_HAS_NO_ITEMS' }
  | { code: 'QUOTATION_LINES_UNAVAILABLE'; lines: UnavailableLine[] }
  /** 404: quotation not in this sucursal. */
  | { code: 'ENTITY_NOT_FOUND' }
  // sale → quotation
  /** 403: the draft was opened by another cashier. */
  | { code: 'SALE_UPDATE_FORBIDDEN' }
  | { code: 'SALE_NOT_FOUND' }
  | { code: 'SALE_NOT_DRAFT' }
  | { code: 'SALE_HAS_NO_ITEMS' }
  | { code: 'SALE_HAS_PAYMENTS' }
  | { code: 'SALE_HAS_STOCK_MOVEMENTS' }
  | { code: 'SALE_NOT_DISCARDABLE' }
  | { code: 'SALE_LINES_UNAVAILABLE'; lines: UnavailableLine[] }
  // common
  /** 400: missing header — a client bug. */
  | { code: 'IDEMPOTENCY_KEY_REQUIRED' }
  /** 409: same key, different request — use a new key. */
  | { code: 'IDEMPOTENCY_KEY_CONFLICT' }
  /** 409: same key still running — wait and retry with the same key. */
  | { code: 'IDEMPOTENCY_KEY_IN_FLIGHT' }
  /** 400 class-validator (e.g. customerNotes > 280, bad UUID). */
  | { code: 'VALIDATION' }
  /** 403 without a domain code: missing one of the two required permissions. */
  | { code: 'FORBIDDEN' }
  /** No response (offline, timeout): the outcome is unknown; retry with the same key. */
  | { code: 'NETWORK' }
  /** 2xx whose body broke the contract (ZodError): the conversion happened; reload. */
  | { code: 'RESPONSE_INVALID' }
  | { code: 'UNKNOWN'; status: number | null; error: string | null }

export type QuotationConversionFailureCode = QuotationConversionFailure['code']
