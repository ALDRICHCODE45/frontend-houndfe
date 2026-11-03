import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { suppliersApi } from '../../api/suppliers.api'
import { useSuppliers } from '../useSuppliers'
vi.mock('../../api/suppliers.api', () => ({ suppliersApi: { list: vi.fn() } }))
const cleanups: Array<() => void> = []
const supplier = { id: 'one', displayName: 'Proveedor', termsText: null, status: 'ACTIVE' as const, version: 1, createdAt: '', updatedAt: '' }
function setup() {
  const context = shallowRef({ userId: 'user', tenantId: 'branch', ready: true, canRead: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  let list!: ReturnType<typeof useSuppliers>
  const wrapper = mount(defineComponent({ setup() { list = useSuppliers(context); return () => h('div') } }), {
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  })
  cleanups.push(() => { wrapper.unmount(); client.clear() })
  return { list, context }
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()) })

describe('supplier cursor reads', () => {
  it.each(['ready', 'canRead'] as const)('retires pending responses across %s disable and reenable', async gate => {
    let resolveOld!: (value: { items: typeof supplier[]; nextCursor: null }) => void
    let resolveFresh!: (value: { items: typeof supplier[]; nextCursor: null }) => void
    vi.mocked(suppliersApi.list)
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveFresh = resolve }))
    const { list, context } = setup()
    await flushPromises()
    context.value = { ...context.value, [gate]: false }
    await flushPromises()
    resolveOld({ items: [supplier], nextCursor: null })
    await flushPromises()
    expect(list.items.value).toEqual([])
    context.value = { ...context.value, [gate]: true }
    await flushPromises()
    expect(suppliersApi.list).toHaveBeenCalledTimes(2)
    expect(list.items.value).toEqual([])
    const fresh = { ...supplier, id: 'fresh', displayName: 'Current supplier' }
    resolveFresh({ items: [fresh], nextCursor: null })
    await flushPromises()
    expect(list.items.value).toEqual([fresh])
  })
  it('passes signal and resets cursor on search/status changes without inventing totals', async () => {
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [supplier], nextCursor: 'second' })
    const { list } = setup()
    await flushPromises()
    expect(list.items.value).toEqual([supplier])
    list.next()
    await flushPromises()
    expect(vi.mocked(suppliersApi.list).mock.lastCall?.[0].cursor).toBe('second')
    list.search.value = 'Centro'
    await flushPromises()
    expect(vi.mocked(suppliersApi.list).mock.lastCall?.[0]).toEqual({ status: 'ACTIVE', search: 'Centro', cursor: undefined, limit: 25 })
    expect(vi.mocked(suppliersApi.list).mock.lastCall?.[1]).toBeInstanceOf(AbortSignal)
    list.status.value = 'ARCHIVED'
    await flushPromises()
    expect(vi.mocked(suppliersApi.list).mock.lastCall?.[0].status).toBe('ARCHIVED')
    expect(list.hasPrevious.value).toBe(false)
  })

  it('hides data immediately when access is revoked and prevents refresh dispatch', async () => {
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [supplier], nextCursor: null })
    const { list, context } = setup()
    await flushPromises()
    context.value = { ...context.value, canRead: false }
    expect(list.items.value).toEqual([])
    const calls = vi.mocked(suppliersApi.list).mock.calls.length
    await list.refresh()
    await flushPromises()
    expect(suppliersApi.list).toHaveBeenCalledTimes(calls)
  })

  it('does not display a late response from the previous tenant', async () => {
    let resolve!: (value: { items: typeof supplier[]; nextCursor: null }) => void
    vi.mocked(suppliersApi.list).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [], nextCursor: null })
    const { list, context } = setup()
    await flushPromises()
    context.value = { ...context.value, tenantId: 'other' }
    await flushPromises()
    resolve({ items: [supplier], nextCursor: null })
    await flushPromises()
    expect(list.items.value).toEqual([])
  })
})
