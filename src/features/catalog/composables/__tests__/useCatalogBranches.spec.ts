import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogBranches } from '../useCatalogBranches'
import { fetchCatalogBranches } from '../../api/catalog-branches.api'

vi.mock('../../api/catalog-branches.api', () => ({ fetchCatalogBranches: vi.fn() }))
const fetchCatalogBranchesMock = vi.mocked(fetchCatalogBranches)

const branch = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }

function mountHarness() {
  let catalog: ReturnType<typeof useCatalogBranches>
  const Harness = defineComponent({ setup: () => { catalog = useCatalogBranches(); return () => null } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return () => catalog!
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useCatalogBranches', () => {
  beforeEach(() => fetchCatalogBranchesMock.mockReset())

  it('exposes loading, populated, empty, and recoverable server states with manual retry', async () => {
    fetchCatalogBranchesMock
      .mockResolvedValueOnce([branch])
      .mockRejectedValueOnce(Object.assign(new Error('server'), { kind: 'server' }))
      .mockResolvedValueOnce([])
    const catalog = mountHarness()

    expect(catalog().state.value).toBe('loading')
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(catalog().branches.value).toEqual([branch])
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('server')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    expect(fetchCatalogBranchesMock).toHaveBeenCalledTimes(3)
  })

  it('renders the empty state when no branches are published', async () => {
    fetchCatalogBranchesMock.mockResolvedValue([])
    const catalog = mountHarness()

    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    expect(catalog().branches.value).toEqual([])
  })

  it('shows retry-pending during a manual retry and reissues the request', async () => {
    fetchCatalogBranchesMock.mockResolvedValueOnce([])
    const deferredRetry = deferred<{ id: string; name: string; slug: string; address: string | null; phone: string | null }[]>()
    fetchCatalogBranchesMock.mockReturnValueOnce(deferredRetry.promise)
    const catalog = mountHarness()

    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    const retried = catalog().retry()
    expect(catalog().state.value).toBe('retry-pending')
    deferredRetry.resolve([branch])
    await retried
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(fetchCatalogBranchesMock).toHaveBeenCalledTimes(2)
  })

  it('guards rapid retry clicks so no overlapping request is issued', async () => {
    fetchCatalogBranchesMock.mockResolvedValueOnce([])
    const deferredRetry = deferred<{ id: string; name: string; slug: string; address: string | null; phone: string | null }[]>()
    fetchCatalogBranchesMock.mockReturnValueOnce(deferredRetry.promise)
    const catalog = mountHarness()

    await flushPromises()
    void catalog().retry()
    void catalog().retry()
    void catalog().retry()
    deferredRetry.resolve([branch])
    await flushPromises()
    expect(fetchCatalogBranchesMock).toHaveBeenCalledTimes(2)
  })

  it('maps rate-limit and network failures to their distinct states', async () => {
    fetchCatalogBranchesMock.mockResolvedValueOnce([])
    const rateLimitError = Object.assign(new Error('rate limit'), { kind: 'rate-limit' })
    const networkError = Object.assign(new Error('network'), { kind: 'network' })
    fetchCatalogBranchesMock.mockRejectedValueOnce(rateLimitError).mockRejectedValueOnce(networkError)
    const catalog = mountHarness()

    await flushPromises()
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('rate-limit')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('network')
  })

  it('discards a late completion after the observer unmounts', async () => {
    const deferredInitial = deferred<{ id: string; name: string; slug: string; address: string | null; phone: string | null }[]>()
    fetchCatalogBranchesMock.mockReturnValueOnce(deferredInitial.promise)
    let catalog: ReturnType<typeof useCatalogBranches> | undefined
    const Harness = defineComponent({ setup: () => { catalog = useCatalogBranches(); return () => null } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const wrapper = mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })

    wrapper.unmount()
    deferredInitial.resolve([branch])
    await flushPromises()
    expect(catalog!.state.value).toBe('loading')
  })

  it('issues a fresh request after explicit remount with the same QueryClient', async () => {
    fetchCatalogBranchesMock.mockResolvedValue([branch])
    let catalog: ReturnType<typeof useCatalogBranches> | undefined
    const Harness = defineComponent({ setup: () => { catalog = useCatalogBranches(); return () => null } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const mountWithClient = () => mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })

    const first = mountWithClient()
    await flushPromises()
    first.unmount()
    mountWithClient()
    await flushPromises()
    expect(catalog!.state.value).toBe('populated')
    expect(catalog!.branches.value).toEqual([branch])
    expect(fetchCatalogBranchesMock).toHaveBeenCalledTimes(2)
  })

  it('forwards an AbortSignal to the fetch boundary', async () => {
    fetchCatalogBranchesMock.mockResolvedValueOnce([branch])
    const catalog = mountHarness()
    await flushPromises()
    expect((fetchCatalogBranchesMock.mock.calls[0] as unknown[] | undefined)?.[0]).toBeInstanceOf(AbortSignal)
    void catalog
  })
})
