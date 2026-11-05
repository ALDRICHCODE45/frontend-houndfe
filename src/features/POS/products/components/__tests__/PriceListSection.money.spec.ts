/**
 * T22 — PriceListSection saves a list price only when the typed text reads as
 * an amount (parseMoneyInput), with the exact cents in the PATCH.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import PriceListSection from '../PriceListSection.vue'
import type { PriceList } from '../../interfaces/product.types'

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({ currentTenantId: 'tenant-1' })),
}))

const lists: PriceList[] = [
  {
    id: 'pl-publico',
    productId: 'p1',
    name: 'PUBLICO',
    priceCents: 10000,
    tierPrices: [],
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
  },
]

const apiMocks = vi.hoisted(() => ({ getPriceLists: vi.fn(), updatePriceList: vi.fn() }))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      getPriceLists: apiMocks.getPriceLists,
      updatePriceList: apiMocks.updatePriceList,
    },
  }
})

let queryClient: QueryClient
let root: VueWrapper | undefined

async function mountSection() {
  root = mount(
    defineComponent({
      render: () =>
        h(UApp, null, {
          default: () =>
            h(PriceListSection as Component, { productId: 'p1', canUpdate: true, canDelete: true }),
        }),
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] }, attachTo: document.body },
  )
  await flushPromises()
}

const priceInput = () =>
  new DOMWrapper(document.querySelector<HTMLInputElement>('input[aria-label^="Precio de venta de PUBLICO"]')!)

async function typeAndLeave(text: string) {
  const input = priceInput()
  await input.setValue(text)
  await input.trigger('blur')
  await flushPromises()
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  apiMocks.getPriceLists.mockReset().mockResolvedValue(lists)
  apiMocks.updatePriceList.mockReset().mockResolvedValue({})
  mockToast.add.mockClear()
})

afterEach(() => {
  root?.unmount()
  root = undefined
  document.body.innerHTML = ''
  queryClient.clear()
})

describe('PriceListSection — inline price', () => {
  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
  ])('saves %j as %i cents', async (text, cents) => {
    await mountSection()
    await typeAndLeave(text)
    expect(apiMocks.updatePriceList).toHaveBeenCalledWith('p1', 'pl-publico', { priceCents: cents })
  })

  it.each([
    ['12abc', 'Escribe solo el monto en números, por ejemplo 70.55.'],
    ['', 'Escribe el monto.'],
  ])('sends nothing for %j and shows the error', async (text, message) => {
    await mountSection()
    await typeAndLeave(text)
    expect(apiMocks.updatePriceList).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(message)
  })
})
