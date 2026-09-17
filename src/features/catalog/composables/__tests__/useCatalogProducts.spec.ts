import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogProductsQueryKey, useCatalogProducts } from '../useCatalogProducts'
import { fetchCatalogProducts } from '../../api/catalog-products.api'

vi.mock('../../api/catalog-products.api', () => ({ fetchCatalogProducts: vi.fn() }))
const fetchCatalogProductsMock = vi.mocked(fetchCatalogProducts)

const priceContext = { priceListId: 'list-1', name: 'Lista pública', isCatalogDefault: true }
const product = {
  id: 'product-1',
  name: 'Café molido',
  slug: null,
  description: null,
  category: { id: 'category-1', name: 'Café' },
  brand: { name: 'Tostadores' },
  image: { url: 'https://example.test/cafe.jpg' },
  price: { fromPriceCents: 2500, priceCents: 2500, hidden: false },
  availability: 'available' as const,
  stockPresentation: {
    mode: 'SYSTEM_STATUS' as const,
    status: 'available' as const,
    customQuantity: null,
  },
  hasVariants: false,
  rating: null,
  featuredLabel: null,
}

function page(items = [product]) {
  return {
    items,
    meta: { page: 1, limit: 20, total: items.length, totalPages: items.length === 0 ? 0 : 1 },
    facets: { categories: [] },
    excludedCount: 0,
    priceContext,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function mountHarness(initialSlug: string | null) {
  const tenantSlug = shallowRef<string | null>(initialSlug)
  let catalog: ReturnType<typeof useCatalogProducts>
  const Harness = defineComponent({
    setup: () => {
      catalog = useCatalogProducts(tenantSlug)
      return () => null
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return { catalog: () => catalog!, tenantSlug, wrapper, queryClient }
}

describe('useCatalogProducts', () => {
  beforeEach(() => fetchCatalogProductsMock.mockReset())

  it.each([[null], [''], ['   ']])(
    'keeps the query disabled and retry guarded without a valid selected tenant slug (%j)',
    async (slug) => {
      const { catalog } = mountHarness(slug)

      await flushPromises()
      expect(catalog().state.value).toBe('empty')
      expect(catalog().products.value).toEqual([])
      await catalog().retry()
      expect(fetchCatalogProductsMock).not.toHaveBeenCalled()
    },
  )

  it('uses tenant-specific keys, forwards TanStack cancellation, and exposes the populated response', async () => {
    fetchCatalogProductsMock.mockResolvedValue(page())
    const { catalog } = mountHarness('centro')

    expect(catalog().state.value).toBe('loading')
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(catalog().products.value).toEqual([product])
    expect(fetchCatalogProductsMock).toHaveBeenCalledWith('centro', expect.any(AbortSignal))
  })

  it('shows empty, rate-limit, server, and network states without automatic retries', async () => {
    fetchCatalogProductsMock
      .mockResolvedValueOnce(page([]))
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { kind: 'rate-limit' }))
      .mockRejectedValueOnce(Object.assign(new Error('server'), { kind: 'server' }))
      .mockRejectedValueOnce(Object.assign(new Error('network'), { kind: 'network' }))
    const { catalog } = mountHarness('centro')

    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('rate-limit')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('server')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('network')
    expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(4)
  })

  it('shows retry-pending and guards rapid manual retry clicks', async () => {
    fetchCatalogProductsMock.mockResolvedValueOnce(page([]))
    const pendingRetry = deferred<ReturnType<typeof page>>()
    fetchCatalogProductsMock.mockReturnValueOnce(pendingRetry.promise)
    const { catalog } = mountHarness('centro')

    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    void catalog().retry()
    void catalog().retry()
    void catalog().retry()
    expect(catalog().state.value).toBe('retry-pending')
    expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(2)
    pendingRetry.resolve(page())
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
  })

  it('clears prior tenant data during a slug switch and after clearing the selection', async () => {
    const centro = page([product])
    const norteProduct = { ...product, id: 'product-2', name: 'Té verde' }
    const norte = page([norteProduct])
    const pendingNorte = deferred<typeof norte>()
    fetchCatalogProductsMock.mockResolvedValueOnce(centro).mockReturnValueOnce(pendingNorte.promise)
    const { catalog, tenantSlug } = mountHarness('centro')

    await flushPromises()
    expect(catalog().products.value).toEqual(centro.items)
    tenantSlug.value = 'norte'
    await nextTick()
    expect(catalog().state.value).toBe('loading')
    expect(catalog().products.value).toEqual([])
    pendingNorte.resolve(norte)
    await flushPromises()
    expect(catalog().products.value).toEqual(norte.items)
    expect(catalogProductsQueryKey('centro')).not.toEqual(catalogProductsQueryKey('norte'))

    tenantSlug.value = null
    await nextTick()
    expect(catalog().state.value).toBe('empty')
    expect(catalog().products.value).toEqual([])
    expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(2)
  })

  it.each(['', '   '])(
    'clears populated products when the selection becomes invalid (%j)',
    async (invalidSlug) => {
      fetchCatalogProductsMock.mockResolvedValue(page())
      const { catalog, tenantSlug } = mountHarness('centro')

      await flushPromises()
      expect(catalog().products.value).toEqual([product])
      tenantSlug.value = invalidSlug
      await nextTick()
      expect(catalog().state.value).toBe('empty')
      expect(catalog().products.value).toEqual([])
      expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(1)
    },
  )
})
