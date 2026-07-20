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
  AssignSellerPayload,
  SetDueDatePayload,
  SaleComment,
  SaleCommentErrorCode,
  ListApplicablePromotionsResponse,
} from '../interfaces/sale.types'
import { SaleCommentError } from '../interfaces/sale.types'

interface DomainErrorResponse {
  error?: string
}

export type SalePdfFormat = 'receipt-a4' | 'receipt-ticket'

export type SalePdfErrorCode =
  | 'INVALID_FORMAT'
  | 'SALE_NOT_CONFIRMED'
  | 'PDF_GENERATION_FAILED'

export class SalePdfError extends Error {
  readonly code: SalePdfErrorCode
  constructor(code: SalePdfErrorCode) {
    super(code)
    this.code = code
    this.name = 'SalePdfError'
  }
}

async function parsePdfError(error: unknown): Promise<SalePdfError | null> {
  const data = (error as AxiosError)?.response?.data
  if (!(data instanceof Blob)) return null
  const knownCodes: SalePdfErrorCode[] = [
    'INVALID_FORMAT',
    'SALE_NOT_CONFIRMED',
    'PDF_GENERATION_FAILED',
  ]
  try {
    const text = await data.text()
    const parsed = JSON.parse(text) as DomainErrorResponse
    const code = parsed.error
    if (code && knownCodes.includes(code as SalePdfErrorCode)) {
      return new SalePdfError(code as SalePdfErrorCode)
    }
  } catch {
    return null
  }
  return null
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

  async assignSeller(saleId: string, payload: AssignSellerPayload): Promise<SaleDetail> {
    const { data } = await http.put<SaleDetail>(`/sales/${saleId}/seller`, payload)
    return data
  },

  async unassignSeller(saleId: string): Promise<void> {
    await http.delete(`/sales/${saleId}/seller`)
  },

  async setDueDate(saleId: string, payload: SetDueDatePayload): Promise<SaleDetail> {
    const { data } = await http.patch<SaleDetail>(`/sales/${saleId}/due-date`, payload)
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

  // promotions-in-sale: 4 promotion endpoints (per design §9 / backend contract §3).
  // All guarded by `update:Sale`; the backend owns eligibility, best-wins, discount math.

  /** GET /sales/drafts/:saleId/applicable-promotions → list of MANUAL promos the
   * seller can opt into on this draft. Read-only — does NOT mutate the draft. */
  async listApplicablePromotions(saleId: string): Promise<ListApplicablePromotionsResponse> {
    const { data } = await http.get<ListApplicablePromotionsResponse>(
      `/sales/drafts/${saleId}/applicable-promotions`,
    )
    return data
  },

  /** POST /sales/drafts/:saleId/manual-promotions/:promotionId body={}
   * → opt-in (also un-vetoes if previously vetoed). Returns updated Sale. */
  async applyManualPromotion(saleId: string, promotionId: string): Promise<Sale> {
    const { data } = await http.post<Sale>(
      `/sales/drafts/${saleId}/manual-promotions/${promotionId}`,
      {},
    )
    return data
  },

  /** DELETE /sales/drafts/:saleId/manual-promotions/:promotionId
   * → remove a manual opt-in. Idempotent. Returns updated Sale. */
  async removeManualPromotion(saleId: string, promotionId: string): Promise<Sale> {
    const { data } = await http.delete<Sale>(
      `/sales/drafts/${saleId}/manual-promotions/${promotionId}`,
    )
    return data
  },

  /** DELETE /sales/drafts/:saleId/promotions/:promotionId
   * → veto a previously AUTO-applied promotion. Sticky per draft. Idempotent.
   * Same endpoint is used for both per-line and order-level vetoes. */
  async vetoAutoPromotion(saleId: string, promotionId: string): Promise<Sale> {
    const { data } = await http.delete<Sale>(`/sales/drafts/${saleId}/promotions/${promotionId}`)
    return data
  },

  // pos-price-list-tiers: assign (or clear) the global price list on a draft.
  // Backend reprices all non-sticky lines on success. `null` payload clears
  // the assignment (reverts items to default pricing).
  async setPriceList(
    saleId: string,
    payload: { globalPriceListId: string | null },
  ): Promise<Sale> {
    const { data } = await http.put<Sale>(`/sales/drafts/${saleId}/price-list`, payload)
    return data
  },

  // sales-pdf-download: download the PDF receipt for a confirmed sale.
  // The backend returns a binary Blob with Content-Disposition; errors come
  // back as a Blob too (responseType: 'blob' covers both). Domain error
  // codes (INVALID_FORMAT, SALE_NOT_CONFIRMED, PDF_GENERATION_FAILED) are
  // surfaced as `SalePdfError`; everything else (network failures, unknown
  // codes) rethrows the original axios error for the caller to handle.
  async getPdfBlob(saleId: string, format: SalePdfFormat): Promise<Blob> {
    try {
      const { data } = await http.get<Blob>(`/sales/${saleId}/pdf`, {
        params: { format },
        responseType: 'blob',
      })
      return data
    } catch (error) {
      throw (await parsePdfError(error)) ?? error
    }
  },
}
