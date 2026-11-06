/**
 * PriceListSection states: a failed read says so with a retry (never «Sin listas»),
 * an unknown margin reads «—», and each figure cell carries its label for the
 * stacked phone layout.
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
    id: 'pl-mayoreo',
    productId: 'p1',
    name: 'Mayoreo',
    priceCents: 0,
    tierPrices: [],
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
  },
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

describe('PriceListSection — states', () => {
  it('says the lists did not load, with a retry that reads them again', async () => {
    apiMocks.getPriceLists.mockReset().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(lists)
    await mountSection()
    const state = document.querySelector<HTMLElement>('.hf-empty-state[data-kind="error"]')
    expect(state?.textContent).toContain('No se pudieron cargar los precios')
    expect(document.body.textContent).not.toContain('Sin listas de precios registradas.')
    state!.querySelector('button')!.click()
    await flushPromises()
    expect(apiMocks.getPriceLists).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('PUBLICO')
  })

  it('reads «—» where the margin is not known yet', async () => {
    await mountSection()
    const row = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes('Mayoreo'))!
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent?.trim())
    expect(cells).toContain('—')
    expect(row.textContent).not.toContain('--')
  })

  it('labels each figure cell so a row can stack as a card on a phone', async () => {
    await mountSection()
    expect(document.querySelector('table')!.hasAttribute('data-stack')).toBe(true)
    const row = document.querySelector('tbody tr')!
    const labels = [...row.querySelectorAll('td[data-label]')].map((td) => td.getAttribute('data-label'))
    expect(labels).toEqual(['Precio de venta con impuestos', 'Margen', 'Ganancia'])
  })
})
