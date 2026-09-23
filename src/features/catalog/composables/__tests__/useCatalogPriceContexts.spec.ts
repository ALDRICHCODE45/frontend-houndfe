import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogPriceContextsQueryKey, useCatalogPriceContexts } from '../useCatalogPriceContexts'
import { fetchCatalogPriceContexts } from '../../api/catalog-price-contexts.api'

vi.mock('../../api/catalog-price-contexts.api', () => ({ fetchCatalogPriceContexts: vi.fn() }))
const fetchCatalogPriceContextsMock = vi.mocked(fetchCatalogPriceContexts)

const catalogDefault = {
  priceListId: 'price-list-publico',
  name: 'Público',
  isCatalogDefault: true,
}
const mayoreo = { priceListId: 'price-list-mayoreo', name: 'Mayoreo', isCatalogDefault: false }

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
  let catalog: ReturnType<typeof useCatalogPriceContexts>
  const Harness = defineComponent({
    setup: () => {
      catalog = useCatalogPriceContexts(tenantSlug)
      return () => null
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return { catalog: () => catalog!, tenantSlug, wrapper, queryClient }
}

describe('useCatalogPriceContexts', () => {
  beforeEach(() => fetchCatalogPriceContextsMock.mockReset())

  it.each([[null], [''], ['   ']])(
    'stays idle with a guarded retry while no valid tenant slug is selected (%j)',
    async (slug) => {
      const { catalog } = mountHarness(slug)

      await flushPromises()
      expect(catalog().state.value).toBe('idle')
      expect(catalog().contexts.value).toEqual([])
      await catalog().retry()
      expect(fetchCatalogPriceContextsMock).not.toHaveBeenCalled()
    },
  )

  it('loads tenant-scoped published contexts and forwards TanStack cancellation', async () => {
    fetchCatalogPriceContextsMock.mockResolvedValue([catalogDefault, mayoreo])
    const { catalog } = mountHarness('centro')

    expect(catalog().state.value).toBe('loading')
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(catalog().contexts.value).toEqual([catalogDefault, mayoreo])
    expect(fetchCatalogPriceContextsMock).toHaveBeenCalledWith('centro', expect.any(AbortSignal))
  })

  it('keys discovery by the resolved API base and tenant slug', () => {
    // 'http://localhost:3000' is the resolved base when VITE_API_BASE_URL is unset in unit tests.
    expect(catalogPriceContextsQueryKey('centro')).toEqual([
      'public-catalog',
      'price-contexts',
      'http://localhost:3000',
      'centro',
    ])
    expect(catalogPriceContextsQueryKey('centro')).not.toEqual(
      catalogPriceContextsQueryKey('norte'),
    )
  })

  it('maps empty, unavailable, rate-limit, server, and network responses to distinct states without automatic retries', async () => {
    fetchCatalogPriceContextsMock
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { kind: 'unavailable' }))
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { kind: 'rate-limit' }))
      .mockRejectedValueOnce(Object.assign(new Error('server'), { kind: 'server' }))
      .mockRejectedValueOnce(Object.assign(new Error('network'), { kind: 'network' }))
    const { catalog } = mountHarness('centro')

    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('unavailable')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('rate-limit')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('server')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('network')
    expect(fetchCatalogPriceContextsMock).toHaveBeenCalledTimes(5)
  })

  it('shows retry-pending and guards rapid manual retry clicks', async () => {
    fetchCatalogPriceContextsMock.mockResolvedValueOnce([])
    const pendingRetry = deferred<(typeof catalogDefault)[]>()
    fetchCatalogPriceContextsMock.mockReturnValueOnce(pendingRetry.promise)
    const { catalog } = mountHarness('centro')

    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    void catalog().retry()
    void catalog().retry()
    void catalog().retry()
    expect(catalog().state.value).toBe('retry-pending')
    expect(fetchCatalogPriceContextsMock).toHaveBeenCalledTimes(2)
    pendingRetry.resolve([catalogDefault])
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
  })

  it('adopts only the current tenant contexts across a slug switch and returns to idle when cleared', async () => {
    const centro = [catalogDefault]
    const norte = [{ ...mayoreo, isCatalogDefault: true }]
    const pendingNorte = deferred<typeof norte>()
    fetchCatalogPriceContextsMock
      .mockResolvedValueOnce(centro)
      .mockReturnValueOnce(pendingNorte.promise)
    const { catalog, tenantSlug } = mountHarness('centro')

    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(catalog().contexts.value).toEqual(centro)
    tenantSlug.value = 'norte'
    await nextTick()
    expect(catalog().state.value).toBe('loading')
    expect(catalog().contexts.value).toEqual([])
    pendingNorte.resolve(norte)
    await flushPromises()
    expect(catalog().contexts.value).toEqual(norte)
    expect(catalogPriceContextsQueryKey('centro')).not.toEqual(
      catalogPriceContextsQueryKey('norte'),
    )

    tenantSlug.value = null
    await nextTick()
    expect(catalog().state.value).toBe('idle')
    expect(catalog().contexts.value).toEqual([])
    expect(fetchCatalogPriceContextsMock).toHaveBeenCalledTimes(2)
  })

  it('clears populated contexts when the selection becomes invalid', async () => {
    fetchCatalogPriceContextsMock.mockResolvedValue([catalogDefault])
    const { catalog, tenantSlug } = mountHarness('centro')

    await flushPromises()
    expect(catalog().contexts.value).toEqual([catalogDefault])
    tenantSlug.value = '  '
    await nextTick()
    expect(catalog().state.value).toBe('idle')
    expect(catalog().contexts.value).toEqual([])
    expect(fetchCatalogPriceContextsMock).toHaveBeenCalledTimes(1)
  })
})
