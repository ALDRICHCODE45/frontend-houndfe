import { http } from '@/core/shared/api/http'
import type {
  PackagingBody,
  ProductPackagingResponse,
  VariantPackagingResponse,
} from '../interfaces/product-packaging.types'

// PUT is a whole-record replace and an unknown key is a 400, so only the four
// fields ever go on the wire.
function toBody(body: PackagingBody): PackagingBody {
  return {
    weightG: body.weightG,
    lengthCm: body.lengthCm,
    widthCm: body.widthCm,
    heightCm: body.heightCm,
  }
}

const productPath = (productId: string) => `/products/${productId}/packaging`
const variantPath = (productId: string, variantId: string) =>
  `/products/${productId}/variants/${variantId}/packaging`

export const productPackagingApi = {
  async getProduct(productId: string): Promise<ProductPackagingResponse> {
    const { data } = await http.get<ProductPackagingResponse>(productPath(productId))
    return data
  },

  async putProduct(productId: string, body: PackagingBody): Promise<ProductPackagingResponse> {
    const { data } = await http.put<ProductPackagingResponse>(productPath(productId), toBody(body))
    return data
  },

  async removeProduct(productId: string): Promise<void> {
    await http.delete(productPath(productId))
  },

  async getVariant(productId: string, variantId: string): Promise<VariantPackagingResponse> {
    const { data } = await http.get<VariantPackagingResponse>(variantPath(productId, variantId))
    return data
  },

  async putVariant(
    productId: string,
    variantId: string,
    body: PackagingBody,
  ): Promise<VariantPackagingResponse> {
    const { data } = await http.put<VariantPackagingResponse>(
      variantPath(productId, variantId),
      toBody(body),
    )
    return data
  },

  /** Back to inheriting the product record (204, idempotent). */
  async removeVariant(productId: string, variantId: string): Promise<void> {
    await http.delete(variantPath(productId, variantId))
  },
}
