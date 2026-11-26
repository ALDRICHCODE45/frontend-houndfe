/**
 * customers-module T6 — GET /customers/listing and GET /customers/listing/options (handoff 32,
 * backend doc 31 §2-§3). GET /customers (the POS selector array) keeps its own types in
 * customer.types.ts and does not change.
 */
import type { PaginatedResponse } from '@/core/shared/types/table.types'

export type CustomerListingSortBy =
  | 'name'
  | 'createdAt'
  | 'openDebt'
  | 'oldestOverdue'
  | 'lastPurchaseAt'
  | 'totalSold'
  | 'salesCount'
  | 'averageTicket'

export type CustomerListingSortOrder = 'asc' | 'desc'

export type CustomerListingOptionField = 'neighborhood' | 'municipality' | 'city' | 'zipCode' | 'fiscalRegime'

export type CustomerListingPetSpecies = 'DOG' | 'CAT' | 'OTHER'

/** Per-customer sales metrics; the key is absent without read:Sale. Amounts in cents. */
export interface CustomerSalesMetrics {
  openDebtCents: number
  overdueDebtCents: number
  overdueCount: number
  /** 'YYYY-MM-DD' (a calendar day, never shifted by the timezone). */
  oldestOverdueDueDate: string | null
  salesCount: number
  totalSoldCents: number
  /** null without sales (GET /sales summary says 0; this route says null on purpose). */
  averageTicketCents: number | null
  /** ISO instant. */
  lastPurchaseAt: string | null
}

export interface CustomerListingAddress {
  id: string
  neighborhood: string | null
  municipality: string | null
  city: string | null
  state: string | null
  zipCode: string | null
}

export interface CustomerListingBackendRow {
  id: string
  firstName: string | null
  lastName: string | null
  businessName: string | null
  phoneCountryCode: string | null
  phone: string | null
  email: string | null
  globalPriceList: { id: string; name: string } | null
  rfc: string | null
  fiscalRegime: string | null
  preferredPaymentMethod?: string | null
  isTrusted: boolean
  createdAt: string
  primaryAddress: CustomerListingAddress | null
  activePetsCount: number
  petSpecies: CustomerListingPetSpecies[]
  matchedPetName: string | null
  /** Only with a location filter: the oldest address that satisfies every location filter. */
  matchedAddressId?: string
  metrics?: CustomerSalesMetrics
}

/** Totals of every matching customer. Without read:Sale only `count`. */
export interface CustomerListingFilterSummary {
  count: number
  openDebtCents?: number
  overdueDebtCents?: number
}

export interface CustomerListingBackendResponse {
  data: CustomerListingBackendRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  filterSummary: CustomerListingFilterSummary
}

/** A row of the customers table. */
export interface CustomerListingRow {
  id: string
  firstName: string
  lastName: string | null
  fullName: string
  businessName: string | null
  phoneCountryCode: string | null
  phone: string | null
  email: string | null
  globalPriceListId: string | null
  globalPriceListName: string | null
  rfc: string | null
  fiscalRegime: string | null
  isTrusted: boolean
  createdAt: string
  primaryAddress: CustomerListingAddress | null
  activePetsCount: number
  petSpecies: CustomerListingPetSpecies[]
  matchedPetName: string | null
  matchedAddressId?: string
  metrics?: CustomerSalesMetrics
}

/**
 * Query of GET /customers/listing: paging, search and sort, plus the filter params exactly as the
 * filters schema serializes them (CSV multi values, 'true' / 'false', cents, ISO dates).
 */
export interface CustomerListingParams {
  page: number
  limit: number
  search?: string
  sortBy?: CustomerListingSortBy
  sortOrder?: CustomerListingSortOrder
  [filterParam: string]: string | number | undefined
}

export interface CustomerListingPage extends PaginatedResponse<CustomerListingRow> {
  filterSummary: CustomerListingFilterSummary
}

export interface CustomerListingOption {
  value: string
  customersCount: number
}

export interface CustomerListingOptionsBackendResponse {
  field: CustomerListingOptionField
  data: CustomerListingOption[]
}
