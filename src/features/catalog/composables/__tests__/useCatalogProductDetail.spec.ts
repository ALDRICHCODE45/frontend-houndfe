import { focusManager, onlineManager, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogProductDetail } from '../useCatalogProductDetail'
import { fetchCatalogProductDetail } from '../../api/catalog-product-detail.api'

vi.mock('../../api/catalog-product-detail.api', () => ({ fetchCatalogProductDetail: vi.fn() }))
const fetchCatalogProductDetailMock = vi.mocked(fetchCatalogProductDetail)
const initialFocusState = focusManager.isFocused()
const initialOnlineState = onlineManager.isOnline()

const priceListId = 'fdf84f88-7d2c-4e5f-8f7a-b056db1f0627'
const productId = '6de2ae1d-91a0-481a-a9e2-df0327b0e4db'
const detail = {
  id: productId,
  name: 'Café molido',
  slug: null,
  description: null,
  category: null,
  brand: null,
  images: [],
  price: { priceCents: 2500, hidden: false },
  availability: 'available' as const,
  stockPresentation: {
    mode: 'SYSTEM_STATUS' as const,
    status: 'available' as const,
    customQuantity: null,
  },
  hasVariants: false,
  variants: [],
  rating: null,
  featuredLabel: null,
  priceContext: { priceListId, name: 'Lista pública', isCatalogDefault: true },
  excludedCount: 0 as const,
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: 0,
        retryOnMount: true,
        gcTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  })
}

function mountHarness(
  initial: { tenantSlug: string | null; productId: string | null; priceListId: string | null } = {
    tenantSlug: 'centro',
    productId,
    priceListId,
  },
  queryClient = createQueryClient(),
) {
  const tenantSlug = shallowRef<string | null>(initial.tenantSlug)
  const selectedProductId = shallowRef<string | null>(initial.productId)
  const selectedPriceListId = shallowRef<string | null>(initial.priceListId)
  let catalog: ReturnType<typeof useCatalogProductDetail>
  const Harness = defineComponent({
    setup: () => {
      catalog = useCatalogProductDetail(tenantSlug, selectedProductId, selectedPriceListId)
      return () => null
    },
  })
  const wrapper = mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return {
    catalog: () => catalog!,
    tenantSlug,
    selectedProductId,
    selectedPriceListId,
    wrapper,
    queryClient,
  }
}

describe('useCatalogProductDetail', () => {
  beforeEach(() => fetchCatalogProductDetailMock.mockReset())

  afterEach(() => {
    focusManager.setFocused(initialFocusState)
    onlineManager.setOnline(initialOnlineState)
  })

  it.each([
    { tenantSlug: null, productId, priceListId },
    { tenantSlug: 'centro', productId: '', priceListId },
    { tenantSlug: 'centro', productId, priceListId: '   ' },
  ])('is idle and guards retry when any normalized identity is unavailable', async (initial) => {
    const { catalog } = mountHarness(initial)

    await flushPromises()
    expect(catalog().state.value).toBe('idle')
    expect(catalog().detail.value).toBeNull()
    await catalog().retry()
    expect(fetchCatalogProductDetailMock).not.toHaveBeenCalled()
  })

  it('uses all trimmed identities, forwards TanStack cancellation, and exposes populated detail', async () => {
    fetchCatalogProductDetailMock.mockResolvedValue(detail)
    const { catalog } = mountHarness({
      tenantSlug: ' centro ',
      productId: ` ${productId} `,
      priceListId: ` ${priceListId} `,
    })

    expect(catalog().state.value).toBe('loading')
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(catalog().detail.value).toEqual(detail)
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledWith(
      'centro',
      productId,
      priceListId,
      expect.any(AbortSignal),
    )
  })

  it.each([
    ['tenant slug', () => 'centro', productId, priceListId],
    ['product id', 'centro', () => productId, priceListId],
    ['price-list id', 'centro', productId, () => priceListId],
  ])(
    'normalizes a %s getter while the other identities are plain values',
    async (_, tenantSlug, selectedProductId, selectedPriceListId) => {
      let catalog: ReturnType<typeof useCatalogProductDetail>
      const Harness = defineComponent({
        setup: () => {
          catalog = useCatalogProductDetail(tenantSlug, selectedProductId, selectedPriceListId)
          return () => null
        },
      })
      fetchCatalogProductDetailMock.mockResolvedValue(detail)
      const wrapper = mount(Harness, {
        global: { plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]] },
      })

      await flushPromises()
      expect(catalog!.detail.value).toEqual(detail)
      expect(fetchCatalogProductDetailMock).toHaveBeenCalledWith(
        'centro',
        productId,
        priceListId,
        expect.any(AbortSignal),
      )
      wrapper.unmount()
    },
  )

  it('exposes not-found, rate-limit, server, and network without automatic retries', async () => {
    fetchCatalogProductDetailMock
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { kind: 'not-found' }))
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { kind: 'rate-limit' }))
      .mockRejectedValueOnce(Object.assign(new Error('server'), { kind: 'server' }))
      .mockRejectedValueOnce(Object.assign(new Error('network'), { kind: 'network' }))
    const { catalog } = mountHarness()

    await flushPromises()
    expect(catalog().state.value).toBe('not-found')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('rate-limit')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('server')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('network')
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(4)
  })

  it('does not retry an errored query when the same identity synchronously remounts', async () => {
    fetchCatalogProductDetailMock.mockRejectedValueOnce(
      Object.assign(new Error('server'), { kind: 'server' }),
    )
    const first = mountHarness()

    await flushPromises()
    expect(first.catalog().state.value).toBe('server')
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(1)

    first.wrapper.unmount()
    const second = mountHarness(undefined, first.queryClient)
    await flushPromises()
    expect(second.catalog().state.value).toBe('server')
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(1)
    second.wrapper.unmount()
  })

  it('shows retry-pending and guards rapid manual retry clicks', async () => {
    fetchCatalogProductDetailMock.mockResolvedValueOnce(detail)
    const pendingRetry = deferred<typeof detail>()
    fetchCatalogProductDetailMock.mockReturnValueOnce(pendingRetry.promise)
    const { catalog } = mountHarness()

    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    void catalog().retry()
    void catalog().retry()
    void catalog().retry()
    expect(catalog().state.value).toBe('retry-pending')
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(2)
    pendingRetry.resolve(detail)
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
  })

  it('clears detail across valid product, tenant, and price-list transitions', async () => {
    const nextProductId = '735aa518-da06-45fb-8db6-b2b793d5a2eb'
    const nextPriceListId = 'd590fa39-4cb5-42cb-8dfc-1309cb61e9fb'
    const productDetail = { ...detail, id: nextProductId }
    const tenantDetail = { ...productDetail, name: 'Café norte' }
    const priceListDetail = {
      ...tenantDetail,
      priceContext: { ...detail.priceContext, priceListId: nextPriceListId },
    }
    fetchCatalogProductDetailMock
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce(productDetail)
      .mockResolvedValueOnce(tenantDetail)
      .mockResolvedValueOnce(priceListDetail)
    const { catalog, selectedProductId, selectedPriceListId, tenantSlug } = mountHarness()

    await flushPromises()
    expect(catalog().detail.value).toEqual(detail)

    selectedProductId.value = nextProductId
    await nextTick()
    expect(catalog().state.value).toBe('loading')
    expect(catalog().detail.value).toBeNull()
    await flushPromises()
    expect(fetchCatalogProductDetailMock).toHaveBeenLastCalledWith(
      'centro',
      nextProductId,
      priceListId,
      expect.any(AbortSignal),
    )
    expect(catalog().detail.value).toEqual(productDetail)

    tenantSlug.value = 'norte'
    await nextTick()
    expect(catalog().detail.value).toBeNull()
    await flushPromises()
    expect(fetchCatalogProductDetailMock).toHaveBeenLastCalledWith(
      'norte',
      nextProductId,
      priceListId,
      expect.any(AbortSignal),
    )
    expect(catalog().detail.value).toEqual(tenantDetail)

    selectedPriceListId.value = nextPriceListId
    await nextTick()
    expect(catalog().detail.value).toBeNull()
    await flushPromises()
    expect(fetchCatalogProductDetailMock).toHaveBeenLastCalledWith(
      'norte',
      nextProductId,
      nextPriceListId,
      expect.any(AbortSignal),
    )
    expect(catalog().detail.value).toEqual(priceListDetail)

    selectedPriceListId.value = null
    await nextTick()
    expect(catalog().state.value).toBe('idle')
    expect(catalog().detail.value).toBeNull()
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(4)
  })

  it('aborts the pending request signal when a valid identity changes', async () => {
    const firstRequest = deferred<typeof detail>()
    fetchCatalogProductDetailMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce({ ...detail, id: '735aa518-da06-45fb-8db6-b2b793d5a2eb' })
    const { selectedProductId, wrapper } = mountHarness()

    await nextTick()
    const firstSignal = fetchCatalogProductDetailMock.mock.calls[0]?.[3]
    expect(firstSignal?.aborted).toBe(false)
    firstSignal?.addEventListener('abort', () => firstRequest.reject(firstSignal.reason), {
      once: true,
    })

    selectedProductId.value = '735aa518-da06-45fb-8db6-b2b793d5a2eb'
    await nextTick()
    expect(firstSignal?.aborted).toBe(true)
    wrapper.unmount()
  })

  it('aborts the pending request signal when its consuming component unmounts', async () => {
    const request = deferred<typeof detail>()
    fetchCatalogProductDetailMock.mockReturnValueOnce(request.promise)
    const { wrapper } = mountHarness()

    await nextTick()
    const signal = fetchCatalogProductDetailMock.mock.calls[0]?.[3]
    expect(signal?.aborted).toBe(false)
    signal?.addEventListener('abort', () => request.reject(signal.reason), { once: true })
    wrapper.unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('suppresses retry, mount, focus, and reconnect refetches despite hostile client defaults', async () => {
    fetchCatalogProductDetailMock.mockResolvedValue(detail)
    const first = mountHarness()

    await flushPromises()
    expect(first.catalog().detail.value).toEqual(detail)
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(1)

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    await flushPromises()
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(1)

    first.wrapper.unmount()
    const second = mountHarness(undefined, first.queryClient)
    await flushPromises()
    expect(second.catalog().detail.value).toEqual(detail)
    expect(fetchCatalogProductDetailMock).toHaveBeenCalledTimes(1)
    second.wrapper.unmount()
  })
})
