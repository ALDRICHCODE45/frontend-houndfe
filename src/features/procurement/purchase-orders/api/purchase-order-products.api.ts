import { http } from '@/core/shared/api/http'

export interface OrderPickerProduct {
  id: string
  name: string
  type: string
  unit: string | null
  hasVariants: boolean
  useStock: boolean
}
export interface OrderPickerVariant {
  id: string
  name: string
}
export interface OrderProductListInput {
  search: string
  page: number
  limit: number
}

export const purchaseOrderProductsApi = {
  async list(input: OrderProductListInput, signal?: AbortSignal): Promise<OrderPickerProduct[]> {
    const { search, page, limit } = input
    const response = await http.get<OrderPickerProduct[]>('/products', {
      params: { search, type: 'PRODUCT', page, limit }, signal,
    })
    return response.data.map(({ id, name, type, unit, hasVariants, useStock }) => ({ id, name, type, unit, hasVariants, useStock }))
  },
  async variants(productId: string, signal?: AbortSignal): Promise<OrderPickerVariant[]> {
    const response = await http.get<OrderPickerVariant[]>('/products/' + encodeURIComponent(productId) + '/variants', { signal })
    return response.data.map(({ id, name }) => ({ id, name }))
  },
}
