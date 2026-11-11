import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, shallowRef, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogBranchDetail } from '../useCatalogBranchDetail'
import { fetchCatalogBranchDetail } from '../../api/catalog-branch-detail.api'

vi.mock('../../api/catalog-branch-detail.api', () => ({ fetchCatalogBranchDetail: vi.fn() }))
const fetchMock = vi.mocked(fetchCatalogBranchDetail)

const detail = {
  name: 'Sucursal Centro',
  phone: null,
  address: null,
  hours: null,
  pickupAvailable: false,
  deliveryAvailable: false,
  whatsappNumber: null,
}

function mountHarness(slug: Ref<string | null>, withClient = true) {
  let result: ReturnType<typeof useCatalogBranchDetail>
  const Harness = defineComponent({
    setup: () => {
      result = useCatalogBranchDetail(slug)
      return () => null
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  mount(Harness, { global: { plugins: withClient ? [[VueQueryPlugin, { queryClient }]] : [] } })
  return () => result!
}

describe('useCatalogBranchDetail', () => {
  beforeEach(() => fetchMock.mockReset())

  it('exposes the branch card of the slug', async () => {
    fetchMock.mockResolvedValue(detail)
    const branch = mountHarness(shallowRef<string | null>('centro'))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('centro', expect.anything())
    expect(branch().branch.value).toEqual(detail)
  })

  it('never requests without a slug', async () => {
    const branch = mountHarness(shallowRef<string | null>(null))
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(branch().branch.value).toBeNull()
  })

  it('hides the card on a failure', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('not-found'), { kind: 'not-found' }))
    const branch = mountHarness(shallowRef<string | null>('centro'))
    await flushPromises()
    expect(branch().branch.value).toBeNull()
  })

  it('stays silent when no query client is provided', async () => {
    const branch = mountHarness(shallowRef<string | null>('centro'), false)
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(branch().branch.value).toBeNull()
  })
})
