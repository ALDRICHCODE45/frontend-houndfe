/** Handoff 27 §5.2: the line pet picker of a POS draft (active pets of the sale customer). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { saleApi } from '../../api/sale.api'
import { petApi } from '@/features/POS/customers/pets/pet.api'
import { makePet } from '@/features/POS/customers/pets/__tests__/pet.fixture'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useDraftLinePets } from '../useDraftLinePets'
import type { Sale, SaleItem } from '../../interfaces/sale.types'

const toastAdd = vi.hoisted(() => vi.fn())

vi.mock('../../api/sale.api', () => ({ saleApi: { setItemPet: vi.fn() } }))
vi.mock('@/features/POS/customers/pets/pet.api', () => ({ petApi: { list: vi.fn() } }))
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: () => true }),
}))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

const draftsKey = saleQueryKeys.drafts('tenant-1')

const line: SaleItem = {
  id: 'item-1',
  productId: 'prod-1',
  variantId: null,
  productName: 'Croquetas',
  variantName: null,
  quantity: 1,
  unitPriceCents: 10000,
  unitPriceCurrency: 'MXN',
  pet: null,
}

function makeDraft(items: SaleItem[] = [line]): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items,
    customer: { id: 'c1', firstName: 'Ana', lastName: 'Pérez' },
    shippingAddress: null,
    createdAt: '2026-11-23T10:00:00Z',
    updatedAt: '2026-11-23T10:00:00Z',
  }
}

function apiError(status: number, error: string) {
  return { response: { status, data: { statusCode: status, error, message: error } } }
}

function mountComposable(customerId: string | null = 'c1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  queryClient.setQueryData(draftsKey, [makeDraft()])
  const customer = ref<string | null>(customerId)
  let result!: ReturnType<typeof useDraftLinePets>
  mount(
    defineComponent({
      setup() {
        result = useDraftLinePets(
          () => 'sale-1',
          () => customer.value,
        )
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return { result, queryClient, customer }
}

describe('useDraftLinePets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(petApi.list).mockResolvedValue([makePet({ id: 'p1', name: 'Bruno' })])
  })

  it('lists the ACTIVE pets of the sale customer', async () => {
    const { result } = mountComposable()

    await vi.waitFor(() => expect(result.pets.value.map((pet) => pet.name)).toEqual(['Bruno']))
    expect(petApi.list).toHaveBeenCalledWith('c1', 'ACTIVE')
  })

  it('without a customer it asks for no pets and offers none', async () => {
    const { result } = mountComposable(null)

    await Promise.resolve()
    expect(petApi.list).not.toHaveBeenCalled()
    expect(result.pets.value).toEqual([])
  })

  it('setLinePet PUTs the pet and replaces the draft from the response', async () => {
    const pet = { id: 'p1', name: 'Bruno', species: 'DOG' as const, status: 'ACTIVE' as const }
    vi.mocked(saleApi.setItemPet).mockResolvedValue(makeDraft([{ ...line, pet }]))
    const { result, queryClient } = mountComposable()

    await expect(result.setLinePet('item-1', 'p1')).resolves.toBe(true)

    expect(saleApi.setItemPet).toHaveBeenCalledWith('sale-1', 'item-1', { petId: 'p1' })
    expect(queryClient.getQueryData<Sale[]>(draftsKey)?.[0]?.items[0]?.pet).toEqual(pet)
  })

  it('«Sin mascota» sends petId null', async () => {
    vi.mocked(saleApi.setItemPet).mockResolvedValue(makeDraft())
    const { result } = mountComposable()

    await result.setLinePet('item-1', null)

    expect(saleApi.setItemPet).toHaveBeenCalledWith('sale-1', 'item-1', { petId: null })
  })

  it('PET_ARCHIVED: Spanish message, draft unchanged and the pets list refetched', async () => {
    vi.mocked(saleApi.setItemPet).mockRejectedValue(apiError(422, 'PET_ARCHIVED'))
    const { result, queryClient } = mountComposable()
    await vi.waitFor(() => expect(petApi.list).toHaveBeenCalledTimes(1))

    await expect(result.setLinePet('item-1', 'p1')).resolves.toBe(false)

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Esa mascota está archivada. Actualizamos la lista.',
        color: 'error',
      }),
    )
    expect(queryClient.getQueryData<Sale[]>(draftsKey)).toEqual([makeDraft()])
    await vi.waitFor(() => expect(petApi.list).toHaveBeenCalledTimes(2))
  })

  it('SALE_ITEM_NOT_FOUND: Spanish message, draft unchanged, pets not refetched', async () => {
    vi.mocked(saleApi.setItemPet).mockRejectedValue(apiError(422, 'SALE_ITEM_NOT_FOUND'))
    const { result, queryClient } = mountComposable()
    await vi.waitFor(() => expect(petApi.list).toHaveBeenCalledTimes(1))

    await expect(result.setLinePet('item-1', 'p1')).resolves.toBe(false)

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Ese producto ya no está en la venta. Recarga la venta.',
      }),
    )
    expect(queryClient.getQueryData<Sale[]>(draftsKey)).toEqual([makeDraft()])
    expect(petApi.list).toHaveBeenCalledTimes(1)
  })
})
