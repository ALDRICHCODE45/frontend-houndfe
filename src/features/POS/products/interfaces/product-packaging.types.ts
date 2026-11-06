/**
 * Packaging of a product or variant: the packed item as handed to a carrier
 * (shipping handoff §4). Weight in integer grams, outer size in centimetres
 * with at most one decimal. Not the editorial net weight.
 */
export interface PackagingBody {
  weightG: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export interface PackagingRecord extends PackagingBody {
  updatedAt: string
}

export type PackagingField = keyof PackagingBody

/** GET / PUT /products/:productId/packaging (`packaging: null` until it is set). */
export interface ProductPackagingResponse {
  productId: string
  packaging: PackagingRecord | null
}

/** VARIANT: own record · PRODUCT: inherits · null: no data anywhere (`effective` is null). */
export type PackagingSource = 'VARIANT' | 'PRODUCT' | null

/** GET / PUT /products/:productId/variants/:variantId/packaging (whole-record override). */
export interface VariantPackagingResponse {
  productId: string
  variantId: string
  override: PackagingRecord | null
  productPackaging: PackagingRecord | null
  effective: PackagingRecord | null
  source: PackagingSource
}
