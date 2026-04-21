// ── Enums ─────────────────────────────────────────────────────────────────────

export type PromotionType = 'PRODUCT_DISCOUNT' | 'ORDER_DISCOUNT' | 'BUY_X_GET_Y' | 'ADVANCED'

export type PromotionMethod = 'AUTOMATIC' | 'MANUAL'

export type PromotionStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED'

export type DiscountType = 'PERCENTAGE' | 'FIXED'

export type PromotionTargetType = 'CATEGORIES' | 'BRANDS' | 'PRODUCTS'

export type CustomerScope = 'ALL' | 'REGISTERED_ONLY' | 'SPECIFIC'

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type TargetSide = 'DEFAULT' | 'BUY' | 'GET'

// ── Backend Response Shape ─────────────────────────────────────────────────────

export interface PromotionTargetItem {
  id: string
  side: TargetSide
  targetType: PromotionTargetType
  targetId: string
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
