import { http } from '@/core/shared/api/http'
import type { AxiosError } from 'axios'
import type {
  Sale,
  AddItemPayload,
  UpdateQtyPayload,
  AvailablePricesResponse,
  OverrideItemPricePayload,
  ApplyItemDiscountPayload,
  ApplyGlobalDiscountPayload,
  GlobalDiscountResponse,
  PosCatalogResponse,
  PosCatalogSearchParams,
  PosProductDetail,
  ChargeSalePayload,
  ChargeSaleResponse,
  ListSalesParams,
  ConfirmedSalesListResponse,
  SaleDetail,
  DebtPaymentPayload,
  DebtPaymentResponse,
  AssignCustomerPayload,
  AssignShippingAddressPayload,
  SaleComment,
  SaleCommentErrorCode,
} from '../interfaces/sale.types'
import { SaleCommentError } from '../interfaces/sale.types'

interface DomainErrorResponse {
  error?: string
}

function parseCommentError(error: unknown): SaleCommentError | null {
  const code = (error as AxiosError<DomainErrorResponse>)?.response?.data?.error
  const knownCodes: SaleCommentErrorCode[] = ['COMMENT_NOT_FOUND', 'COMMENT_AUTHOR_FORBIDDEN', 'SALE_NOT_FOUND']
  if (code && knownCodes.includes(code as SaleCommentErrorCode)) {
    return new SaleCommentError(code as SaleCommentErrorCode)
  }
  return null
}

export const saleApi = {
  async createDraft(): Promise<Sale> {
    const { data } = await http.post<Sale>('/sales/drafts')
    return data
  },

  async listDrafts(): Promise<Sale[]> {
    const { data } = await http.get<Sale[]>('/sales/drafts')
    return data
  },

  async addItem(saleId: string, payload: AddItemPayload): Promise<Sale> {
    const { data } = await http.post<Sale>(`/sales/drafts/${saleId}/items`, payload)
    return data
  },

  async updateItemQty(saleId: string, itemId: string, payload: UpdateQtyPayload): Promise<Sale> {
    const { data } = await http.patch<Sale>(`/sales/drafts/${saleId}/items/${itemId}`, payload)
    return data
  },

  async getAvailablePrices(saleId: string, itemId: string): Promise<AvailablePricesResponse> {
    const { data } = await http.get<AvailablePricesResponse>(
      `/sales/drafts/${saleId}/items/${itemId}/available-prices`,
    )
    return data
  },

  async updateItemPrice(
    saleId: string,
    itemId: string,
    payload: OverrideItemPricePayload,
  ): Promise<Sale> {
    const { data } = await http.patch<Sale>(`/sales/drafts/${saleId}/items/${itemId}/price`, payload)
    return data
  },

  async applyItemDiscount(
    saleId: string,
    itemId: string,
    payload: ApplyItemDiscountPayload,
  ): Promise<Sale> {
    const { data } = await http.patch<Sale>(`/sales/drafts/${saleId}/items/${itemId}/discount`, payload)
    return data
  },

  async removeItemDiscount(saleId: string, itemId: string): Promise<Sale> {
    const { data } = await http.delete<Sale>(`/sales/drafts/${saleId}/items/${itemId}/discount`)
    return data
  },

  async removeItem(saleId: string, itemId: string): Promise<Sale> {
    const { data } = await http.delete<Sale>(`/sales/drafts/${saleId}/items/${itemId}`)
    return data
  },

  async clearItems(saleId: string): Promise<Sale> {
    const { data } = await http.delete<Sale>(`/sales/drafts/${saleId}/items`)
    return data
  },

  async closeDraft(saleId: string): Promise<void> {
    await http.delete(`/sales/drafts/${saleId}`)
  },

  async assignCustomer(saleId: string, payload: AssignCustomerPayload): Promise<Sale> {
    const { data } = await http.put<Sale>(`/sales/drafts/${saleId}/customer`, payload)
    return data
  },

  async unassignCustomer(saleId: string): Promise<void> {
    await http.delete(`/sales/drafts/${saleId}/customer`)
  },

  async assignShippingAddress(saleId: string, payload: AssignShippingAddressPayload): Promise<Sale> {
    const { data } = await http.put<Sale>(`/sales/drafts/${saleId}/shipping-address`, payload)
    return data
  },

  async unassignShippingAddress(saleId: string): Promise<void> {
    await http.delete(`/sales/drafts/${saleId}/shipping-address`)
  },

  async chargeDraft(
    saleId: string,
    payload: ChargeSalePayload,
    idempotencyKey: string,
  ): Promise<ChargeSaleResponse> {
    const { data } = await http.post<ChargeSaleResponse>(`/sales/drafts/${saleId}/charge`, payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    })
    return data
  },

  async registerDebtPayment(
    saleId: string,
    payload: DebtPaymentPayload,
    idempotencyKey: string,
  ): Promise<DebtPaymentResponse> {
    const { data } = await http.post<DebtPaymentResponse>(`/sales/${saleId}/payments`, payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    })
    return data
  },

  async applyGlobalDiscount(saleId: string, payload: ApplyGlobalDiscountPayload): Promise<GlobalDiscountResponse> {
    const { data } = await http.patch<GlobalDiscountResponse>(`/sales/drafts/${saleId}/discount`, payload)
    return data
  },

  async removeGlobalDiscount(saleId: string): Promise<Sale> {
    const { data } = await http.delete<Sale>(`/sales/drafts/${saleId}/discount`)
    return data
  },

  async getProductDetail(productId: string): Promise<PosProductDetail> {
    const { data } = await http.get<PosProductDetail>(`/sales/pos-catalog/${productId}`)
    return data
  },

  async searchPosCatalog(params: PosCatalogSearchParams): Promise<PosCatalogResponse> {
    const { data } = await http.get<PosCatalogResponse>('/sales/pos-catalog', { params })
    return data
  },

  async listConfirmed(params: ListSalesParams): Promise<ConfirmedSalesListResponse> {
    const { data } = await http.get<ConfirmedSalesListResponse>('/sales', { params })
    return data
  },

  async getById(id: string): Promise<SaleDetail> {
    const { data } = await http.get<SaleDetail>(`/sales/${id}`)
    return data
  },

  async addComment(saleId: string, payload: { body: string }): Promise<SaleComment> {
    try {
      const { data } = await http.post<SaleComment>(`/sales/${saleId}/comments`, payload)
      return data
    } catch (error) {
      throw parseCommentError(error) ?? error
    }
  },

  async updateComment(saleId: string, commentId: string, payload: { body: string }): Promise<SaleComment> {
    try {
      const { data } = await http.patch<SaleComment>(`/sales/${saleId}/comments/${commentId}`, payload)
      return data
    } catch (error) {
      throw parseCommentError(error) ?? error
    }
  },

  async deleteComment(saleId: string, commentId: string): Promise<void> {
    try {
      await http.delete(`/sales/${saleId}/comments/${commentId}`)
    } catch (error) {
      throw parseCommentError(error) ?? error
    }
  },
}
