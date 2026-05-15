import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useDraftCustomerAssignment } from '../useDraftCustomerAssignment'
import type { Sale } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    assignCustomer: vi.fn(),
    unassignCustomer: vi.fn(),
    assignShippingAddress: vi.fn(),
    unassignShippingAddress: vi.fn(),
  },
}))

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [],
    customer: null,
    shippingAddress: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mountComposable(saleId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useDraftCustomerAssignment> | undefined

  const TestComponent = defineComponent({
    setup() {
      const maybeSaleId = computed(() => saleId)
      result = useDraftCustomerAssignment(maybeSaleId)
      return () => h('div')
    },
  })

  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { composable: result!, queryClient, invalidateQueries }
}

describe('useDraftCustomerAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.assignCustomer).mockResolvedValue(makeSale())
    vi.mocked(saleApi.unassignCustomer).mockResolvedValue(undefined)
    vi.mocked(saleApi.assignShippingAddress).mockResolvedValue(makeSale())
    vi.mocked(saleApi.unassignShippingAddress).mockResolvedValue(undefined)
  })

  it('assignCustomer invalidates sale-draft query key', async () => {
    const { composable, invalidateQueries } = mountComposable('sale-1')

    await composable.assignCustomer({ customerId: 'customer-1' })

    expect(saleApi.assignCustomer).toHaveBeenCalledWith('sale-1', { customerId: 'customer-1' })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sale-draft', 'sale-1'] })
  })

  it('preserves current shippingAddress when preserveShipping=true', async () => {
    const { composable, queryClient } = mountComposable('sale-1')
    queryClient.setQueryData(['sale-draft', 'sale-1'], makeSale({
      shippingAddress: {
        id: 'address-1',
        customerId: 'customer-1',
        street: 'Main',
        exteriorNumber: '10',
        interiorNumber: null,
        zipCode: '64000',
        neighborhood: 'Centro',
        municipality: 'Monterrey',
        city: 'Monterrey',
        state: 'Nuevo León',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }))

    await composable.assignCustomer({ customerId: 'customer-2', preserveShipping: true })

    expect(saleApi.assignCustomer).toHaveBeenCalledWith('sale-1', {
      customerId: 'customer-2',
      shippingAddressId: 'address-1',
    })
  })

  it('setShippingAddress and clearShippingAddress call API and invalidate', async () => {
    const { composable, invalidateQueries } = mountComposable('sale-1')

    await composable.setShippingAddress({ shippingAddressId: 'address-2' })
    await composable.clearShippingAddress()

    expect(saleApi.assignShippingAddress).toHaveBeenCalledWith('sale-1', { shippingAddressId: 'address-2' })
    expect(saleApi.unassignShippingAddress).toHaveBeenCalledWith('sale-1')
    expect(invalidateQueries).toHaveBeenCalledTimes(2)
  })

  it('maps backend domain errors to typed lastError', async () => {
    const { composable } = mountComposable('sale-1')
    const codes = [
      'CUSTOMER_NOT_FOUND',
      'SHIPPING_ADDRESS_NOT_FOUND',
      'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER',
      'SHIPPING_ADDRESS_REQUIRES_CUSTOMER',
      'SALE_NOT_DRAFT',
      'SALE_UPDATE_FORBIDDEN',
    ] as const

    for (const code of codes) {
      vi.mocked(saleApi.assignCustomer).mockRejectedValueOnce({ response: { data: { error: code } } })

      await expect(composable.assignCustomer({ customerId: 'customer-1' })).rejects.toMatchObject({ code })
      expect(composable.lastError.value?.code).toBe(code)
    }
  })

  it('isPending toggles while request is in flight', async () => {
    const { composable } = mountComposable('sale-1')
    let resolvePromise: ((value: Sale) => void) | null = null
    vi.mocked(saleApi.assignCustomer).mockImplementationOnce(
      () =>
        new Promise<Sale>((resolve) => {
          resolvePromise = resolve
        }),
    )

    const promise = composable.assignCustomer({ customerId: 'customer-1' })
    await Promise.resolve()
    expect(composable.isPending.value).toBe(true)

    if (!resolvePromise) {
      throw new Error('Expected pending promise resolver to be set')
    }
    ;(resolvePromise as (value: Sale) => void)(makeSale())
    await promise

    expect(composable.isPending.value).toBe(false)
  })
})
