/** Handoff 27 §5.3: changing or removing the draft customer clears the line pets. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useDraftCustomerAssignment } from '../useDraftCustomerAssignment'
import type { Sale, SaleItem } from '../../interfaces/sale.types'

const toastAdd = vi.hoisted(() => vi.fn())

vi.mock('../../api/sale.api', () => ({
  saleApi: { assignCustomer: vi.fn(), unassignCustomer: vi.fn() },
}))
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

const draftsKey = saleQueryKeys.drafts('tenant-1')
const NOTICE = 'Se quitaron las mascotas de las líneas porque cambió el cliente'

const petLine: SaleItem = {
  id: 'item-1',
  productId: 'prod-1',
  variantId: null,
  productName: 'Croquetas',
  variantName: null,
  quantity: 1,
  unitPriceCents: 10000,
  unitPriceCurrency: 'MXN',
  pet: { id: 'p1', name: 'Bruno', species: 'DOG', status: 'ACTIVE' },
}

function makeDraft(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [petLine],
    customer: { id: 'c1', firstName: 'Ana', lastName: 'Pérez' },
    shippingAddress: null,
    createdAt: '2026-11-23T10:00:00Z',
    updatedAt: '2026-11-23T10:00:00Z',
    ...overrides,
  }
}

function mountComposable() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  queryClient.setQueryData(draftsKey, [makeDraft()])
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  let result!: ReturnType<typeof useDraftCustomerAssignment>
  mount(
    defineComponent({
      setup() {
        result = useDraftCustomerAssignment(() => 'sale-1')
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return { result, queryClient, invalidate }
}

describe('useDraftCustomerAssignment — line pets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the notice when the new customer cleared the line pets', async () => {
    const cleared = makeDraft({
      customer: { id: 'c2', firstName: 'Luis', lastName: null },
      items: [{ ...petLine, pet: null }],
    })
    vi.mocked(saleApi.assignCustomer).mockResolvedValue({ ...cleared, petsCleared: true })
    const { result, queryClient } = mountComposable()

    await result.assignCustomer({ customerId: 'c2' })

    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: NOTICE }))
    const cached = queryClient.getQueryData<Sale[]>(draftsKey)?.[0]
    expect(cached?.items[0]?.pet).toBeNull()
    expect(cached).not.toHaveProperty('petsCleared')
  })

  it('a customer change without pets on the lines shows no notice', async () => {
    vi.mocked(saleApi.assignCustomer).mockResolvedValue({ ...makeDraft(), petsCleared: false })
    const { result } = mountComposable()

    await result.assignCustomer({ customerId: 'c1' })

    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('removing the customer (204) clears the line pets and refetches the draft', async () => {
    vi.mocked(saleApi.unassignCustomer).mockResolvedValue(undefined)
    const { result, queryClient, invalidate } = mountComposable()

    await result.unassignCustomer()

    const cached = queryClient.getQueryData<Sale[]>(draftsKey)?.[0]
    expect(cached?.customer).toBeNull()
    expect(cached?.items[0]?.pet).toBeNull()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: draftsKey })
  })
})
