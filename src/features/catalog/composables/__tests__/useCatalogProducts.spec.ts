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

function mountHarnessWithPriceList(initialSlug: string | null, initialPriceListId: string | null) {
  const tenantSlug = shallowRef<string | null>(initialSlug)
  const priceListId = shallowRef<string | null>(initialPriceListId)
  let catalog: ReturnType<typeof useCatalogProducts>
  const Harness = defineComponent({
    setup: () => {
      catalog = useCatalogProducts(tenantSlug, priceListId)
      return () => null
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return { catalog: () => catalog!, tenantSlug, priceListId, queryClient }
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
    expect(fetchCatalogProductsMock).toHaveBeenCalledWith('centro', null, expect.any(AbortSignal))
  })

  it('keeps the resolved API base as an identity segment and marks the caller default with a sentinel', () => {
    // 'http://localhost:3000' is the resolved base when VITE_API_BASE_URL is unset in unit tests.
    expect(catalogProductsQueryKey('centro')).toEqual([
      'public-catalog',
      'products',
      'http://localhost:3000',
      'centro',
      ['default'],
    ])
    expect(catalogProductsQueryKey('centro', undefined)).toEqual(catalogProductsQueryKey('centro'))
    expect(catalogProductsQueryKey('centro', null)).toEqual(catalogProductsQueryKey('centro'))
    // A supplied string is explicit and identity-significant, even when malformed.
    expect(catalogProductsQueryKey('centro', '')).toEqual([
      'public-catalog',
      'products',
      'http://localhost:3000',
      'centro',
      ['explicit', ''],
    ])
    expect(catalogProductsQueryKey('centro', '   ')).toEqual([
      'public-catalog',
      'products',
      'http://localhost:3000',
      'centro',
      ['explicit', '   '],
    ])
    expect(catalogProductsQueryKey('centro', '')).not.toEqual(catalogProductsQueryKey('centro'))
    expect(catalogProductsQueryKey('centro', '   ')).not.toEqual(catalogProductsQueryKey('centro'))
    expect(catalogProductsQueryKey('centro', '')).not.toEqual(
      catalogProductsQueryKey('centro', '   '),
    )
  })

  it('forwards an explicit priceListId under an identity disjoint from the default sentinel', async () => {
    fetchCatalogProductsMock.mockResolvedValue(page())
    const { catalog } = mountHarnessWithPriceList('centro', 'list-mayoreo')

    expect(catalog().state.value).toBe('loading')
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(fetchCatalogProductsMock).toHaveBeenCalledWith(
      'centro',
      'list-mayoreo',
      expect.any(AbortSignal),
    )
    expect(catalogProductsQueryKey('centro', 'list-mayoreo')).not.toEqual(
      catalogProductsQueryKey('centro'),
    )
    // An id that spells the sentinel must still own a distinct identity.
    expect(catalogProductsQueryKey('centro', 'default')).not.toEqual(
      catalogProductsQueryKey('centro'),
    )
    expect(catalogProductsQueryKey('centro', 'explicit')).not.toEqual(
      catalogProductsQueryKey('centro', 'default'),
    )
  })

  it.each([[''], ['   ']])(
    'forwards an explicit malformed priceListId exactly as supplied instead of collapsing it to the caller default (%j)',
    async (priceListId) => {
      fetchCatalogProductsMock.mockResolvedValue(page())
      const { catalog } = mountHarnessWithPriceList('centro', priceListId)

      expect(catalog().state.value).toBe('loading')
      await flushPromises()
      expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(1)
      expect(fetchCatalogProductsMock).toHaveBeenCalledWith(
        'centro',
        priceListId,
        expect.any(AbortSignal),
      )
      expect(fetchCatalogProductsMock).not.toHaveBeenCalledWith(
        'centro',
        null,
        expect.any(AbortSignal),
      )
      expect(catalogProductsQueryKey('centro', priceListId)).not.toEqual(
        catalogProductsQueryKey('centro', null),
      )
    },
  )

  it('exposes the unavailable state for an unavailable context with a guarded manual retry', async () => {
    fetchCatalogProductsMock
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { kind: 'unavailable' }))
      .mockResolvedValueOnce(page())
    const { catalog } = mountHarness('centro')

    await flushPromises()
    expect(catalog().state.value).toBe('unavailable')
    expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(1)
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
  })

  it('discards the previous context products and refetches under a disjoint identity when the explicit id changes', async () => {
    const cachedDefaultPage = page()
    const mayoreoPage = page([{ ...product, id: 'product-2', name: 'Café mayoreo' }])
    const refreshedDefaultPage = page([{ ...product, name: 'Café molido actualizado' }])
    const pendingMayoreo = deferred<ReturnType<typeof page>>()
    fetchCatalogProductsMock
      .mockResolvedValueOnce(cachedDefaultPage)
      .mockReturnValueOnce(pendingMayoreo.promise)
      .mockResolvedValueOnce(refreshedDefaultPage)
    const { catalog, priceListId } = mountHarnessWithPriceList('centro', null)

    await flushPromises()
    expect(catalog().products.value).toEqual([product])
    priceListId.value = 'list-mayoreo'
    await nextTick()
    expect(catalog().state.value).toBe('loading')
    expect(catalog().products.value).toEqual([])
    pendingMayoreo.resolve(mayoreoPage)
    await flushPromises()
    expect(catalog().products.value).toEqual(mayoreoPage.items)
    expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(2)

    // Switching back restores the default identity. TanStack's collection timing decides whether
    // that key's cached default payload is still present, but the Mayoreo payload must never
    // surface under the default identity.
    priceListId.value = null
    await nextTick()
    expect(catalogProductsQueryKey('centro', null)).toEqual(catalogProductsQueryKey('centro'))
    expect(catalogProductsQueryKey('centro', 'list-mayoreo')).not.toEqual(
      catalogProductsQueryKey('centro', null),
    )
    expect(catalog().products.value).not.toEqual(mayoreoPage.items)
    expect(catalog().products.value.every((item) => item.id === product.id)).toBe(true)

    // The default identity still refetches and the fresh default response replaces the payload.
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(catalog().products.value).toEqual(refreshedDefaultPage.items)
    expect(catalog().products.value).not.toEqual(mayoreoPage.items)
    expect(fetchCatalogProductsMock).toHaveBeenCalledTimes(3)
    expect(fetchCatalogProductsMock).toHaveBeenLastCalledWith(
      'centro',
      null,
      expect.any(AbortSignal),
    )
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
