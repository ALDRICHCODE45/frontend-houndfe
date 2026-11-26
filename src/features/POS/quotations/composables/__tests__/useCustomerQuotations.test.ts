import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { PaginatedQuotations } from '../../interfaces/quotation.types'

const can = vi.hoisted(() => ({ read: true }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) => action === 'read' && subject === 'Quotation' && can.read,
  }),
}))

const list = vi.hoisted(() => vi.fn())
vi.mock('../../api/quotation.api', () => ({ quotationApi: { list } }))

import { useCustomerQuotations } from '../useCustomerQuotations'

const page = (): PaginatedQuotations => ({
  data: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
})

function harness(enabled = true) {
  const state = { result: undefined as ReturnType<typeof useCustomerQuotations> | undefined }
  const open = shallowRef(enabled)
  const Comp = defineComponent({
    setup() {
      state.result = useCustomerQuotations({ customerId: () => 'c-1', enabled: open })
      return () => h('div')
    },
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
  return { state, open, wrapper }
}

afterEach(() => {
  list.mockReset()
  can.read = true
})

// customers-module T4: the «Cotizaciones» tab — GET /quotations?customerId= (L3: supported).
describe('useCustomerQuotations', () => {
  it('lists the customer quotations newest first, one page at a time', async () => {
    list.mockResolvedValue(page())
    const { state } = harness()
    await flushPromises()
    expect(list).toHaveBeenCalledWith({
      customerId: 'c-1',
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
    expect(state.result!.response.value).toEqual(page())

    state.result!.page.value = 2
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ customerId: 'c-1', page: 2 }))
  })

  it('does not fetch until the tab is open', async () => {
    list.mockResolvedValue(page())
    const { open } = harness(false)
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
    open.value = true
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('does not fetch without read:Quotation', async () => {
    can.read = false
    const { state } = harness()
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
    expect(state.result!.canRead.value).toBe(false)
  })
})
