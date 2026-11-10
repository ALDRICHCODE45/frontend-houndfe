import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import type { AxiosProgressEvent } from 'axios'
import { http } from '@/core/shared/api/http'
import type {
  BrandOption,
  BulkUpsertVariantPricesPayload,
  CreateBrandPayload,
  CreateCategoryPayload,
  CreateGlobalPriceListPayload,
  CreateImagePayload,
  CreateLotPayload,
  CategoryOption,
  CreateProductPayload,
  CreateVariantPayload,
  GlobalPriceList,
  PriceList,
  ProductImage,
  ProductLot,
  ProductLotBackendResponse,
  Product,
  ProductAdvancedCatalogForm,
  ProductBackendListResponse,
  ProductBackendResponse,
  ProductDetail,
  ProductPatchAdvancedCatalogPayload,
  ProductType,
  ProductVariant,
  ProductVariantBackendResponse,
  ServiceDetail,
  UpdateLotPayload,
  UpdatePriceListPayload,
  UpdateProductPayload,
  UpdateVariantPayload,
  UpsertVariantPricePayload,
  VariantCatalogForm,
  VariantPatchCatalogPayload,
  VariantPrice,
} from '../interfaces/product.types'

// ── List query params ─────────────────────────────────────────────────────────

interface ProductFilters {
  type?: ProductType
}

export type ProductTableParams = ServerTableParams & ProductFilters

interface ProductPaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

// O1 S1: the backend rejects any `quantity` key on an edit PATCH (400
// STOCK_QUANTITY_READ_ONLY), even 0 or null. Strip it at the transport so no
// caller can send it by accident; stock only moves through an adjustment.
function withoutQuantity<T extends object>(payload: T): Omit<T, 'quantity'> {
  const { quantity: _quantity, ...rest } = payload as T & { quantity?: unknown }
  return rest as Omit<T, 'quantity'>
}

function getPriceCents(item: ProductBackendResponse): number {
  return item.priceCents ?? item.price?.priceCents ?? 0
}

function getCategoryName(item: ProductBackendResponse): string {
  return item.category?.name ?? item.categoryName ?? 'Sin categoría'
}

function getBrandName(item: ProductBackendResponse): string {
  return item.brand?.name ?? item.brandName ?? 'Sin marca'
}

function mapStatus(item: ProductBackendResponse): Product['status'] {
  if (item.status === 'inactive') return 'inactive'
  if (item.status === 'out_of_stock') return 'out_of_stock'
  if (item.status === 'active') return 'active'

  if (!(item.useStock ?? true)) return 'active'

  if (item.hasVariants && item.variantStockTotal != null) {
    return item.variantStockTotal > 0 ? 'active' : 'out_of_stock'
  }

  if ((item.quantity ?? 0) <= 0) return 'out_of_stock'
  return 'active'
}

function mapProduct(item: ProductBackendResponse): Product {
  return {
    id: item.id,
    name: item.name,
    type: item.type ?? 'PRODUCT',
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    categoryId: item.categoryId ?? item.category?.id ?? null,
    categoryName: getCategoryName(item),
    brandId: item.brandId ?? item.brand?.id ?? null,
    brandName: getBrandName(item),
    priceCents: getPriceCents(item),
    quantity: item.quantity ?? 0,
    minQuantity: item.minQuantity ?? 0,
    useStock: item.useStock ?? false,
    hasVariants: item.hasVariants ?? false,
    useLotsAndExpirations: item.useLotsAndExpirations ?? false,
    sellInPos: item.sellInPos ?? true,
    includeInOnlineCatalog: item.includeInOnlineCatalog ?? true,
    requiresPrescription: item.requiresPrescription ?? false,
    chargeProductTaxes: item.chargeProductTaxes ?? true,
    variantStockTotal: item.variantStockTotal ?? null,
    variantCount: item.variantCount ?? null,
    ...fromProductRawAdvancedCatalog(item),
    status: mapStatus(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function resolvePurchaseCostMode(item: ProductBackendResponse): 'NET' | 'GROSS' {
  if (item.purchaseCost?.mode === 'GROSS') return 'GROSS'
  if (item.purchaseCostMode === 'GROSS') return 'GROSS'
  return 'NET'
}

function mapProductDetail(item: ProductBackendResponse): ProductDetail {
  return {
    ...mapProduct(item),
    description: item.description ?? null,
    location: item.location ?? null,
    satKey: item.satKey ?? null,
    unit: item.unit ?? 'UNIDAD',
    ivaRate: item.ivaRate ?? 'IVA_16',
    iepsRate: item.iepsRate ?? 'NO_APLICA',
    purchaseCostMode: resolvePurchaseCostMode(item),
    purchaseNetCostCents: item.purchaseCost?.netCents ?? item.purchaseNetCostCents ?? 0,
    purchaseGrossCostCents: item.purchaseCost?.grossCents ?? item.purchaseGrossCostCents ?? 0,
    serviceDetail: normalizeServiceDetail(item.serviceDetail),
  }
}

function normalizeServiceDetail(raw: ServiceDetail | null | undefined): ServiceDetail | null {
  if (raw == null) return null
  const capacity =
    typeof raw.capacity === 'number' && Number.isInteger(raw.capacity) && raw.capacity >= 1
      ? raw.capacity
      : null
  const notes = typeof raw.notes === 'string' && raw.notes.trim().length > 0 ? raw.notes.trim() : null
  if (capacity == null && notes == null) return null
  return { capacity, notes }
}

function mapPagination(meta: ProductPaginationMeta): PaginatedResponse<Product>['pagination'] {
  return {
    pageIndex: meta.page - 1,
    pageSize: meta.limit,
    totalCount: meta.total,
    pageCount: meta.totalPages,
  }
}

function applyLocalTextFilter(rows: Product[], globalFilter?: string): Product[] {
  if (!globalFilter) return rows
  const search = globalFilter.toLowerCase().trim()
  return rows.filter((row) => {
    return [row.name, row.sku ?? '', row.barcode ?? '', row.categoryName, row.brandName]
      .join(' ')
      .toLowerCase()
      .includes(search)
  })
}

/**
 * Local type filter — runs after `mapProduct` and ONLY when `params.type` is
 * set. Idempotent: when the backend honors `?type=` it returns rows that all
 * match, so the local pass is a no-op; when the backend ignores `?type=` and
 * returns mixed rows, this is the safety net that keeps the toolbar honest.
 */
function applyLocalTypeFilter(rows: Product[], type?: ProductType): Product[] {
  if (!type) return rows
  return rows.filter((row) => row.type === type)
}

function applyLocalSort(rows: Product[], params: ServerTableParams): Product[] {
  if (!params.sorting?.length) return rows
  const sort = params.sorting[0]
  if (!sort) return rows

  return [...rows].sort((a, b) => {
    const aValue = a[sort.id as keyof Product]
    const bValue = b[sort.id as keyof Product]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sort.desc ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sort.desc ? bValue - aValue : aValue - bValue
    }

    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      if (aValue === bValue) return 0
      return sort.desc ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
    }

    return 0
  })
}

function mapVariant(productId: string, item: ProductVariantBackendResponse): ProductVariant {
  return {
    id: item.id,
    productId: item.productId ?? productId,
    name: item.name,
    option: item.option ?? null,
    value: item.value ?? null,
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    priceCents: item.priceCents ?? item.price?.priceCents ?? 0,
    quantity: item.quantity ?? 0,
    minQuantity: item.minQuantity ?? 0,
    purchaseNetCostCents: item.purchaseNetCostCents ?? null,
    purchaseNetCostDecimal:
      item.purchaseNetCostDecimal ??
      (item.purchaseNetCostCents != null ? item.purchaseNetCostCents / 100 : null),
    variantPrices: item.variantPrices ?? [],
    ...fromVariantRawCatalog(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

// ── Product / variant advanced catalog mappers (WU4) ──────

function fromProductRawAdvancedCatalog(raw: ProductBackendResponse): ProductAdvancedCatalogForm {
  return {
    hidePriceInOnlineCatalog: raw.hidePriceInOnlineCatalog ?? false,
    supportedCatalogPriceListIds: raw.supportedCatalogPriceListIds ?? [],
    supportsAllCatalogPriceLists: raw.supportsAllCatalogPriceLists ?? false,
    onlineStockPresentation: raw.onlineStockPresentation ?? null,
    onlineStockPresentationCustomQty: raw.onlineStockPresentationCustomQty ?? null,
  }
}

export function fromVariantRawCatalog(raw: ProductVariantBackendResponse): VariantCatalogForm {
  return {
    catalogPublishMode: raw.catalogPublishMode ?? 'INHERIT',
    onlineStockPresentation: raw.onlineStockPresentation ?? null,
    onlineStockPresentationCustomQty: raw.onlineStockPresentationCustomQty ?? null,
  }
}

// The stock pair is one unit: clearing emits BOTH nulls; non-custom modes carry null; CUSTOM_QUANTITY keeps `0`.
function stockOverrideDiff(
  current: Pick<ProductAdvancedCatalogForm, 'onlineStockPresentation' | 'onlineStockPresentationCustomQty'>,
  pristine: Pick<ProductAdvancedCatalogForm, 'onlineStockPresentation' | 'onlineStockPresentationCustomQty'>,
): Pick<VariantPatchCatalogPayload, 'onlineStockPresentation' | 'onlineStockPresentationCustomQty'> {
  const qty = current.onlineStockPresentation != null && current.onlineStockPresentation !== 'CUSTOM_QUANTITY' ? null : current.onlineStockPresentationCustomQty
  if (current.onlineStockPresentation !== pristine.onlineStockPresentation) {
    const diff: Pick<VariantPatchCatalogPayload, 'onlineStockPresentation' | 'onlineStockPresentationCustomQty'> = { onlineStockPresentation: current.onlineStockPresentation }
    if (current.onlineStockPresentation === null || qty !== pristine.onlineStockPresentationCustomQty) diff.onlineStockPresentationCustomQty = qty
    return diff
  }
  return qty === pristine.onlineStockPresentationCustomQty ? {} : { onlineStockPresentationCustomQty: qty }
}

export function toProductPatchAdvancedCatalogPayload(
  current: ProductAdvancedCatalogForm,
  pristine: ProductAdvancedCatalogForm,
): ProductPatchAdvancedCatalogPayload {
  const body: ProductPatchAdvancedCatalogPayload = { ...stockOverrideDiff(current, pristine) }
  if (current.hidePriceInOnlineCatalog !== pristine.hidePriceInOnlineCatalog) {
    body.hidePriceInOnlineCatalog = current.hidePriceInOnlineCatalog
  }
  const ids = current.supportedCatalogPriceListIds
  if (ids.length !== pristine.supportedCatalogPriceListIds.length || ids.some((id, i) => id !== pristine.supportedCatalogPriceListIds[i])) {
    body.supportedCatalogPriceListIds = ids
  }
  return body
}

export function toVariantPatchCatalogPayload(
  current: VariantCatalogForm,
  pristine: VariantCatalogForm,
): VariantPatchCatalogPayload {
  const body: VariantPatchCatalogPayload = { ...stockOverrideDiff(current, pristine) }
  if (current.catalogPublishMode !== pristine.catalogPublishMode) {
    body.catalogPublishMode = current.catalogPublishMode
  }
  return body
}

function mapLot(productId: string, item: ProductLotBackendResponse): ProductLot {
  return {
    id: item.id,
    productId: item.productId ?? productId,
    lotNumber: item.lotNumber ?? item.lot ?? '—',
    expirationDate: item.expirationDate ?? item.expiresAt ?? null,
    quantity: item.quantity ?? 0,
    manufactureDate: item.manufactureDate ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function mapArrayResponse<T>(response: T[] | { data: T[] }): T[] {
  return Array.isArray(response) ? response : response.data
}

/** Optional upload config: per-file progress for the image strip. */
export interface ImageUploadOptions {
  onUploadProgress?: (event: AxiosProgressEvent) => void
}

export const productApi = {
  /**
   * Fetches a page of products from GET /products.
   *
   * Architecture note (see fix/products-table-sort-and-error-surfacing):
   *
   *   The /products backend uses a strict whitelist that ONLY accepts
   *   page / limit / search / q — sortBy and sortOrder are REJECTED with
   *   HTTP 400. As of this change we therefore:
   *
   *     1. Do NOT send page, limit, sortBy or sortOrder. We rely on the
   *        backend to return the FULL list (or, when globalFilter is set,
   *        the FULL filtered list), and we sort + paginate locally so the
   *        sort column in the UI works as users expect.
   *     2. When the backend supports server-side sort, send sortBy / sortOrder
   *        and skip the local sort step below.
   *
   *   search / q are still server-side because they ARE in the whitelist,
   *   and we don't double-filter the result locally when globalFilter is
   *   set (the server already filtered).
   */
  async getPaginated(params: ProductTableParams): Promise<PaginatedResponse<Product>> {
    const { data } = await http.get<ProductBackendListResponse | ProductBackendResponse[]>(
      '/products',
      {
        params: {
          ...(params.globalFilter
            ? {
                search: params.globalFilter,
                q: params.globalFilter,
              }
            : {}),
          // type only when explicitly set; missing means both PRODUCT+SERVICE
          ...(params.type ? { type: params.type } : {}),
        },
      },
    )

    // Normalize response shape to a flat array of ProductBackendResponse.
    // Three possible shapes:
    //   1. Bare array                         -> use directly
    //   2. { data: [...] }   (no meta)        -> unwrap; legacy/non-paginated
    //   3. { data: [...], meta: {...} }       -> unwrap; future server-paginated
    //                                          (still local-sort because sort
    //                                          is always client-side now)
    let backendRows: ProductBackendResponse[]
    let serverPagination: ProductPaginationMeta | null = null

    if (Array.isArray(data)) {
      backendRows = data
    } else {
      backendRows = data.data
      if (data.meta) {
        serverPagination = data.meta
      }
    }

    let rows = backendRows.map(mapProduct)

    // Apply local text-filter ONLY when the server didn't already filter.
    // When globalFilter is set, we sent search/q; the server returned the
    // filtered set; double-filtering would shrink it incorrectly.
    if (!params.globalFilter) {
      rows = applyLocalTextFilter(rows, params.globalFilter)
    }

    // Local type fallback — runs unconditionally when params.type is set so
    // it acts as the safety net if the backend ignores ?type= (idempotent
    // when the backend honors it because all returned rows already match).
    if (params.type) {
      rows = applyLocalTypeFilter(rows, params.type)
    }

    // Sort is ALWAYS client-side now (backend rejects sortBy/sortOrder).
    rows = applyLocalSort(rows, params)

    // Server pagination metadata (if present) takes priority over local
    // math — this path is reserved for a future backend change that adds
    // server-side sort/pagination to the whitelist. Today we don't send
    // page/limit so this branch is dead, but it's here to keep the
    // contract stable if/when the backend evolves.
    if (serverPagination) {
      return {
        data: rows,
        pagination: mapPagination(serverPagination),
      }
    }

    const totalCount = rows.length
    const pageCount = Math.ceil(totalCount / params.pageSize) || 1
    const start = params.pageIndex * params.pageSize
    const pagedRows = rows.slice(start, start + params.pageSize)

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

  async getById(productId: string): Promise<ProductDetail> {
    const { data } = await http.get<ProductBackendResponse>(`/products/${productId}`)
    return mapProductDetail(data)
  },

  async create(payload: CreateProductPayload): Promise<ProductDetail & { _raw?: Record<string, unknown> }> {
    const { data } = await http.post<ProductBackendResponse>('/products', payload)
    const mapped = mapProductDetail(data)
    // Preserve raw response for post-creation variant price updates
    // SAFETY: the raw POST body is intentionally surfaced verbatim for
    // post-creation variant price updates; no member access is performed.
    return Object.assign(mapped, { _raw: data as unknown as Record<string, unknown> })
  },

  async update(productId: string, payload: UpdateProductPayload): Promise<ProductDetail> {
    const { data } = await http.patch<ProductBackendResponse>(
      `/products/${productId}`,
      withoutQuantity(payload),
    )
    return mapProductDetail(data)
  },

  async remove(productId: string): Promise<void> {
    await http.delete(`/products/${productId}`)
  },

  async getCategories(): Promise<CategoryOption[]> {
    const { data } = await http.get<CategoryOption[]>('/categories')
    return data
  },

  async createCategory(payload: CreateCategoryPayload): Promise<CategoryOption> {
    const { data } = await http.post<CategoryOption>('/categories', payload)
    return data
  },

  async getBrands(): Promise<BrandOption[]> {
    const { data } = await http.get<BrandOption[]>('/brands')
    return data
  },

  async createBrand(payload: CreateBrandPayload): Promise<BrandOption> {
    const { data } = await http.post<BrandOption>('/brands', payload)
    return data
  },

  async getVariants(productId: string): Promise<ProductVariant[]> {
    const { data } = await http.get<
      ProductVariantBackendResponse[] | { data: ProductVariantBackendResponse[] }
    >(`/products/${productId}/variants`)
    return mapArrayResponse(data).map((item) => mapVariant(productId, item))
  },

  async createVariant(productId: string, payload: CreateVariantPayload): Promise<ProductVariant> {
    const { data } = await http.post<ProductVariantBackendResponse>(
      `/products/${productId}/variants`,
      payload,
    )
    return mapVariant(productId, data)
  },

  async updateVariant(
    productId: string,
    variantId: string,
    payload: UpdateVariantPayload,
  ): Promise<ProductVariant> {
    const { data } = await http.patch<ProductVariantBackendResponse>(
      `/products/${productId}/variants/${variantId}`,
      withoutQuantity(payload),
    )
    return mapVariant(productId, data)
  },

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await http.delete(`/products/${productId}/variants/${variantId}`)
  },

  async getLots(productId: string): Promise<ProductLot[]> {
    const { data } = await http.get<
      ProductLotBackendResponse[] | { data: ProductLotBackendResponse[] }
    >(`/products/${productId}/lots`)
    return mapArrayResponse(data).map((item) => mapLot(productId, item))
  },

  async createLot(productId: string, payload: CreateLotPayload): Promise<ProductLot> {
    const { data } = await http.post<ProductLotBackendResponse>(
      `/products/${productId}/lots`,
      payload,
    )
    return mapLot(productId, data)
  },

  async updateLot(
    productId: string,
    lotId: string,
    payload: UpdateLotPayload,
  ): Promise<ProductLot> {
    const { data } = await http.patch<ProductLotBackendResponse>(
      `/products/${productId}/lots/${lotId}`,
      withoutQuantity(payload),
    )
    return mapLot(productId, data)
  },

  async removeLot(productId: string, lotId: string): Promise<void> {
    await http.delete(`/products/${productId}/lots/${lotId}`)
  },

  // ── Global Price Lists ────────────────────────────────────

  async getGlobalPriceLists(): Promise<GlobalPriceList[]> {
    const { data } = await http.get<GlobalPriceList[] | { data: GlobalPriceList[] }>(
      '/price-lists',
    )
    return mapArrayResponse(data)
  },

  async createGlobalPriceList(payload: CreateGlobalPriceListPayload): Promise<GlobalPriceList> {
    const { data } = await http.post<GlobalPriceList>('/price-lists', payload)
    return data
  },

  async removeGlobalPriceList(priceListId: string): Promise<void> {
    await http.delete(`/price-lists/${priceListId}`)
  },

  // ── Price Lists (per product) ───────────────────────────

  async getPriceLists(productId: string): Promise<PriceList[]> {
    const { data } = await http.get<PriceList[] | { data: PriceList[] }>(
      `/products/${productId}/price-lists`,
    )
    return mapArrayResponse(data)
  },

  async updatePriceList(
    productId: string,
    priceListId: string,
    payload: UpdatePriceListPayload,
  ): Promise<PriceList> {
    const { data } = await http.patch<PriceList>(
      `/products/${productId}/price-lists/${priceListId}`,
      payload,
    )
    return data
  },

  // ── Images ───────────────────────────────────────────────

  async getImages(productId: string): Promise<ProductImage[]> {
    const { data } = await http.get<ProductImage[] | { data: ProductImage[] }>(
      `/products/${productId}/images`,
    )
    return mapArrayResponse(data)
  },

  async createImage(productId: string, payload: CreateImagePayload): Promise<ProductImage> {
    const { data } = await http.post<ProductImage>(`/products/${productId}/images`, payload)
    return data
  },

  async setMainImage(productId: string, imageId: string): Promise<ProductImage> {
    const { data } = await http.patch<ProductImage>(`/products/${productId}/images/${imageId}/main`)
    return data
  },

  async removeImage(productId: string, imageId: string): Promise<void> {
    await http.delete(`/products/${productId}/images/${imageId}`)
  },

  // ── Variant Prices ───────────────────────────────────────

  async getVariantPrices(productId: string, variantId: string): Promise<VariantPrice[]> {
    const { data } = await http.get<VariantPrice[] | { data: VariantPrice[] }>(
      `/products/${productId}/variants/${variantId}/prices`,
    )
    return mapArrayResponse(data)
  },

  async upsertVariantPrice(
    productId: string,
    variantId: string,
    priceListId: string,
    payload: UpsertVariantPricePayload,
  ): Promise<VariantPrice> {
    const { data } = await http.put<VariantPrice>(
      `/products/${productId}/variants/${variantId}/prices/${priceListId}`,
      payload,
    )
    return data
  },

  async bulkUpsertVariantPrices(
    productId: string,
    variantId: string,
    payload: BulkUpsertVariantPricesPayload,
  ): Promise<VariantPrice[]> {
    const { data } = await http.put<VariantPrice[] | { data: VariantPrice[] }>(
      `/products/${productId}/variants/${variantId}/prices`,
      payload,
    )
    return mapArrayResponse(data)
  },

  async removeVariantPrice(
    productId: string,
    variantId: string,
    priceListId: string,
  ): Promise<void> {
    await http.delete(`/products/${productId}/variants/${variantId}/prices/${priceListId}`)
  },

  // ── Image Upload ─────────────────────────────────────────

  async uploadProductImage(
    productId: string,
    file: File,
    options?: ImageUploadOptions,
  ): Promise<ProductImage> {
    const formData = new FormData()
    formData.append('file', file)
    const url = `/products/${productId}/images/upload`
    const { data } = options?.onUploadProgress
      ? await http.post<ProductImage>(url, formData, { onUploadProgress: options.onUploadProgress })
      : await http.post<ProductImage>(url, formData)
    return data
  },

  async uploadVariantImage(
    productId: string,
    variantId: string,
    file: File,
    options?: ImageUploadOptions,
  ): Promise<ProductImage> {
    const formData = new FormData()
    formData.append('file', file)
    const url = `/products/${productId}/variants/${variantId}/images/upload`
    const { data } = options?.onUploadProgress
      ? await http.post<ProductImage>(url, formData, { onUploadProgress: options.onUploadProgress })
      : await http.post<ProductImage>(url, formData)
    return data
  },
}
