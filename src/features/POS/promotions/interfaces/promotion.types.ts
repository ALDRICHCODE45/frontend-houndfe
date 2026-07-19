// ── Enums ─────────────────────────────────────────────────────────────────────
//
// Each union type below is derived from the matching `as const` object in
// `constants/promotion.constants.ts` (sdd/magic-string-constants slice 2). The
// const is the single source of truth — any value-level change happens there
// and the type follows automatically. Call sites should still import the
// TYPE from this file and the VALUES from the constants file (no import
// aliasing; SCREAMING_SNAKE value + PascalCase type coexist).

import type {
  CUSTOMER_SCOPE,
  DAY_OF_WEEK,
  DISCOUNT_TYPE,
  PROMOTION_METHOD,
  PROMOTION_STATUS,
  PROMOTION_TARGET_TYPE,
  PROMOTION_TYPE,
  TARGET_SIDE,
} from '../constants/promotion.constants'

export type PromotionType = (typeof PROMOTION_TYPE)[keyof typeof PROMOTION_TYPE]

export type PromotionMethod = (typeof PROMOTION_METHOD)[keyof typeof PROMOTION_METHOD]

export type PromotionStatus = (typeof PROMOTION_STATUS)[keyof typeof PROMOTION_STATUS]

export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE]

export type PromotionTargetType =
  (typeof PROMOTION_TARGET_TYPE)[keyof typeof PROMOTION_TARGET_TYPE]

export type CustomerScope = (typeof CUSTOMER_SCOPE)[keyof typeof CUSTOMER_SCOPE]

export type DayOfWeek = (typeof DAY_OF_WEEK)[keyof typeof DAY_OF_WEEK]

export type TargetSide = (typeof TARGET_SIDE)[keyof typeof TARGET_SIDE]

// ── Backend Response Shape ─────────────────────────────────────────────────────

/**
 * Backend `targetItem` row from `GET /promotions/:id` and paginated
 * `GET /promotions` responses.
 *
 * For `VARIANTS` entries the backend MAY enrich the row with three
 * OPTIONAL response-only fields (`productId`, `variantName`, `productName`)
 * so the form can render `"<productName> · <variantName>"` chips directly
 * from the read response (REQ-8, Slice 4). These fields are READ-ONLY on
 * the response — they MUST NEVER be serialized into the create/update
 * payload (INV-1 + INV-3). When the variant was later deleted (or on an
 * older backend without enrichment), the backend simply omits these fields;
 * the hydration layer falls back to the existing `{ targetId, name: '' }`
 * shape and the chip shows the raw `targetId` honestly.
 *
 * For `CATEGORIES` / `BRANDS` / `PRODUCTS` entries the enrichment fields
 * are ignored and never read.
 */
export interface PromotionTargetItem {
  id: string
  side: TargetSide
  targetType: PromotionTargetType
  targetId: string
  /** Response-only. Parent product id for VARIANTS enrichment. Never serialized. */
  productId?: string
  /** Response-only. Friendly variant name for VARIANTS enrichment. Never serialized. */
  variantName?: string
  /** Response-only. Parent product display name for VARIANTS enrichment. Never serialized. */
  productName?: string
}

export interface PromotionCustomer {
  id: string
  customerId: string
  customer?: { id: string; firstName: string; lastName: string | null } | null
}

export interface PromotionPriceList {
  id: string
  globalPriceListId: string
  globalPriceList?: { id: string; name: string } | null
}

export interface PromotionDayOfWeek {
  id: string
  day: DayOfWeek
}

export interface PromotionResponse {
  id: string
  title: string
  type: PromotionType
  method: PromotionMethod
  status: PromotionStatus
  startDate: string | null
  endDate: string | null
  customerScope: CustomerScope
  discountType: DiscountType | null
  discountValue: number | null
  minPurchaseAmountCents: number | null
  appliesTo: PromotionTargetType | null
  buyQuantity: number | null
  getQuantity: number | null
  getDiscountPercent: number | null
  buyTargetType: PromotionTargetType | null
  getTargetType: PromotionTargetType | null
  targetItems: PromotionTargetItem[]
  customers: PromotionCustomer[]
  priceLists: PromotionPriceList[]
  daysOfWeek: PromotionDayOfWeek[]
  createdAt: string
  updatedAt: string
}

// ── Payload Types ──────────────────────────────────────────────────────────────

export interface PromotionTargetItemPayload {
  targetType: PromotionTargetType
  targetId: string
}

export interface PromotionAdvancedTargetItemPayload {
  targetId: string
}

export type CreatePromotionPayload =
  | CreateProductDiscountPayload
  | CreateOrderDiscountPayload
  | CreateBuyXGetYPayload
  | CreateAdvancedPayload

interface CreatePromotionBase {
  title: string
  method: PromotionMethod
  startDate?: string
  endDate?: string
  customerScope?: CustomerScope
  customerIds?: string[]
  priceListIds?: string[]
  daysOfWeek?: DayOfWeek[]
}

export interface CreateProductDiscountPayload extends CreatePromotionBase {
  type: 'PRODUCT_DISCOUNT'
  discountType: DiscountType
  discountValue: number
  appliesTo: PromotionTargetType
  targetItems?: PromotionTargetItemPayload[]
}

export interface CreateOrderDiscountPayload extends CreatePromotionBase {
  type: 'ORDER_DISCOUNT'
  discountType: DiscountType
  discountValue: number
  minPurchaseAmountCents?: number
}

export interface CreateBuyXGetYPayload extends CreatePromotionBase {
  type: 'BUY_X_GET_Y'
  buyQuantity: number
  getQuantity: number
  getDiscountPercent: number
  appliesTo?: PromotionTargetType
  targetItems?: PromotionTargetItemPayload[]
}

export interface CreateAdvancedPayload extends CreatePromotionBase {
  type: 'ADVANCED'
  buyQuantity: number
  getQuantity: number
  getDiscountPercent: number
  buyTargetType?: PromotionTargetType
  getTargetType?: PromotionTargetType
  buyTargetItems?: PromotionAdvancedTargetItemPayload[]
  getTargetItems?: PromotionAdvancedTargetItemPayload[]
}

export type UpdatePromotionPayload = Partial<Omit<CreatePromotionPayload, 'type'>>

// ── Form State ─────────────────────────────────────────────────────────────────

export interface PromotionTargetItemFormEntry {
  targetId: string
  name: string
  /**
   * Optional session-only context for variant entries: the parent product id.
   * Survives within a creation → same-session edit cycle so chips can show
   * product context across multiple products. Stripped from the create/update
   * payload by `toCreatePayload`/`toUpdatePayload` — never reaches the backend.
   */
  productId?: string
  /** Optional parent product display name for chip rendering. Session-only. */
  productName?: string
}

export interface PromotionFormState {
  // Shared
  title: string
  type: PromotionType
  method: PromotionMethod
  // Discount fields (PRODUCT_DISCOUNT, ORDER_DISCOUNT)
  discountType: DiscountType | ''
  discountValue: number
  // PRODUCT_DISCOUNT
  appliesTo: PromotionTargetType | ''
  targetItems: PromotionTargetItemFormEntry[]
  // ORDER_DISCOUNT
  hasMinPurchase: boolean
  minPurchaseAmountCents: number
  // BUY_X_GET_Y / ADVANCED
  buyQuantity: number
  getQuantity: number
  getDiscountPercent: number
  // ADVANCED
  buyTargetType: PromotionTargetType | ''
  buyTargetItems: PromotionTargetItemFormEntry[]
  getTargetType: PromotionTargetType | ''
  getTargetItems: PromotionTargetItemFormEntry[]
  // Conditions
  hasVigencia: boolean
  startDate: string
  endDate: string
  customerScope: CustomerScope
  customerIds: string[]
  hasPriceLists: boolean
  priceListIds: string[]
  hasDaysOfWeek: boolean
  daysOfWeek: DayOfWeek[]
}

// ── Label & Color Constants ────────────────────────────────────────────────────

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  PRODUCT_DISCOUNT: 'Descuento en productos',
  ORDER_DISCOUNT: 'Descuento en el pedido',
  BUY_X_GET_Y: '2x1, 3x2 o similares',
  ADVANCED: 'Promoción avanzada',
}

export const PROMOTION_METHOD_LABELS: Record<PromotionMethod, string> = {
  AUTOMATIC: 'Automático',
  MANUAL: 'Manual',
}

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  ACTIVE: 'Activa',
  SCHEDULED: 'Programada',
  ENDED: 'Finalizada',
}

export const PROMOTION_STATUS_COLORS: Record<PromotionStatus, string> = {
  ACTIVE: 'green',
  SCHEDULED: 'blue',
  ENDED: 'gray',
}

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
}
