import { http } from '@/core/shared/api/http'
import type { Sale, AddItemPayload, UpdateQtyPayload } from '../interfaces/sale.types'

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

  async clearItems(saleId: string): Promise<Sale> {
    const { data } = await http.delete<Sale>(`/sales/drafts/${saleId}/items`)
    return data
  },

  async closeDraft(saleId: string): Promise<void> {
    await http.delete(`/sales/drafts/${saleId}`)
  },
}
