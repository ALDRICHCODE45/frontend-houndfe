/** Handoff 27 §5.1: `petId` on add item is optional; absent keeps the line's pet. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSalesDrafts } from '../useSalesDrafts'
import type { Sale } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({ saleApi: { listDrafts: vi.fn(), addItem: vi.fn() } }))
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

const draft: Sale = {
  id: 'sale-1',
  userId: 'user-1',
  status: 'DRAFT',
  items: [],
  createdAt: '2026-11-23T10:00:00Z',
  updatedAt: '2026-11-23T10:00:00Z',
}

async function setup() {
  vi.mocked(saleApi.listDrafts).mockResolvedValue([draft])
  vi.mocked(saleApi.addItem).mockResolvedValue(draft)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  let result!: ReturnType<typeof useSalesDrafts>
  mount(
    defineComponent({
      setup() {
        result = useSalesDrafts()
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  await vi.waitFor(() =>
    expect(queryClient.getQueryData(saleQueryKeys.drafts('tenant-1'))).toEqual([draft]),
  )
  result.activeTabId.value = 'sale-1'
  return result
}

describe('useSalesDrafts — addItem petId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adding an item without a pet sends no petId', async () => {
    const result = await setup()

    await result.addItem('prod-1', null, 1)

    const payload = vi.mocked(saleApi.addItem).mock.calls[0]?.[1]
    expect(payload).toEqual({ productId: 'prod-1', variantId: null, quantity: 1 })
    expect(payload).not.toHaveProperty('petId')
  })

  it('adding an item for a pet sends its petId', async () => {
    const result = await setup()

    await result.addItem('prod-1', null, 1, 'pet-1')

    expect(saleApi.addItem).toHaveBeenCalledWith('sale-1', {
      productId: 'prod-1',
      variantId: null,
      quantity: 1,
      petId: 'pet-1',
    })
  })
})
