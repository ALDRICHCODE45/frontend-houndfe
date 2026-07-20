import type { CustomerAddress } from '@/features/POS/customers/interfaces/customer.types'

import type {
  PAYMENT_METHOD,
  SALE_DELIVERY_STATUS,
  SALE_DETAIL_PAYMENT_METHOD,
  SALE_PAYMENT_STATUS,
  SALE_STATUS,
  SALE_TIMELINE_EVENT_TYPE,
} from '../constants/sale.constants'

// Union types below are derived from the matching `as const` object in
// `constants/sale.constants.ts` (sdd/magic-string-constants slice 3). The
// const is the single source of truth — any value-level change happens there
// and the type follows automatically. Call sites should still import the
// TYPE from this file and the VALUES from the constants file (no import
// aliasing; SCREAMING_SNAKE value + PascalCase type coexist).
//
// GUARDRAIL: SaleStatus now includes 'CANCELED' (ONE L). It is intentionally
// a SEPARATE module-scoped string from admin/employees' 'CANCELLED' (TWO
// L's). Per-module constants prevent the cross-module homonym bug.

export type SaleStatus = (typeof SALE_STATUS)[keyof typeof SALE_STATUS]
export type SaleCurrency = 'MXN'
export type PriceSource = 'default' | 'price_list' | 'custom'
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]
export type NonCreditPaymentMethod = Exclude<PaymentMethod, 'credit'>
export type CollectionPaymentMethod = NonCreditPaymentMethod
export type SalePaymentStatus =
  (typeof SALE_PAYMENT_STATUS)[keyof typeof SALE_PAYMENT_STATUS]
export type SaleDeliveryStatus =
  (typeof SALE_DELIVERY_STATUS)[keyof typeof SALE_DELIVERY_STATUS] // 'NOT_APPLICABLE' = instant-delivery (e.g. take-away); NOT "unknown".

/**
 * Discriminator used by `SaleTimelineEvent` for its `type` field.
 * Each value maps to a distinct payload shape (see the discriminated
 * union below).
 */
export type SaleTimelineEventType =
  (typeof SALE_TIMELINE_EVENT_TYPE)[keyof typeof SALE_TIMELINE_EVENT_TYPE] // 'COMMENT' carries its own payload (actor + commentId + body); the other three are register-event shapes.

// advanced-promotion-type WU-B — single source of truth for the rewardKind
// literal that surfaces on both SaleItem (draft) and SaleDetailItem
// (confirmed). The (string & {}) intersection keeps literal autocomplete at
// the call site while tolerating unknown runtime strings the backend may add
// in future reward families (forward-compat without churn).
export type SaleRewardKind = 'buy_x_get_y' | 'advanced' | (string & {}) | null

export interface SaleActorRef {
  id: string
  name: string
}

export interface SalesListCounts {
  all: number
  pendingPayments: number
  notDelivered: number
}

export interface SalesListPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ConfirmedSaleRow {
  id: string
  folio: string
  status: SaleStatus
  paymentStatus: SalePaymentStatus
  deliveryStatus: SaleDeliveryStatus
  totalCents: number
  debtCents: number
  confirmedAt: string
  dueDate: string | null
  customer: SaleActorRef | null
  cashier: SaleActorRef
  seller: SaleActorRef | null
  paymentMethods: SaleDetailPaymentMethod[]
}

export interface ConfirmedSalesListResponse {
  data: ConfirmedSaleRow[]
  pagination: SalesListPagination
  counts: SalesListCounts
}

export type SaleDetailPaymentMethod =
  (typeof SALE_DETAIL_PAYMENT_METHOD)[keyof typeof SALE_DETAIL_PAYMENT_METHOD] // UPPERCASE — distinct from PaymentMethod (LOWERCASE). Two different backend contracts.

export type SaleCommentErrorCode = 'COMMENT_NOT_FOUND' | 'COMMENT_AUTHOR_FORBIDDEN' | 'SALE_NOT_FOUND'

export interface SaleDetailItem {
  productName: string
  variantName: string | null
  imageUrl: string | null
  unitPriceCents: number
  quantity: number
  discountCents: number
  subtotalCents: number
  // Traceability snapshot — populated by the backend at confirm time.
  // All fields are nullable: only populated when the cashier overrode
  // price or applied a line discount.
  originalPriceCents?: number | null
  priceSource?: PriceSource | null
  appliedPriceListId?: string | null
  discountType?: 'amount' | 'percentage' | null
  discountValue?: number | null
  discountAmountCents?: number | null
  discountTitle?: string | null
  prePriceCentsBeforeDiscount?: number | null
  // buy-x-get-y-promotion: 'buy_x_get_y' = this line was the free unit of a
  // BXGY promo (the line itself is the reward). Null/absent = regular line.
  // advanced-promotion-type WU-B: also accepts 'advanced' for ADVANCED promo
  // reward lines; the union widens to SaleRewardKind for forward-compat with
  // future reward kinds. Pre-deploy backend responses omit the field;
  // optional + nullable keeps backward compat so old payloads still parse.
  rewardKind?: SaleRewardKind
  rewardDiscountPercent?: number | null
  // bxgy-promotion-followups REQ-7: line-level promotion trace. Non-null =
  // the line carries a promotion (BXGY or otherwise) and the details
  // surface MUST render a promo-name chip through `SaleItemBadges`.
  // Optional + nullable keeps pre-deploy confirmed-sale responses parsing.
  promotionId?: string | null
}

export interface SaleDetailPayment {
  method: SaleDetailPaymentMethod
  amountCents: number
  tenderedCents: number
  changeCents: number
  reference: string | null
  paidAt: string
}

export type SaleTimelineEvent =
  | {
    type: 'SALE_REGISTERED'
    at: string
    actor: SaleActorRef | null
    register: string
  }
  | {
    type: 'PAYMENT_RECEIVED'
    at: string
    actor: SaleActorRef | null
    register: string
    method: SaleDetailPaymentMethod
    amountCents: number
    reference: string | null
  }
  | {
    type: 'PRODUCTS_DELIVERED'
    at: string
    actor: SaleActorRef | null
    register: string
  }
  | {
    type: 'COMMENT'
    at: string
    actor: SaleActorRef
    commentId: string
    body: string
  }

export interface SaleComment {
  id: string
  saleId: string
  tenantId: string
  authorUserId: string
  body: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export class SaleCommentError extends Error {
  constructor(public readonly code: SaleCommentErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SaleCommentError'
  }
}

export interface SaleDetail {
  id: string
  folio: string
  status: SaleStatus
  channel: string
  register: string
  confirmedAt: string
  dueDate: string | null
  subtotalCents: number
  discountCents: number
  totalCents: number
  paidCents: number
  debtCents: number
  changeDueCents: number
  paymentStatus: SalePaymentStatus
  deliveryStatus: SaleDeliveryStatus
  customer: SaleActorRef | null
  cashier: SaleActorRef
  seller: SaleActorRef | null
  items: SaleDetailItem[]
  payments: SaleDetailPayment[]
  timeline: SaleTimelineEvent[]
  // pos-price-list-tiers: the global price list active when the sale was
  // confirmed. Null means PUBLICO (the system default). Optional so
  // pre-existing fixtures that omit the field still type-check.
  globalPriceListId?: string | null
}

export interface ListSalesParams {
  page?: number
  limit?: number
  sortBy?: 'confirmedAt' | 'totalCents' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  q?: string
  status?: SaleStatus[] // 'CANCELED' (one L) is now part of the SaleStatus union (sdd/magic-string-constants slice 3).
  paymentStatus?: SalePaymentStatus[]
  paymentMethod?: SaleDetailPaymentMethod[]
  deliveryStatus?: SaleDeliveryStatus[]
  folio?: string[]
  confirmedFrom?: string
  confirmedTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  totalMin?: number
  totalMax?: number
  debtMin?: number
  debtMax?: number
  customerIncludeNull?: boolean
  dueDateIncludeNull?: boolean
  paymentMethodIncludeNull?: boolean
  cashierUserId?: string
  customerId?: string[]
}

export interface LegacyChargePayload {
  method: PaymentMethod
  amountCents: number
  /** Optional ISO date string for debt due date (per backend §8). Frontend
   *  validates `>= today` before sending. Omit to let backend apply default. */
  dueDate?: string
}

export interface PaymentEntry {
  method: CollectionPaymentMethod
  amountCents: number
  reference?: string
}

export interface MultiPaymentChargePayload {
  payments: PaymentEntry[]
  /** Optional ISO date string for debt due date (per backend §8). */
  dueDate?: string
}

export type ChargeSalePayload =
  | (LegacyChargePayload & { payments?: never })
  | (MultiPaymentChargePayload & { method?: never; amountCents?: never })

export interface DebtPaymentPayload {
  payments: PaymentEntry[]
}

export interface DebtPaymentResponse {
  saleId: string
  paidCents: number
  debtCents: number
  totalCents: number
  paymentStatus: SalePaymentStatus
  paymentIds: string[]
}

export type DebtPaymentDomainErrorCode =
  | 'SALE_NOT_FOUND'
  | 'SALE_NOT_CONFIRMABLE_FOR_PAYMENT'
  | 'NO_OUTSTANDING_DEBT'
  | 'PAYMENT_EXCEEDS_DEBT'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'IDEMPOTENCY_KEY_IN_FLIGHT'
  | 'IDEMPOTENCY_KEY_REQUIRED'

export interface ChargeSaleResponse {
  saleId: string
  folio: string
  subtotalCents: number
  discountCents: number
  totalCents: number
  paidCents: number
  debtCents: number
  changeDueCents: number
  paymentStatus: SalePaymentStatus
  confirmedAt: string
}

export type ChargeDomainErrorCode =
  | 'AMBIGUOUS_PAYMENT_SHAPE'
  | 'TOO_MANY_PAYMENTS'
  | 'CREDIT_METHOD_NOT_VALID_IN_MULTI'
  | 'REFERENCE_REQUIRED'
  | 'PAYMENT_METHOD_NOT_SUPPORTED'
  | 'INVALID_CREDIT_CHARGE'
  | 'PAYMENT_AMOUNT_INVALID'
  | 'CUSTOMER_REQUIRED_FOR_CREDIT'
  | 'SALE_NOT_FOUND'
  | 'SALE_ALREADY_CONFIRMED'
  | 'PRICE_OUT_OF_DATE'
  | 'STOCK_INSUFFICIENT_AT_CONFIRM'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'IDEMPOTENCY_KEY_IN_FLIGHT'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'SALE_NOT_CONFIRMABLE_FOR_PAYMENT'
  | 'NO_OUTSTANDING_DEBT'
  | 'PAYMENT_EXCEEDS_DEBT'

export interface SaleItem {
  id: string
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  quantity: number
  unitPriceCents: number
  unitPriceCurrency: SaleCurrency
  originalPriceCents?: number | null
  priceSource?: PriceSource | null
  appliedPriceListId?: string | null
  customPriceCents?: number | null
  discountType?: 'amount' | 'percentage' | null
  discountValue?: number | null
  discountAmountCents?: number | null
  discountTitle?: string | null
  prePriceCentsBeforeDiscount?: number | null
  // promotions-in-sale: non-null = line discount came from an auto/manual promotion
  // (call veto to remove). Null/absent = seller's manual free-form discount or no discount.
  promotionId?: string | null
  // buy-x-get-y-promotion REQ-3: backend-provided NET per line. Same
  // semantics as SaleDetailItem.subtotalCents — line-level total after
  // the line discount (cashier-applied or promo-applied). The client
  // MUST render this directly and MUST NOT recompute it. Null/undefined
  // for pre-deploy draft responses (fall back to unitPrice × qty).
  subtotalCents?: number | null
  // buy-x-get-y-promotion REQ-3: BXGY reward flag. 'buy_x_get_y' = this
  // line was the free unit of a BXGY promo (the line itself is the
  // reward). Null/absent = regular line. advanced-promotion-type WU-B:
  // widened to SaleRewardKind so ADVANCED reward lines + future reward
  // families type-check. Pre-deploy draft responses omit the field;
  // optional + nullable keeps backward compat.
  rewardKind?: SaleRewardKind
  rewardDiscountPercent?: number | null
}

export interface SaleDraftCustomer {
  id: string
  firstName: string
  lastName: string | null
}

export interface AssignCustomerPayload {
  customerId: string
  shippingAddressId?: string | null
}

export interface AssignShippingAddressPayload {
  shippingAddressId: string | null
}

export type DraftCustomerAssignmentErrorCode =
  | 'CUSTOMER_NOT_FOUND'
  | 'SHIPPING_ADDRESS_NOT_FOUND'
  | 'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER'
  | 'SHIPPING_ADDRESS_REQUIRES_CUSTOMER'
  | 'SALE_NOT_DRAFT'
  | 'SALE_UPDATE_FORBIDDEN'

export interface AssignSellerPayload {
  sellerUserId: string
}

export type SellerAssignmentErrorCode =
  | 'SELLER_NOT_FOUND'
  | 'SELLER_NOT_ASSIGNABLE'
  | 'SALE_NOT_FOUND'
  | 'SALE_UPDATE_FORBIDDEN'

export class SellerAssignmentError extends Error {
  constructor(public readonly code: SellerAssignmentErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SellerAssignmentError'
  }
}

export interface SetDueDatePayload {
  // ISO date or null (clear)
  dueDate: string | null
}

export type SaleDueDateErrorCode =
  | 'INVALID_DUE_DATE'
  | 'SALE_ALREADY_PAID'
  | 'SALE_NOT_FOUND'
  | 'SALE_UPDATE_FORBIDDEN'

export class SaleDueDateError extends Error {
  constructor(public readonly code: SaleDueDateErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SaleDueDateError'
  }
}

export interface Sale {
  id: string
  userId: string
  status: SaleStatus
  items: SaleItem[]
  customer?: SaleDraftCustomer | null
  shippingAddress?: CustomerAddress | null
  createdAt: string
  updatedAt: string
  // pos-price-list-tiers: identifier of the global price list active on this
  // draft. Null when the seller never assigned one (defaults to PUBLICO).
  // Optional so pre-deploy fixtures that omit the field still type-check.
  globalPriceListId?: string | null
  // promotions-in-sale: backend-owned totals. Frontend MUST render these
  // directly (do NOT recompute). All optional so pre-deploy drafts work.
  subtotalCents?: number
  discountCents?: number
  totalCents?: number
  // promotions-in-sale: applied ORDER_DISCOUNT snapshot. Null when no order
  // promo applies; undefined on pre-deploy drafts.
  appliedOrderPromotion?: AppliedOrderPromotion | null
}

// promotions-in-sale: ORDER_DISCOUNT snapshot embedded in the Sale response.
export interface AppliedOrderPromotion {
  promotionId: string
  discountType: 'amount' | 'percentage'
  discountValue: number
  discountAmountCents: number
  discountTitle: string
}

// promotions-in-sale: item on the "Promociones disponibles" list returned by
// GET /sales/drafts/:id/applicable-promotions.
export interface ApplicablePromotion {
  id: string
  title: string
  type: 'PRODUCT_DISCOUNT' | 'ORDER_DISCOUNT' | 'BUY_X_GET_Y'
  // bxgy-promotion-followups REQ-4: BXGY eligibility snapshot. All optional
  // + nullable so existing pre-deploy / product/order fixtures keep parsing.
  // `eligible === false` is the only signal that disables the Aplicar control;
  // `undefined` MUST stay eligible (legacy fixtures omit this field on purpose).
  eligible?: boolean
  buyQuantity?: number | null
  getQuantity?: number | null
  // unitsNeeded: how many MORE units the seller must add to qualify for the
  // BXGY reward (rendered via the localized singular/plural hint).
  unitsNeeded?: number
  // 'MANUAL' for now — the only BXGY method exposed via "Promociones disponibles".
  method?: 'MANUAL'
}

// promotions-in-sale: response shape of GET /sales/drafts/:id/applicable-promotions.
export interface ListApplicablePromotionsResponse {
  saleId: string
  promotions: ApplicablePromotion[]
}

export interface AddItemPayload {
  productId: string
  variantId?: string | null
  quantity: number
}

export interface UpdateQtyPayload {
  quantity: number
}

export interface AvailablePriceOption {
  priceListId: string
  priceListName: string
  priceCents: number
  priceDecimal: number
  currency: SaleCurrency
  isCurrent: boolean
}

export interface AvailablePricesResponse {
  saleId: string
  itemId: string
  prices: AvailablePriceOption[]
}

export type OverrideItemPricePayload =
  | { priceListId: string; customPriceCents?: never }
  | { customPriceCents: number; priceListId?: never }

export type ApplyItemDiscountPayload =
  | { type: 'amount'; amountCents: number; title?: string }
  | { type: 'percentage'; percent: number; title?: string }

export type GlobalDiscountStrategy = 'replace' | 'skip'

export type ApplyGlobalDiscountPayload =
  | { type: 'amount'; amountCents: number; discountTitle?: string; strategy?: GlobalDiscountStrategy }
  | { type: 'percentage'; percent: number; discountTitle?: string; strategy?: GlobalDiscountStrategy }

export interface GlobalDiscountSkippedItem {
  itemId: string
  reason: string
}

export interface GlobalDiscountResponse {
  sale: Sale
  skippedItems: GlobalDiscountSkippedItem[]
}

// POS Catalog types — match backend contract exactly
export interface PosCatalogPrice {
  priceCents: number
  priceDecimal: number
  priceListName: string
}

export interface PosCatalogStock {
  quantity: number
  minQuantity: number
  location?: string | null
}

export interface PosCatalogVariant {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  mainImage: string | null
  price: PosCatalogPrice | null
  stock: PosCatalogStock | null
}

export interface PosCatalogItem {
  id: string
  name: string
  description?: string | null
  sku: string | null
  barcode: string | null
  unit: string | null
  hasVariants: boolean
  useStock: boolean
  enabledForPos?: boolean
  category: { id: string; name: string } | null
  brand: { id: string; name: string } | null
  mainImage: string | null
  images: string[]
  price: PosCatalogPrice | null
  stock: PosCatalogStock | null
  variants: PosCatalogVariant[]
}

export interface PosCatalogResponse {
  items: PosCatalogItem[]
  total: number
  limit: number
  offset: number
}

export interface PosCatalogSearchParams {
  q?: string
  limit?: number
  offset?: number
  categoryId?: string
  brandId?: string
}

// POS Product Detail — extended info for "Ver Detalles" modal
export interface PosProductDetailStock {
  quantity: number
  minQuantity: number
  location: string | null
}

export interface PosProductDetailVariant {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  mainImage: string | null
  price: PosCatalogPrice | null
  stock: PosProductDetailStock | null
}

export interface PosProductDetail {
  id: string
  name: string
  description: string | null
  sku: string | null
  barcode: string | null
  unit: string | null
  hasVariants: boolean
  useStock: boolean
  enabledForPos: boolean
  category: { id: string; name: string } | null
  brand: { id: string; name: string } | null
  mainImage: string | null
  images: string[]
  price: PosCatalogPrice | null
  stock: PosProductDetailStock | null
  variants: PosProductDetailVariant[]
}
