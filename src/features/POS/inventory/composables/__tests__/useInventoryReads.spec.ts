import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inventoryApi } from '../../api/inventory.api'
import type { MovementsQuery, StockMovement, StockSnapshot } from '../../interfaces/inventory.types'
import { useProductStock } from '../useProductStock'
import { useStockMovements } from '../useStockMovements'

vi.mock('../../api/inventory.api', () => ({ inventoryApi: { getStock: vi.fn(), listMovements: vi.fn() } }))

const snapshot = (quantity = 42): StockSnapshot => ({
  product: { id: 'p1', name: 'Croquetas', useStock: true, quantity, untracked: { quantity: 12, version: 3 }, sellable: 34 },
  lots: [], variants: [],
})
const movement = (id: string): StockMovement => ({
  id, type: 'SALE', bucket: 'LOT', productId: 'p1', variantId: null, lotId: 'l1',
  labels: { product: 'Croquetas', variant: null, lot: 'L-1' }, delta: -2, balanceAfter: 10, productBalanceAfter: 40,
  reason: null, note: null, removalCause: null, group: { type: 'SALE', id: 'sale-1' },
  actor: { displayName: 'María' }, createdAt: '2026-11-04T15:02:11.120Z',
})
const cleanups: Array<() => void> = []
const baseContext = { userId: 'user', tenantId: 'branch', ready: true, canRead: true, canAdjust: false }

function setup(patch: Partial<typeof baseContext> = {}) {
  const context = shallowRef({ ...baseContext, ...patch })
  const productId = shallowRef<string | null>('p1')
  const filter = shallowRef<Omit<MovementsQuery, 'cursor' | 'limit'> | null>({ productId: 'p1' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  let stock!: ReturnType<typeof useProductStock>
  let movements!: ReturnType<typeof useStockMovements>
  const wrapper = mount(defineComponent({
    setup() {
      stock = useProductStock(productId, context)
      movements = useStockMovements(filter, context)
      return () => h('div')
    },
  }), { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
  cleanups.push(() => { wrapper.unmount(); client.clear() })
  return { context, productId, filter, stock, movements, client }
}
const httpError = (status: number, error: string) => Object.assign(new Error(error), { response: { status, data: { statusCode: status, error } } })
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(inventoryApi.getStock).mockResolvedValue(snapshot())
  vi.mocked(inventoryApi.listMovements).mockResolvedValue({ items: [movement('m1')], nextCursor: 'c1' })
})
afterEach(() => cleanups.splice(0).forEach(fn => fn()))

describe('useProductStock', () => {
  it('reads the stock of the product with the abort signal and exposes it', async () => {
    const { stock } = setup()
    expect(stock.isLoading.value).toBe(true)
    expect(stock.stock.value).toBeNull()
    await flushPromises()
    expect(inventoryApi.getStock).toHaveBeenCalledExactlyOnceWith('p1', expect.any(AbortSignal))
    expect(stock.stock.value).toEqual(snapshot())
    expect(stock.isLoading.value).toBe(false)
    expect(stock.error.value).toBeNull()
  })

  it.each([
    ['no inventory grant', { canRead: false }],
    ['the session is not ready', { ready: false }],
    ['there is no user', { userId: '' }],
    ['there is no branch', { tenantId: '' }],
  ])('sends no request when %s', async (_name, patch) => {
    const { stock } = setup(patch)
    await flushPromises()
    expect(inventoryApi.getStock).not.toHaveBeenCalled()
    expect(stock.stock.value).toBeNull()
  })

  it('does not request anything without a product', async () => {
    const { productId, stock } = setup()
    await flushPromises()
    vi.mocked(inventoryApi.getStock).mockClear()
    productId.value = null
    await flushPromises()
    expect(inventoryApi.getStock).not.toHaveBeenCalled()
    expect(stock.stock.value).toBeNull()
  })

  it('exposes a failed read as an error and retries on refresh', async () => {
    vi.mocked(inventoryApi.getStock).mockRejectedValueOnce(httpError(500, 'INTERNAL_ERROR'))
    const { stock } = setup()
    await flushPromises()
    expect(stock.error.value).not.toBeNull()
    expect(stock.stock.value).toBeNull()
    await stock.refresh()
    await flushPromises()
    expect(stock.error.value).toBeNull()
    expect(stock.stock.value).toEqual(snapshot())
  })

  it('never shows the previous branch stock after the tenant changes', async () => {
    const { stock, context } = setup()
    await flushPromises()
    vi.mocked(inventoryApi.getStock).mockResolvedValue(snapshot(7))
    context.value = { ...context.value, tenantId: 'other' }
    expect(stock.stock.value).toBeNull()
    await flushPromises()
    expect(stock.stock.value?.product.quantity).toBe(7)
  })

  it('drops the shown stock when the read grant is revoked and refetches when it returns', async () => {
    const { stock, context } = setup()
    await flushPromises()
    context.value = { ...context.value, canRead: false }
    expect(stock.stock.value).toBeNull()
    context.value = { ...context.value, canRead: true }
    await flushPromises()
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(2)
    expect(stock.stock.value).toEqual(snapshot())
  })

  it('applies the snapshot returned by an adjustment without another request', async () => {
    const { stock } = setup()
    await flushPromises()
    stock.apply(snapshot(30))
    await flushPromises()
    expect(stock.stock.value?.product.quantity).toBe(30)
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(1)
  })

  it('ignores a snapshot of another product', async () => {
    const { stock } = setup()
    await flushPromises()
    stock.apply({ ...snapshot(99), product: { ...snapshot().product, id: 'other' } })
    expect(stock.stock.value?.product.quantity).toBe(42)
  })
})

describe('useStockMovements', () => {
  it('reads the first page newest first with the page size and the product filter', async () => {
    const { movements } = setup()
    await flushPromises()
    expect(inventoryApi.listMovements).toHaveBeenCalledExactlyOnceWith(
      { productId: 'p1', cursor: undefined, limit: 25 }, expect.any(AbortSignal))
    expect(movements.items.value.map(row => row.id)).toEqual(['m1'])
    expect(movements.hasMore.value).toBe(true)
  })

  it('loads more with the cursor and appends after the rows already shown', async () => {
    const { movements } = setup()
    await flushPromises()
    vi.mocked(inventoryApi.listMovements).mockResolvedValueOnce({ items: [movement('m2')], nextCursor: null })
    await movements.loadMore()
    await flushPromises()
    expect(vi.mocked(inventoryApi.listMovements).mock.calls[1]![0]).toEqual({ productId: 'p1', cursor: 'c1', limit: 25 })
    expect(movements.items.value.map(row => row.id)).toEqual(['m1', 'm2'])
    expect(movements.hasMore.value).toBe(false)
    await movements.loadMore()
    expect(inventoryApi.listMovements).toHaveBeenCalledTimes(2)
  })

  it('keeps the shown rows and reports a failed page without losing the cursor', async () => {
    const { movements } = setup()
    await flushPromises()
    vi.mocked(inventoryApi.listMovements).mockRejectedValueOnce(httpError(500, 'INTERNAL_ERROR'))
    await movements.loadMore()
    await flushPromises()
    expect(movements.items.value.map(row => row.id)).toEqual(['m1'])
    expect(movements.loadMoreError.value).toBe(true)
    expect(movements.error.value).toBeNull()
    expect(movements.hasMore.value).toBe(true)
  })

  it('filters by lot and restarts from the first page', async () => {
    const { movements, filter } = setup()
    await flushPromises()
    await movements.loadMore()
    await flushPromises()
    vi.mocked(inventoryApi.listMovements).mockResolvedValue({ items: [movement('m9')], nextCursor: null })
    filter.value = { productId: 'p1', lotId: 'l1' }
    expect(movements.items.value).toEqual([])
    await flushPromises()
    expect(vi.mocked(inventoryApi.listMovements).mock.lastCall![0]).toEqual({ productId: 'p1', lotId: 'l1', cursor: undefined, limit: 25 })
    expect(movements.items.value.map(row => row.id)).toEqual(['m9'])
  })

  it('refresh restarts from the first page so new rows show on top', async () => {
    const { movements } = setup()
    await flushPromises()
    await movements.loadMore()
    await flushPromises()
    vi.mocked(inventoryApi.listMovements).mockResolvedValue({ items: [movement('m0'), movement('m1')], nextCursor: null })
    await movements.refresh()
    await flushPromises()
    expect(vi.mocked(inventoryApi.listMovements).mock.lastCall![0].cursor).toBeUndefined()
    expect(movements.items.value.map(row => row.id)).toEqual(['m0', 'm1'])
  })

  it('exposes a failed first page as an error and no rows', async () => {
    vi.mocked(inventoryApi.listMovements).mockRejectedValueOnce(httpError(403, 'FORBIDDEN'))
    const { movements } = setup()
    await flushPromises()
    expect(movements.error.value).not.toBeNull()
    expect(movements.items.value).toEqual([])
    expect(movements.isLoading.value).toBe(false)
  })

  it('sends nothing without the read grant and fences rows when the tenant changes', async () => {
    const denied = setup({ canRead: false })
    await flushPromises()
    expect(inventoryApi.listMovements).not.toHaveBeenCalled()
    expect(denied.movements.items.value).toEqual([])
    cleanups.splice(0).forEach(fn => fn())
    const { movements, context } = setup()
    await flushPromises()
    context.value = { ...context.value, tenantId: 'other' }
    expect(movements.items.value).toEqual([])
  })
})
