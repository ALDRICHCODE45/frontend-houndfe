import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { productPackagingApi } from '../../api/product-packaging.api'
import {
  productPackagingKeys,
  useProductPackaging,
  useVariantPackaging,
} from '../useProductPackaging'

const tenant = shallowRef('branch-a')
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({ useSafeTenantId: () => tenant }))
vi.mock('../../api/product-packaging.api', () => ({
  productPackagingApi: {
    getProduct: vi.fn(),
    putProduct: vi.fn(),
    removeProduct: vi.fn(),
    getVariant: vi.fn(),
    putVariant: vi.fn(),
    removeVariant: vi.fn(),
  },
}))

const record = { weightG: 320, lengthCm: 25, widthCm: 18, heightCm: 4.5, updatedAt: 't' }
const own = { weightG: 480, lengthCm: 32, widthCm: 22, heightCm: 5.5, updatedAt: 't2' }
const cleanups: Array<() => void> = []

function withClient<T>(factory: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  let result!: T
  const wrapper = mount(defineComponent({ setup() { result = factory(); return () => h('div') } }), {
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  })
  cleanups.push(() => { wrapper.unmount(); client.clear() })
  return { result, client }
}

beforeEach(() => {
  vi.resetAllMocks()
  tenant.value = 'branch-a'
})
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()))

describe('useProductPackaging', () => {
  it('reads the product packaging under a tenant-scoped key and never without a tenant', async () => {
    vi.mocked(productPackagingApi.getProduct).mockResolvedValue({ productId: 'p1', packaging: record })
    tenant.value = ''
    const { result, client } = withClient(() => useProductPackaging(() => 'p1'))
    await flushPromises()
    expect(productPackagingApi.getProduct).not.toHaveBeenCalled()

    tenant.value = 'branch-a'
    await flushPromises()
    expect(productPackagingApi.getProduct).toHaveBeenCalledWith('p1')
    expect(result.packaging.value).toEqual(record)
    expect(client.getQueryData(productPackagingKeys.product('branch-a', 'p1'))).toEqual({ productId: 'p1', packaging: record })
  })

  it('a product save installs the response and refreshes the variants that inherit it', async () => {
    vi.mocked(productPackagingApi.getProduct).mockResolvedValue({ productId: 'p1', packaging: null })
    vi.mocked(productPackagingApi.putProduct).mockResolvedValue({ productId: 'p1', packaging: record })
    const { result, client } = withClient(() => useProductPackaging(() => 'p1'))
    await flushPromises()
    client.setQueryData(productPackagingKeys.variant('branch-a', 'p1', 'v1'), { source: null })
    const body = { weightG: 320, lengthCm: 25, widthCm: 18, heightCm: 4.5 }

    await result.save.mutateAsync(body)

    expect(productPackagingApi.putProduct).toHaveBeenCalledWith('p1', body)
    expect(result.packaging.value).toEqual(record)
    expect(client.getQueryState(productPackagingKeys.variant('branch-a', 'p1', 'v1'))?.isInvalidated).toBe(true)
  })

  it('a product remove leaves packaging null', async () => {
    vi.mocked(productPackagingApi.getProduct).mockResolvedValue({ productId: 'p1', packaging: record })
    vi.mocked(productPackagingApi.removeProduct).mockResolvedValue(undefined)
    const { result } = withClient(() => useProductPackaging(() => 'p1'))
    await flushPromises()

    await result.remove.mutateAsync()

    expect(productPackagingApi.removeProduct).toHaveBeenCalledWith('p1')
    expect(result.packaging.value).toBeNull()
  })
})

describe('useVariantPackaging', () => {
  const inherited = { productId: 'p1', variantId: 'v1', override: null, productPackaging: record, effective: record, source: 'PRODUCT' as const }

  it('reads only while enabled (the modal is open)', async () => {
    vi.mocked(productPackagingApi.getVariant).mockResolvedValue(inherited)
    const open = shallowRef(false)
    const { result } = withClient(() => useVariantPackaging(() => 'p1', () => 'v1', { enabled: open }))
    await flushPromises()
    expect(productPackagingApi.getVariant).not.toHaveBeenCalled()

    open.value = true
    await flushPromises()
    expect(productPackagingApi.getVariant).toHaveBeenCalledWith('p1', 'v1')
    expect(result.data.value).toEqual(inherited)
  })

  it('PUT installs the override; DELETE reads the inherited record again', async () => {
    const overridden = { ...inherited, override: own, effective: own, source: 'VARIANT' as const }
    vi.mocked(productPackagingApi.getVariant).mockResolvedValueOnce(inherited).mockResolvedValueOnce(inherited)
    vi.mocked(productPackagingApi.putVariant).mockResolvedValue(overridden)
    vi.mocked(productPackagingApi.removeVariant).mockResolvedValue(undefined)
    const { result } = withClient(() => useVariantPackaging(() => 'p1', () => 'v1', { enabled: true }))
    await flushPromises()

    await result.save.mutateAsync({ weightG: 480, lengthCm: 32, widthCm: 22, heightCm: 5.5 })
    expect(result.data.value?.source).toBe('VARIANT')

    await result.remove.mutateAsync()
    await flushPromises()
    expect(productPackagingApi.removeVariant).toHaveBeenCalledWith('p1', 'v1')
    expect(productPackagingApi.getVariant).toHaveBeenCalledTimes(2)
    expect(result.data.value?.source).toBe('PRODUCT')
  })
})
