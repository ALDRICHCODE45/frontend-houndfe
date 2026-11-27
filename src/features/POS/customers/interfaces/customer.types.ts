// Backend response shape
export interface CustomerBackendResponse {
  id: string
  firstName: string
  lastName?: string | null
  phoneCountryCode?: string | null
  phone?: string | null
  email?: string | null
  globalPriceListId?: string | null
  comments?: string | null
  // Billing
  businessName?: string | null
  fiscalZipCode?: string | null
  rfc?: string | null
  fiscalRegime?: string | null
  billingStreet?: string | null
  billingExteriorNumber?: string | null
  billingInteriorNumber?: string | null
  billingZipCode?: string | null
  billingNeighborhood?: string | null
  billingMunicipality?: string | null
  billingCity?: string | null
  billingState?: string | null
  // Resolved relations
  globalPriceList?: { id: string; name: string } | null
  addresses?: CustomerAddressBackendResponse[]
  // Handoff 27 §4: list items only. The ACTIVE pet name when the `search` term
  // matched only through a pet; `null` otherwise or without a search.
  matchedPetName?: string | null
  // Handoff 27 §4.1: `GET /customers/:id` only (not on list, create or update).
  activePetsCount?: number
  // Handoff 32 §4: on `GET /customers/:id`, PATCH and POST (always false on POST).
  isTrusted?: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomerAddressBackendResponse {
  id: string
  customerId: string
  street: string
  exteriorNumber?: string | null
  interiorNumber?: string | null
  zipCode?: string | null
  neighborhood?: string | null
  municipality?: string | null
  city?: string | null
  state?: string | null
  // Optional map pin (design §5.3 / §8.1). The backend may omit these for
  // legacy rows; `mapAddress` normalizes them to `null` on the entity.
  latitude?: number | null
  longitude?: number | null
  createdAt: string
  updatedAt: string
}

// Frontend entity for table rows
export interface Customer {
  id: string
  firstName: string
  lastName: string | null
  fullName: string // computed: firstName + lastName
  phoneCountryCode: string | null
  phone: string | null
  email: string | null
  globalPriceListId: string | null
  globalPriceListName: string | null
  comments: string | null
  /**
   * Handoff 27 §4: set on every mapped list item («Bruno» or `null`). Optional in
   * the type only so hand-built fixtures and detail entities stay valid.
   */
  matchedPetName?: string | null
  createdAt: string
  updatedAt: string
}

// Full detail (extends Customer)
export interface CustomerDetail extends Customer {
  businessName: string | null
  fiscalZipCode: string | null
  rfc: string | null
  fiscalRegime: string | null
  billingStreet: string | null
  billingExteriorNumber: string | null
  billingInteriorNumber: string | null
  billingZipCode: string | null
  billingNeighborhood: string | null
  billingMunicipality: string | null
  billingCity: string | null
  billingState: string | null
  addresses: CustomerAddress[]
  /**
   * Handoff 27 §4.1: number of ACTIVE pets, from `GET /customers/:id`. `undefined`
   * means unknown (create/update responses do not carry it), never «0 pets».
   */
  activePetsCount?: number
  /**
   * Handoff 32 §4: «Cliente de confianza». `undefined` means the response did not carry it
   * (unknown), never «not trusted»: the editor then neither shows nor sends the switch.
   */
  isTrusted?: boolean
}

export interface CustomerAddress {
  id: string
  customerId: string
  street: string
  exteriorNumber: string | null
  interiorNumber: string | null
  zipCode: string | null
  neighborhood: string | null
  municipality: string | null
  city: string | null
  state: string | null
  // Map pin. `null` is the canonical "no coordinates" value so the
  // AddressMapPicker can v-model against the entity directly.
  latitude?: number | null
  longitude?: number | null
  createdAt: string
  updatedAt: string
}

// Paginated backend response
export interface CustomerBackendListResponse {
  data: CustomerBackendResponse[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Create payload (matches backend POST /customers)
export interface CreateCustomerPayload {
  firstName: string
  lastName?: string
  phoneCountryCode?: string
  phone?: string
  email?: string
  comments?: string
  globalPriceListId?: string
  // Billing
  businessName?: string
  fiscalZipCode?: string
  rfc?: string
  fiscalRegime?: string
  billingStreet?: string
  billingExteriorNumber?: string
  billingInteriorNumber?: string
  billingZipCode?: string
  billingNeighborhood?: string
  billingMunicipality?: string
  billingCity?: string
  billingState?: string
  // Addresses inline
  addresses?: CreateCustomerAddressPayload[]
}

/**
 * PATCH body. `isTrusted` is PATCH-only (handoff 32 §4): a strict boolean, and POST answers 400
 * when it is sent, so it is not part of `CreateCustomerPayload`.
 */
export type UpdateCustomerPayload = Partial<Omit<CreateCustomerPayload, 'addresses'>> & {
  isTrusted?: boolean
}

export interface CreateCustomerAddressPayload {
  street: string
  exteriorNumber?: string
  interiorNumber?: string
  zipCode?: string
  neighborhood?: string
  municipality?: string
  city?: string
  state?: string
  // Coordinate pair is passed verbatim: omit both on CREATE for no pin,
  // omit both on PATCH to preserve, or send both null to clear.
  // Replacement requires both finite numbers (latitude ±90, longitude ±180).
  // Callers must validate the pair; zero and full numeric precision are valid.
  latitude?: number | null
  longitude?: number | null
}

export type UpdateCustomerAddressPayload = Partial<CreateCustomerAddressPayload>

// Form input type (used with reactive() state)
export interface CustomerFormInput {
  firstName: string
  lastName: string
  phoneCountryCode: string
  phone: string
  email: string
  comments: string
  assignPriceList: boolean
  globalPriceListId: string
  // Billing
  businessName: string
  fiscalZipCode: string
  rfc: string
  fiscalRegime: string
  billingStreet: string
  billingExteriorNumber: string
  billingInteriorNumber: string
  billingZipCode: string
  billingNeighborhood: string
  billingMunicipality: string
  billingCity: string
  billingState: string
  showBillingAddress: boolean
  /** Edit only: the loaded `isTrusted`, or `null` when unknown (create, or not in the response). */
  isTrusted: boolean | null
}

// ── Customer page: sales summary and payments feed (handoff 32 §5-§6) ──────────

/** Same metrics as the listing row. Without sales: counts and sums 0, the rest `null`. */
export interface CustomerSalesMetrics {
  openDebtCents: number
  overdueDebtCents: number
  overdueCount: number
  /** A due day, `YYYY-MM-DD`. */
  oldestOverdueDueDate: string | null
  salesCount: number
  totalSoldCents: number
  averageTicketCents: number | null
  /** An instant (ISO). */
  lastPurchaseAt: string | null
}

export interface CustomerSalesSummaryResponse {
  customerId: string
  metrics: CustomerSalesMetrics
}

/** Lowercase on both kinds (handoff 32 §6). Unknown values are shown as they come. */
export type CustomerPaymentMethod = 'cash' | 'card_credit' | 'card_debit' | 'transfer' | (string & {})

export interface CustomerPaymentCatalog {
  paymentMethodId?: string
  name: string
  subtitle?: string | null
}

export interface CustomerPaymentCashier {
  id: string
  name: string
}

export type CustomerPaymentSaleStatus = 'CONFIRMED' | 'CANCELED' | (string & {})

/** «Cobrar todo»: `amountCents` is what was applied to the sales. */
export interface CustomerCollectionEvent {
  kind: 'collection'
  eventId: string
  occurredAt: string
  amountCents: number
  tenderedCents: number
  changeDueCents: number
  payments: Array<{ method: CustomerPaymentMethod; amountCents: number; catalog: CustomerPaymentCatalog | null }>
  sales: Array<{ saleId: string; folio: string; status: CustomerPaymentSaleStatus; appliedCents: number }>
  cashier: CustomerPaymentCashier | null
  /** Relative; `?format=ticket|a4` is added. Still printable after a sale is cancelled. */
  receiptPath: string | null
}

/** A single payment of one sale: `amountCents` = tendered − change (net). */
export interface CustomerSalePaymentEvent {
  kind: 'payment'
  eventId: string
  occurredAt: string
  method: CustomerPaymentMethod
  catalog: CustomerPaymentCatalog | null
  reference: string | null
  amountCents: number
  tenderedCents: number
  changeCents: number
  sale: { id: string; folio: string; status: CustomerPaymentSaleStatus; totalCents: number }
  cashier: CustomerPaymentCashier | null
  /** Relative; `?format=receipt-a4|receipt-ticket` is added. `null` once the sale is not CONFIRMED. */
  receiptPath: string | null
}

export type CustomerPaymentEvent = CustomerCollectionEvent | CustomerSalePaymentEvent

export interface CustomerPaymentsResponse {
  data: CustomerPaymentEvent[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface AddressFormInput {
  street: string
  exteriorNumber: string
  interiorNumber: string
  zipCode: string
  neighborhood: string
  municipality: string
  city: string
  state: string
  // Map pin bound to AddressMapPicker. `null` (not undefined) keeps the v-model
  // contract symmetric with the picker.
  latitude?: number | null
  longitude?: number | null
}
