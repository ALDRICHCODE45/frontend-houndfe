/** Public response contract for GET /public/catalog/:tenantSlug/price-contexts. */
export interface PublicCatalogPriceContextDto {
  priceListId: string
  name: string
  isCatalogDefault: boolean
}

/** Discovery responds with this exact top-level array of tenant-published contexts. */
export type PublicCatalogPriceContextsResponseDto = PublicCatalogPriceContextDto[]
