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

export type UpdateCustomerPayload = Partial<Omit<CreateCustomerPayload, 'addresses'>>

export interface CreateCustomerAddressPayload {
  street: string
  exteriorNumber?: string
  interiorNumber?: string
  zipCode?: string
  neighborhood?: string
  municipality?: string
  city?: string
  state?: string
  // Optional map pin; emitted only when both coordinates are present.
  // Type widened to `number | null` per REQ-CA-003 (sdd delivery-routes
  // S7 verify remediation). The runtime contract is unchanged — `null`
  // is omitted at the API boundary — but the literal type must accept
  // `null` so callers can pass `null` to mean "no pin" without a ts
  // complaint.
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
