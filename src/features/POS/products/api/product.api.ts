import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
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
  ProductBackendListResponse,
  ProductBackendResponse,
  ProductDetail,
  ProductVariant,
  ProductVariantBackendResponse,
  UpdateLotPayload,
  UpdatePriceListPayload,
  UpdateProductPayload,
  UpdateVariantPayload,
  UpsertVariantPricePayload,
  VariantPrice,
} from '../interfaces/product.types'

interface ProductPaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
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
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    categoryId: item.categoryId ?? item.category?.id ?? null,
    categoryName: getCategoryName(item),
    brandId: item.brandId ?? item.brand?.id ?? null,
    brandName: getBrandName(item),
    priceCents: getPriceCents(item),
    quantity: item.quantity ?? 0,
    minQuantity: item.minQuantity ?? 0,
    useStock: item.useStock ?? true,
    hasVariants: item.hasVariants ?? false,
    useLotsAndExpirations: item.useLotsAndExpirations ?? false,
    sellInPos: item.sellInPos ?? true,
    includeInOnlineCatalog: item.includeInOnlineCatalog ?? true,
    requiresPrescription: item.requiresPrescription ?? false,
    chargeProductTaxes: item.chargeProductTaxes ?? true,
    variantStockTotal: item.variantStockTotal ?? null,
    variantCount: item.variantCount ?? null,
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
    type: item.type ?? 'PRODUCT',
    unit: item.unit ?? 'UNIDAD',
    ivaRate: item.ivaRate ?? 'IVA_16',
    iepsRate: item.iepsRate ?? 'NO_APLICA',
    purchaseCostMode: resolvePurchaseCostMode(item),
    purchaseNetCostCents: item.purchaseCost?.netCents ?? item.purchaseNetCostCents ?? 0,
    purchaseGrossCostCents: item.purchaseCost?.grossCents ?? item.purchaseGrossCostCents ?? 0,
  }
}

function mapPagination(meta: ProductPaginationMeta): PaginatedResponse<Product>['pagination'] {
  return {
    pageIndex: meta.page - 1,
    pageSize: meta.limit,
    totalCount: meta.total,
    pageCount: meta.totalPages,
  }
}

function applyLocalProductFilters(rows: Product[], params: ServerTableParams): Product[] {
  let filtered = [...rows]

  if (params.globalFilter) {
    const search = params.globalFilter.toLowerCase().trim()
    filtered = filtered.filter((row) => {
      return [row.name, row.sku ?? '', row.barcode ?? '', row.categoryName, row.brandName]
        .join(' ')
        .toLowerCase()
        .includes(search)
    })
  }

  if (params.sorting?.length) {
    const sort = params.sorting[0]

    if (sort) {
      filtered.sort((a, b) => {
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
  }

  return filtered
}

function isPaginatedProductResponse(
  response: ProductBackendListResponse | ProductBackendResponse[],
): response is ProductBackendListResponse {
  return !Array.isArray(response) && Array.isArray(response.data) && !!response.meta
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
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
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

function resolveSort(params: ServerTableParams) {
  const firstSort = params.sorting?.[0]
  if (!firstSort) return undefined

  const sortByMap: Record<string, string> = {
    categoryName: 'categoryId',
    brandName: 'brandId',
    priceCents: 'priceCents',
    quantity: 'quantity',
  }

  return {
    sortBy: sortByMap[firstSort.id] ?? firstSort.id,
    sortOrder: firstSort.desc ? 'desc' : 'asc',
  }
}

export const productApi = {
  async getPaginated(params: ServerTableParams): Promise<PaginatedResponse<Product>> {
    const page = params.pageIndex + 1
    const limit = params.pageSize
    const sort = resolveSort(params)

    const { data } = await http.get<ProductBackendListResponse | ProductBackendResponse[]>(
      '/products',
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
          ...sort,
        },
      },
    )

    if (isPaginatedProductResponse(data)) {
      return {
        data: data.data.map(mapProduct),
        pagination: mapPagination(data.meta),
      }
    }

    const rows = data.map(mapProduct)
    const filteredRows = applyLocalProductFilters(rows, params)
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

  async getById(productId: string): Promise<ProductDetail> {
    const { data } = await http.get<ProductBackendResponse>(`/products/${productId}`)
    return mapProductDetail(data)
  },

  async create(payload: CreateProductPayload): Promise<ProductDetail & { _raw?: Record<string, unknown> }> {
    const { data } = await http.post<ProductBackendResponse>('/products', payload)
    const mapped = mapProductDetail(data)
    // Preserve raw response for post-creation variant price updates
    return Object.assign(mapped, { _raw: data as unknown as Record<string, unknown> })
  },

  async update(productId: string, payload: UpdateProductPayload): Promise<ProductDetail> {
    const { data } = await http.patch<ProductBackendResponse>(`/products/${productId}`, payload)
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
      payload,
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
      payload,
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

  async uploadProductImage(productId: string, file: File): Promise<ProductImage> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await http.post<ProductImage>(
      `/products/${productId}/images/upload`,
      formData,
    )
    return data
  },

  async uploadVariantImage(
    productId: string,
    variantId: string,
    file: File,
  ): Promise<ProductImage> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await http.post<ProductImage>(
      `/products/${productId}/variants/${variantId}/images/upload`,
      formData,
    )
    return data
  },
}
