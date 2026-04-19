import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
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
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
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

function applyLocalFilters(rows: Customer[], params: ServerTableParams): Customer[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase().trim()
    filtered = filtered.filter((row) => {
      return [row.fullName, row.email ?? '', row.phone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(search)
    })
  }

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

    const { data } = await http.get<CustomerBackendListResponse | CustomerBackendResponse[]>(
      '/customers',
      {
        params: {
          page,
          limit,
          ...(params.globalFilter
            ? {
                search: params.globalFilter,
                q: params.globalFilter,
              }
            : {}),
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
    const filteredRows = applyLocalFilters(rows, params)
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
}
