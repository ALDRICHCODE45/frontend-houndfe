export type SaleStatus = 'DRAFT' | 'CONFIRMED'
export type SaleCurrency = 'MXN'
export type PriceSource = 'default' | 'price_list' | 'custom'
export type PaymentMethod = 'cash' | 'card_credit' | 'card_debit' | 'transfer' | 'credit'
export type NonCreditPaymentMethod = Exclude<PaymentMethod, 'credit'>
export type SalePaymentStatus = 'PAID' | 'PARTIAL' | 'CREDIT'
export type SaleDeliveryStatus = 'PENDING' | 'DELIVERED' | 'NOT_APPLICABLE'

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

export type SaleDetailTimelineType = 'SALE_REGISTERED' | 'PAYMENT_RECEIVED' | 'PRODUCTS_DELIVERED'
export type SaleDetailPaymentMethod = 'CASH' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'TRANSFER' | 'CREDIT'

export interface SaleDetailItem {
  productName: string
  variantName: string | null
  imageUrl: string | null
  unitPriceCents: number
  quantity: number
  discountCents: number
  subtotalCents: number
}

export interface SaleDetailPayment {
  method: SaleDetailPaymentMethod
  amountCents: number
  tenderedCents: number
  changeCents: number
  reference: string | null
  paidAt: string
}

export interface SaleTimelineEvent {
  type: SaleDetailTimelineType
  at: string
}

export interface SaleDetail {
  id: string
  folio: string
  status: SaleStatus
  channel: string
  register: string
  confirmedAt: string
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
}

export interface ListSalesParams {
  page?: number
  limit?: number
  sortBy?: 'confirmedAt' | 'totalCents' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  q?: string
  status?: SaleStatus
  paymentStatus?: SalePaymentStatus
  deliveryStatus?: SaleDeliveryStatus
  from?: string
  to?: string
  cashierUserId?: string
  customerId?: string
}

export interface LegacyChargePayload {
  method: PaymentMethod
  amountCents: number
}

export interface PaymentEntry {
  method: NonCreditPaymentMethod
  amountCents: number
  reference?: string
}

export interface MultiPaymentChargePayload {
  payments: PaymentEntry[]
}

export type ChargeSalePayload =
  | (LegacyChargePayload & { payments?: never })
  | (MultiPaymentChargePayload & { method?: never; amountCents?: never })

export interface DebtPaymentPayload {
  method: NonCreditPaymentMethod
  amountCents: number
  reference?: string
}

export interface DebtPaymentResponse {
  saleId: string
  paidCents: number
  debtCents: number
  totalCents: number
  paymentStatus: SalePaymentStatus
}

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
}

export interface Sale {
  id: string
  userId: string
  status: SaleStatus
  items: SaleItem[]
  createdAt: string
  updatedAt: string
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
