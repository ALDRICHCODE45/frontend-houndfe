import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http, type TenantContextBlobErrorConfig } from '@/core/shared/api/http'
import {
  customerStatementFallbackFileName,
  isCustomerStatementPdfBlob,
  parseCustomerStatementFileName,
  readCustomerStatementBlobError,
} from '../statement/customerStatementFile'
import type { CustomerStatementRange } from '../statement/customerStatementPeriod'
import type {
  CreateCustomerAddressPayload,
  CreateCustomerPayload,
  Customer,
  CustomerAddress,
  CustomerAddressBackendResponse,
  CustomerBackendListResponse,
  CustomerBackendResponse,
  CustomerDetail,
  UpdateCustomerAddressPayload,
  UpdateCustomerPayload,
} from '../interfaces/customer.types'
import type {
  CustomerListingBackendResponse,
  CustomerListingBackendRow,
  CustomerListingOption,
  CustomerListingOptionField,
  CustomerListingOptionsBackendResponse,
  CustomerListingPage,
  CustomerListingParams,
  CustomerListingRow,
} from '../interfaces/customer-listing.types'

/** Values asked for each filter of the customers table (GET /customers/listing/options max 200). */
const LISTING_OPTIONS_LIMIT = 200

interface CustomerPaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

function mapCustomer(item: CustomerBackendResponse): Customer {
  const firstName = item.firstName ?? ''
  const lastName = item.lastName ?? null
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  return {
    id: item.id,
    firstName,
    lastName,
    fullName,
    phoneCountryCode: item.phoneCountryCode ?? null,
    phone: item.phone ?? null,
    email: item.email ?? null,
    globalPriceListId: item.globalPriceListId ?? item.globalPriceList?.id ?? null,
    globalPriceListName: item.globalPriceList?.name ?? null,
    comments: item.comments ?? null,
    matchedPetName: item.matchedPetName ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

// customers-module T6: a row of GET /customers/listing. `metrics` stays absent without read:Sale
// (never filled with zeros), so the table can tell «no access» from «no sales».
function mapListingRow(item: CustomerListingBackendRow): CustomerListingRow {
  const firstName = item.firstName ?? ''
  const lastName = item.lastName ?? null
  const personName = [firstName, lastName].filter(Boolean).join(' ')
  const row: CustomerListingRow = {
    id: item.id,
    firstName,
    lastName,
    fullName: personName || item.businessName || '',
    businessName: item.businessName ?? null,
    phoneCountryCode: item.phoneCountryCode ?? null,
    phone: item.phone ?? null,
    email: item.email ?? null,
    globalPriceListId: item.globalPriceList?.id ?? null,
    globalPriceListName: item.globalPriceList?.name ?? null,
    rfc: item.rfc ?? null,
    fiscalRegime: item.fiscalRegime ?? null,
    isTrusted: item.isTrusted === true,
    createdAt: item.createdAt,
    primaryAddress: item.primaryAddress ?? null,
    activePetsCount: item.activePetsCount ?? 0,
    petSpecies: item.petSpecies ?? [],
    matchedPetName: item.matchedPetName ?? null,
  }
  if (item.matchedAddressId) row.matchedAddressId = item.matchedAddressId
  if (item.metrics) row.metrics = item.metrics
  return row
}

function mapAddress(item: CustomerAddressBackendResponse): CustomerAddress {
  return {
    id: item.id,
    customerId: item.customerId,
    street: item.street,
    exteriorNumber: item.exteriorNumber ?? null,
    interiorNumber: item.interiorNumber ?? null,
    zipCode: item.zipCode ?? null,
    neighborhood: item.neighborhood ?? null,
    municipality: item.municipality ?? null,
    city: item.city ?? null,
    state: item.state ?? null,
    // The backend may omit latitude/longitude on legacy rows; normalize missing
    // values to `null` so the AddressMapPicker can v-model against the entity
    // directly (design §5.3).
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function mapCustomerDetail(item: CustomerBackendResponse): CustomerDetail {
  return {
    ...mapCustomer(item),
    businessName: item.businessName ?? null,
    fiscalZipCode: item.fiscalZipCode ?? null,
    rfc: item.rfc ?? null,
    fiscalRegime: item.fiscalRegime ?? null,
    billingStreet: item.billingStreet ?? null,
    billingExteriorNumber: item.billingExteriorNumber ?? null,
    billingInteriorNumber: item.billingInteriorNumber ?? null,
    billingZipCode: item.billingZipCode ?? null,
    billingNeighborhood: item.billingNeighborhood ?? null,
    billingMunicipality: item.billingMunicipality ?? null,
    billingCity: item.billingCity ?? null,
    billingState: item.billingState ?? null,
    addresses: (item.addresses ?? []).map(mapAddress),
    ...(typeof item.activePetsCount === 'number' ? { activePetsCount: item.activePetsCount } : {}),
    // Handoff 32 §4: only a real boolean; absent stays unknown, never «not trusted».
    ...(typeof item.isTrusted === 'boolean' ? { isTrusted: item.isTrusted } : {}),
  }
}

function mapPagination(meta: CustomerPaginationMeta): PaginatedResponse<Customer>['pagination'] {
  return {
    pageIndex: meta.page - 1,
    pageSize: meta.limit,
    totalCount: meta.total,
    pageCount: meta.totalPages,
  }
}

function isPaginatedResponse(
  response: CustomerBackendListResponse | CustomerBackendResponse[],
): response is CustomerBackendListResponse {
  return !Array.isArray(response) && Array.isArray(response.data) && !!response.meta
}

function mapArrayResponse<T>(response: T[] | { data: T[] }): T[] {
  return Array.isArray(response) ? response : response.data
}

// The search term is filtered by the server (`GET /customers?search=`, handoff 27
// §4), pets included, so it is never re-filtered here: a customer matched only
// through a pet name has no own field containing the term. Only sorting is local.
function applyLocalSorting(rows: Customer[], params: ServerTableParams): Customer[] {
  const filtered = [...rows]

  if (params.sorting?.length) {
    const sort = params.sorting[0]

    if (sort) {
      filtered.sort((a, b) => {
        const aValue = a[sort.id as keyof Customer]
        const bValue = b[sort.id as keyof Customer]

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sort.desc ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
        }

        return 0
      })
    }
  }

  return filtered
}

export const customerApi = {
  async getPaginated(params: ServerTableParams): Promise<PaginatedResponse<Customer>> {
    const page = params.pageIndex + 1
    const limit = params.pageSize
    // Trimmed; omitted when empty so a caller without a term gets every customer.
    const search = params.globalFilter?.trim() ?? ''

    const { data } = await http.get<CustomerBackendListResponse | CustomerBackendResponse[]>(
      '/customers',
      {
        params: {
          page,
          limit,
          ...(search ? { search } : {}),
          ...(params.sorting?.[0]
            ? {
                sortBy: params.sorting[0].id,
                sortOrder: params.sorting[0].desc ? 'desc' : 'asc',
              }
            : {}),
        },
      },
    )

    if (isPaginatedResponse(data)) {
      return {
        data: data.data.map(mapCustomer),
        pagination: mapPagination(data.meta),
      }
    }

    const rows = data.map(mapCustomer)
    const filteredRows = applyLocalSorting(rows, params)
    const totalCount = filteredRows.length
    const pageCount = Math.ceil(totalCount / params.pageSize) || 1
    const start = params.pageIndex * params.pageSize
    const pagedRows = filteredRows.slice(start, start + params.pageSize)

    return {
      data: pagedRows,
      pagination: {
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
        totalCount,
        pageCount,
      },
    }
  },

  /**
   * customers-module T6 (handoff 32 §1): the customers table — server paging, sorting, filters and
   * the totals of the whole filter. `params` go as given (the caller builds them from the filters
   * schema); GET /customers above stays the POS selector array.
   */
  async listCustomersListing(params: CustomerListingParams): Promise<CustomerListingPage> {
    const { data } = await http.get<CustomerListingBackendResponse>('/customers/listing', { params })
    return {
      data: data.data.map(mapListingRow),
      pagination: mapPagination(data.pagination),
      filterSummary: data.filterSummary,
    }
  },

  /** Distinct values of a location or fiscal field with their customer count, most used first. */
  async listCustomerListingOptions(
    field: CustomerListingOptionField,
    q?: string,
  ): Promise<CustomerListingOption[]> {
    const term = q?.trim() ?? ''
    const { data } = await http.get<CustomerListingOptionsBackendResponse>('/customers/listing/options', {
      params: { field, ...(term ? { q: term } : {}), limit: LISTING_OPTIONS_LIMIT },
    })
    return data.data
  },

  async getById(customerId: string): Promise<CustomerDetail> {
    const { data } = await http.get<CustomerBackendResponse>(`/customers/${customerId}`)
    return mapCustomerDetail(data)
  },

  async create(payload: CreateCustomerPayload): Promise<CustomerDetail> {
    const { data } = await http.post<CustomerBackendResponse>('/customers', payload)
    return mapCustomerDetail(data)
  },

  async update(customerId: string, payload: UpdateCustomerPayload): Promise<CustomerDetail> {
    const { data } = await http.patch<CustomerBackendResponse>(`/customers/${customerId}`, payload)
    return mapCustomerDetail(data)
  },

  async remove(customerId: string): Promise<void> {
    await http.delete(`/customers/${customerId}`)
  },

  // ── Addresses ─────────────────────────────────────────────

  async getAddresses(customerId: string): Promise<CustomerAddress[]> {
    const { data } = await http.get<
      CustomerAddressBackendResponse[] | { data: CustomerAddressBackendResponse[] }
    >(`/customers/${customerId}/addresses`)
    return mapArrayResponse(data).map(mapAddress)
  },

  async createAddress(
    customerId: string,
    payload: CreateCustomerAddressPayload,
  ): Promise<CustomerAddress> {
    const { data } = await http.post<CustomerAddressBackendResponse>(
      `/customers/${customerId}/addresses`,
      payload,
    )
    return mapAddress(data)
  },

  async updateAddress(
    customerId: string,
    addressId: string,
    payload: UpdateCustomerAddressPayload,
  ): Promise<CustomerAddress> {
    const { data } = await http.patch<CustomerAddressBackendResponse>(
      `/customers/${customerId}/addresses/${addressId}`,
      payload,
    )
    return mapAddress(data)
  },

  async removeAddress(customerId: string, addressId: string): Promise<void> {
    await http.delete(`/customers/${customerId}/addresses/${addressId}`)
  },

  /**
   * Handoff 29: the customer account statement PDF for `[from, to)` (`read:Sale`). Downloaded as
   * a Blob; only a 200 real PDF is returned (never a half or JSON file). A JSON error inside the
   * Blob is read so the caller can tell 400 / 404 CUSTOMER_NOT_FOUND / 500 apart.
   */
  async getStatementPdf(
    customerId: string,
    range: CustomerStatementRange,
    options: { signal?: AbortSignal } = {},
  ): Promise<CustomerStatementPdf> {
    try {
      const config: TenantContextBlobErrorConfig = {
        params: { from: range.from, to: range.to },
        responseType: 'blob',
        signal: options.signal,
        tenantContextBlobError: true,
      }
      const response = await http.get<Blob>(
        `/customers/${encodeURIComponent(customerId)}/statement/pdf`,
        config,
      )
      if (response.status !== 200) throw new Error('CUSTOMER_STATEMENT_UNEXPECTED_STATUS')
      const blob = response.data
      if (!(blob instanceof Blob) || !(await isCustomerStatementPdfBlob(blob))) {
        throw new Error('CUSTOMER_STATEMENT_NON_PDF_BODY')
      }
      return {
        blob,
        fileName: parseCustomerStatementFileName(
          response.headers?.['content-disposition'] ?? null,
          customerStatementFallbackFileName(customerId, range),
        ),
      }
    } catch (error) {
      throw await readCustomerStatementBlobError(error)
    }
  },
}

export interface CustomerStatementPdf {
  blob: Blob
  fileName: string
}
