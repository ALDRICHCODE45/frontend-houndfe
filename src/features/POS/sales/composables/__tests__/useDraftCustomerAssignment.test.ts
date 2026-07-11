import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useDraftCustomerAssignment } from '../useDraftCustomerAssignment'
import type { Sale, SaleDraftCustomer } from '../../interfaces/sale.types'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    assignCustomer: vi.fn(),
    unassignCustomer: vi.fn(),
    assignShippingAddress: vi.fn(),
    unassignShippingAddress: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
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

// Shared fixture used by invalidation tests — matches the shape in the
// existing unassignCustomer / clearShippingAddress tests.
const stubShippingAddress = {
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

  it('assignCustomer updates drafts cache via setQueryData', async () => {
    const { composable, queryClient } = mountComposable('sale-1')
    const draftsKey = saleQueryKeys.drafts('tenant-1')
    
    // Seed cache with a draft that has no customer
    const draftWithoutCustomer = makeSale({ id: 'sale-1', customer: null })
    queryClient.setQueryData(draftsKey, [draftWithoutCustomer])
    
    // Mock API to return updated Sale with customer
    const customer: SaleDraftCustomer = { id: 'customer-1', firstName: 'Ada', lastName: null }
    const updatedSaleWithCustomer = makeSale({
      id: 'sale-1',
      customer
    })
    vi.mocked(saleApi.assignCustomer).mockResolvedValueOnce(updatedSaleWithCustomer)

    await composable.assignCustomer({ customerId: 'customer-1' })

    expect(saleApi.assignCustomer).toHaveBeenCalledWith('sale-1', { customerId: 'customer-1' })
    
    // Assert cache was updated with the returned Sale
    const cachedDrafts = queryClient.getQueryData<Sale[]>(draftsKey)
    expect(cachedDrafts).toHaveLength(1)
    expect(cachedDrafts?.[0]).toEqual(updatedSaleWithCustomer)
  })

  it('unassignCustomer clears customer AND shippingAddress from cache', async () => {
    const { composable, queryClient } = mountComposable('sale-1')
    const draftsKey = saleQueryKeys.drafts('tenant-1')
    
    // Seed cache with a draft that has customer and shipping
    const customer: SaleDraftCustomer = { id: 'customer-1', firstName: 'John', lastName: 'Doe' }
    const shippingAddress = {
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
    }
    queryClient.setQueryData(draftsKey, [makeSale({ id: 'sale-1', customer, shippingAddress })])

    await composable.unassignCustomer()

    expect(saleApi.unassignCustomer).toHaveBeenCalledWith('sale-1')
    
    // Assert cache was updated to remove both customer and shippingAddress
    const cachedDrafts = queryClient.getQueryData<Sale[]>(draftsKey)
    expect(cachedDrafts).toHaveLength(1)
    expect(cachedDrafts![0]!.customer).toBe(null)
    expect(cachedDrafts![0]!.shippingAddress).toBe(null)
  })

  it('setShippingAddress updates cache with returned Sale', async () => {
    const { composable, queryClient } = mountComposable('sale-1')
    const draftsKey = saleQueryKeys.drafts('tenant-1')
    
    // Seed cache with a draft that has customer but no shipping
    const customer: SaleDraftCustomer = { id: 'customer-1', firstName: 'John', lastName: 'Doe' }
    queryClient.setQueryData(draftsKey, [makeSale({ id: 'sale-1', customer, shippingAddress: null })])
    
    // Mock API to return updated Sale with shipping address
    const shippingAddress = {
      id: 'address-2',
      customerId: 'customer-1',
      street: 'Oak',
      exteriorNumber: '20',
      interiorNumber: null,
      zipCode: '64001',
      neighborhood: 'Norte',
      municipality: 'Monterrey',
      city: 'Monterrey',
      state: 'Nuevo León',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const updatedSaleWithShipping = makeSale({ id: 'sale-1', customer, shippingAddress })
    vi.mocked(saleApi.assignShippingAddress).mockResolvedValueOnce(updatedSaleWithShipping)

    await composable.setShippingAddress({ shippingAddressId: 'address-2' })

    expect(saleApi.assignShippingAddress).toHaveBeenCalledWith('sale-1', { shippingAddressId: 'address-2' })
    
    // Assert cache was updated with the returned Sale
    const cachedDrafts = queryClient.getQueryData<Sale[]>(draftsKey)
    expect(cachedDrafts).toHaveLength(1)
    expect(cachedDrafts?.[0]).toEqual(updatedSaleWithShipping)
  })

  it('clearShippingAddress only clears shippingAddress, preserves customer', async () => {
    const { composable, queryClient } = mountComposable('sale-1')
    const draftsKey = saleQueryKeys.drafts('tenant-1')
    
    // Seed cache with a draft that has customer and shipping
    const customer: SaleDraftCustomer = { id: 'customer-1', firstName: 'John', lastName: 'Doe' }
    const shippingAddress = {
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
    }
    queryClient.setQueryData(draftsKey, [makeSale({ id: 'sale-1', customer, shippingAddress })])

    await composable.clearShippingAddress()

    expect(saleApi.unassignShippingAddress).toHaveBeenCalledWith('sale-1')
    
    // Assert cache was updated to remove shippingAddress but preserve customer
    const cachedDrafts = queryClient.getQueryData<Sale[]>(draftsKey)
    expect(cachedDrafts).toHaveLength(1)
    expect(cachedDrafts![0]!.customer).toEqual(customer)
    expect(cachedDrafts![0]!.shippingAddress).toBe(null)
  })

  it('preserves current shippingAddress when preserveShipping=true', async () => {
    const { composable, queryClient } = mountComposable('sale-1')
    queryClient.setQueryData(saleQueryKeys.drafts('tenant-1'), [
      makeSale({
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
      }),
    ])

    await composable.assignCustomer({ customerId: 'customer-2', preserveShipping: true })

    expect(saleApi.assignCustomer).toHaveBeenCalledWith('sale-1', {
      customerId: 'customer-2',
      shippingAddressId: 'address-1',
    })
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

  // ────────────────────────────────────────────────────────────────────────
  // promotions-in-sale WARNING-1 remediation: customer-scoped promos depend
  // on the assigned customer + shipping address, so EVERY one of the 4
  // mutations onSuccess MUST invalidate applicable-promotions for the draft,
  // mirroring the useSalesDrafts pattern (helper that calls
  // `queryClient.invalidateQueries({ queryKey: saleQueryKeys.applicablePromotions(tenantId, draftId) })`).
  // Backed by client spec §5, §2.2, §5 line 51-54.
  // ────────────────────────────────────────────────────────────────────────
  describe('applicable-promotions invalidation on customer mutations', () => {
    const expectedApplicableKey = saleQueryKeys.applicablePromotions('tenant-1', 'sale-1')

    it('assignCustomer onSuccess invalidates applicable-promotions for the draft', async () => {
      const { composable, queryClient, invalidateQueries } = mountComposable('sale-1')
      queryClient.setQueryData(saleQueryKeys.drafts('tenant-1'), [makeSale({ id: 'sale-1' })])

      await composable.assignCustomer({ customerId: 'customer-1' })

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('unassignCustomer onSuccess invalidates applicable-promotions for the draft', async () => {
      const { composable, queryClient, invalidateQueries } = mountComposable('sale-1')
      queryClient.setQueryData(saleQueryKeys.drafts('tenant-1'), [
        makeSale({
          id: 'sale-1',
          customer: { id: 'customer-1', firstName: 'Ada', lastName: null },
          shippingAddress: stubShippingAddress,
        }),
      ])

      await composable.unassignCustomer()

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('setShippingAddress onSuccess invalidates applicable-promotions for the draft', async () => {
      const { composable, queryClient, invalidateQueries } = mountComposable('sale-1')
      queryClient.setQueryData(saleQueryKeys.drafts('tenant-1'), [
        makeSale({
          id: 'sale-1',
          customer: { id: 'customer-1', firstName: 'Ada', lastName: null },
          shippingAddress: null,
        }),
      ])

      await composable.setShippingAddress({ shippingAddressId: 'address-2' })

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('clearShippingAddress onSuccess invalidates applicable-promotions for the draft', async () => {
      const { composable, queryClient, invalidateQueries } = mountComposable('sale-1')
      queryClient.setQueryData(saleQueryKeys.drafts('tenant-1'), [
        makeSale({
          id: 'sale-1',
          customer: { id: 'customer-1', firstName: 'Ada', lastName: null },
          shippingAddress: stubShippingAddress,
        }),
      ])

      await composable.clearShippingAddress()

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })
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
