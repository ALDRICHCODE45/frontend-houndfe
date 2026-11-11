import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogFilterCount, type CatalogFilterCountParams } from '../useCatalogFilterCount'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const page = (total: number) => ({
  items: [],
  meta: { page: 1, limit: 1, total, totalPages: total },
  facets: { categories: [] },
  excludedCount: 0,
  priceContext: { priceListId: 'list-1', name: 'Público', isCatalogDefault: true },
})

function harness(initial: CatalogFilterCountParams | null) {
  const params = shallowRef<CatalogFilterCountParams | null>(initial)
  let api!: ReturnType<typeof useCatalogFilterCount>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useCatalogFilterCount(params, { debounceMs: 200 })
        return () => h('div')
      },
    }),
  )
  return { params, api, wrapper }
}

const base: CatalogFilterCountParams = {
  branchSlug: 'centro',
  priceListId: null,
  search: '',
  categoryId: null,
  tokens: [],
}
const urlOf = (fetchMock: ReturnType<typeof vi.fn>, index = 0) =>
  new URL(String(fetchMock.mock.calls[index]![0]))

describe('useCatalogFilterCount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('probes /products with limit=1 and the draft filters, then exposes meta.total', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(page(13))))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = harness({
      ...base,
      priceListId: 'list-1',
      search: 'croqueta',
      categoryId: 'c-1',
      tokens: ['animal.target:dog', 'life.stage:adult'],
    })
    expect(api.status.value).toBe('counting')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = urlOf(fetchMock)
    expect(url.pathname).toBe('/public/catalog/centro/products')
    expect(url.searchParams.get('limit')).toBe('1')
    expect(url.searchParams.get('priceListId')).toBe('list-1')
    expect(url.searchParams.get('q')).toBe('croqueta')
    expect(url.searchParams.get('categoryId')).toBe('c-1')
    expect(url.searchParams.getAll('facet')).toEqual(['animal.target:dog', 'life.stage:adult'])
    expect(url.searchParams.has('page')).toBe(false)
    expect(api.status.value).toBe('ready')
    expect(api.count.value).toBe(13)
  })

  it('debounces draft changes into one request and ignores a stale answer', async () => {
    let release!: (response: Response) => void
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(json(page(38))))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)))
      .mockImplementationOnce(() => Promise.resolve(json(page(2))))
    vi.stubGlobal('fetch', fetchMock)
    const { params, api } = harness(base)
    await flushPromises()
    expect(api.count.value).toBe(38)

    params.value = { ...base, tokens: ['a:1'] }
    await nextTick()
    expect(api.status.value).toBe('counting')
    params.value = { ...base, tokens: ['a:1', 'b:1'] }
    await nextTick()
    await vi.advanceTimersByTimeAsync(150)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(urlOf(fetchMock, 1).searchParams.getAll('facet')).toEqual(['a:1', 'b:1'])

    params.value = { ...base, tokens: ['c:1'] }
    await nextTick()
    await vi.advanceTimersByTimeAsync(250)
    release(json(page(99)))
    await flushPromises()
    expect(api.count.value).toBe(2)
    expect(api.status.value).toBe('ready')
  })

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('offline'))],
    ['a 400', () => Promise.resolve(json({ error: 'FACET_NOT_AVAILABLE' }, 400))],
    ['a 429', () => Promise.resolve(json({}, 429))],
    ['a malformed body', () => Promise.resolve(json({ meta: { total: 'many' } }))],
  ])('falls back to an error status on %s', async (_name, respond) => {
    vi.stubGlobal('fetch', vi.fn(respond))
    const { api } = harness(base)
    await flushPromises()
    expect(api.status.value).toBe('error')
    expect(api.count.value).toBeNull()
  })

  it('stays idle without a branch and aborts the request when the scope ends', async () => {
    const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => {
      void init
      return new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)
    const idle = harness(null)
    expect(idle.api.status.value).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()

    const live = harness(base)
    await flushPromises()
    const signal = fetchMock.mock.calls[0]![1]!.signal!
    expect(signal.aborted).toBe(false)
    live.wrapper.unmount()
    expect(signal.aborted).toBe(true)
  })
})
