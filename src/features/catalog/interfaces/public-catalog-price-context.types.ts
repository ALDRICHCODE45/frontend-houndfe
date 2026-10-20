/** Public response contract for GET /public/catalog/:tenantSlug/price-contexts. */
export interface PublicCatalogPriceContextDto {
  priceListId: string
  name: string
  isCatalogDefault: boolean
}
