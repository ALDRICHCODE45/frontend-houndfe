// odd T3b / S5 — the stored suppressedPromotions of a draft follow the draft's life: applying one
// (POST …/manual-promotions/:promotionId clears the veto) drops it; charging or discarding the
// draft drops the whole list; a failed call keeps it.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { saleApi } from '../sale.api'
import {
  readSuppressedPromotions,
  rememberSuppressedPromotions,
} from '../../composables/useSuppressedPromotions'

vi.mock('@/core/shared/api/http', () => ({
  http: { post: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

const sale = { id: 'sale-1', userId: 'u-1', status: 'DRAFT', items: [] }

describe('saleApi × suppressed promotions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    rememberSuppressedPromotions('sale-1', [
      { promotionId: 'promo-a', title: 'Orden auto' },
      { promotionId: 'promo-b', title: null },
    ])
  })

  it('applyManualPromotion re-enables through POST …/manual-promotions/:id and drops that one', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: sale })

    await saleApi.applyManualPromotion('sale-1', 'promo-a')

    expect(http.post).toHaveBeenCalledWith('/sales/drafts/sale-1/manual-promotions/promo-a', {})
    expect(readSuppressedPromotions('sale-1')).toEqual([{ promotionId: 'promo-b', title: null }])
  })

  it('keeps the list when applying fails', async () => {
    vi.mocked(http.post).mockRejectedValue(new Error('403'))

    await expect(saleApi.applyManualPromotion('sale-1', 'promo-a')).rejects.toThrow('403')

    expect(readSuppressedPromotions('sale-1')).toHaveLength(2)
  })

  it('chargeDraft clears the list of the charged sale', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { sale } })

    await saleApi.chargeDraft('sale-1', { payments: [] } as never, 'key-1')

    expect(readSuppressedPromotions('sale-1')).toEqual([])
  })

  it('closeDraft (discard) clears the list of the discarded sale', async () => {
    vi.mocked(http.delete).mockResolvedValue({ data: undefined })

    await saleApi.closeDraft('sale-1')

    expect(readSuppressedPromotions('sale-1')).toEqual([])
  })

  it('a failed charge keeps the list', async () => {
    vi.mocked(http.post).mockRejectedValue(new Error('422'))

    await expect(saleApi.chargeDraft('sale-1', { payments: [] } as never, 'k')).rejects.toThrow()

    expect(readSuppressedPromotions('sale-1')).toHaveLength(2)
  })
})
