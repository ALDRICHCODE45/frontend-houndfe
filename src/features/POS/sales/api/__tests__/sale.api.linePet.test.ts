/** Handoff 27 §5: the pet of a sale line (POS drafts). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saleApi } from '../sale.api'
import { http } from '@/core/shared/api/http'
import type { Sale } from '../../interfaces/sale.types'

vi.mock('@/core/shared/api/http', () => ({
  http: { post: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const draft: Sale = {
  id: 'sale-1',
  userId: 'user-1',
  status: 'DRAFT',
  items: [],
  createdAt: '2026-11-23T10:00:00Z',
  updatedAt: '2026-11-23T10:00:00Z',
}

describe('saleApi — pet on sale lines', () => {
  beforeEach(() => vi.clearAllMocks())

  it('setItemPet PUTs the pet of one line and returns the draft', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: draft })

    const result = await saleApi.setItemPet('sale-1', 'item-1', { petId: 'pet-1' })

    expect(http.put).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/pet', {
      petId: 'pet-1',
    })
    expect(result).toEqual(draft)
  })

  it('setItemPet sends petId null to clear the pet', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: draft })

    await saleApi.setItemPet('sale-1', 'item-1', { petId: null })

    expect(http.put).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/pet', {
      petId: null,
    })
  })

  it('assignCustomer returns petsCleared from the response', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: { ...draft, petsCleared: true } })

    const result = await saleApi.assignCustomer('sale-1', { customerId: 'c-2' })

    expect(result.petsCleared).toBe(true)
  })

  it('assignCustomer reads a response without petsCleared as false', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: draft })

    const result = await saleApi.assignCustomer('sale-1', { customerId: 'c-2' })

    expect(result.petsCleared).toBe(false)
  })
})
