import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { backorderQueryKeys } from '@/core/shared/constants/query-keys'
import { countsFixture, makeBackorder } from '../../interfaces/__tests__/backorder.fixture'
import { withQuery } from './withQuery'

vi.mock('../../api/backorders.api', () => ({ backordersApi: { list: vi.fn(), get: vi.fn(), cancel: vi.fn() } }))

const auth = vi.hoisted(() => ({ grants: new Set<string>(['read:Backorder', 'update:Backorder']), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.grants.has(`${action}:${subject}`),
  }),
}))

import { backordersApi } from '../../api/backorders.api'
import { useBackorderDetail } from '../useBackorderDetail'
import { useBackorderList } from '../useBackorderList'
import { useCancelBackorder } from '../useCancelBackorder'
import { useReservedBackordersCount } from '../useReservedBackordersCount'

const list = vi.mocked(backordersApi.list)
const get = vi.mocked(backordersApi.get)
const cancel = vi.mocked(backordersApi.cancel)
const page = { items: [makeBackorder()], page: 1, limit: 20, total: 1, counts: countsFixture }

beforeEach(() => {
  vi.resetAllMocks()
  auth.grants = new Set(['read:Backorder', 'update:Backorder'])
  list.mockResolvedValue(page)
  get.mockResolvedValue(makeBackorder())
})

describe('useReservedBackordersCount (nav badge source)', () => {
  it('reads counts.RESERVED from the lightest page under the backorder prefix', async () => {
    const { result, client } = withQuery(() => useReservedBackordersCount())
    await flushPromises()
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 1 }, expect.anything())
    expect(result.count.value).toBe(2)
    expect(client.getQueryData(backorderQueryKeys.reservedCount('tenant-1'))).toBeDefined()
  })

  it('makes no request without read:Backorder and reads 0', async () => {
    auth.grants = new Set(['update:Backorder'])
    const { result } = withQuery(() => useReservedBackordersCount())
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
    expect(result.count.value).toBe(0)
  })
})

describe('useBackorderList', () => {
  it('queries with the state params and exposes items, total and counts', async () => {
    const params = ref({ page: 2, limit: 10, status: ['WAITING' as const] })
    const { result } = withQuery(() => useBackorderList(() => params.value))
    await flushPromises()
    expect(list).toHaveBeenCalledWith(params.value, expect.anything())
    expect(result.items.value).toHaveLength(1)
    expect(result.total.value).toBe(1)
    expect(result.counts.value).toEqual(countsFixture)
  })

  it('refetches when the params change', async () => {
    const params = ref({ page: 1, status: ['WAITING' as const] })
    withQuery(() => useBackorderList(() => params.value))
    await flushPromises()
    params.value = { page: 1, status: ['RESERVED' as never] }
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('is disabled without read:Backorder', async () => {
    auth.grants = new Set()
    const { result } = withQuery(() => useBackorderList(() => ({})))
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
    expect(result.items.value).toEqual([])
  })
})

describe('useBackorderDetail', () => {
  it('reads GET /backorders/:id and flags a 404 as not found', async () => {
    const { result } = withQuery(() => useBackorderDetail(() => 'b1'))
    await flushPromises()
    expect(get).toHaveBeenCalledWith('b1', expect.anything())
    expect(result.backorder.value?.folio).toBe('BO-000012')

    get.mockRejectedValue({ response: { status: 404, data: { error: 'BACKORDER_NOT_FOUND' } } })
    const missing = withQuery(() => useBackorderDetail(() => 'gone'))
    await flushPromises()
    expect(missing.result.isNotFound.value).toBe(true)
    expect(missing.result.isError.value).toBe(false)
  })
})

describe('useCancelBackorder', () => {
  it('sends the reason and the version it was given, then invalidates the tenant prefix', async () => {
    cancel.mockResolvedValue(makeBackorder({ status: 'CANCELLED', version: 4 }))
    const { result, client } = withQuery(() => useCancelBackorder(() => 'b1'))
    const spy = vi.spyOn(client, 'invalidateQueries')
    const outcome = await result.cancel({ version: 3, reason: 'Sin stock' })
    expect(cancel).toHaveBeenCalledWith('b1', { version: 3, reason: 'Sin stock' })
    expect(outcome).toMatchObject({ status: 'cancelled' })
    expect(spy).toHaveBeenCalledWith({ queryKey: backorderQueryKeys.all('tenant-1') })
  })

  it('on VERSION_CONFLICT refetches (invalidates) and returns the owner copy', async () => {
    cancel.mockRejectedValue({ response: { status: 409, data: { error: 'VERSION_CONFLICT', currentVersion: 5 } } })
    const { result, client } = withQuery(() => useCancelBackorder(() => 'b1'))
    const spy = vi.spyOn(client, 'invalidateQueries')
    const outcome = await result.cancel({ version: 3 })
    expect(outcome).toMatchObject({
      status: 'failed',
      error: { code: 'VERSION_CONFLICT', refetch: true, message: expect.stringContaining('Otro usuario modificó') },
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: backorderQueryKeys.all('tenant-1') })
  })

  // Handoff 26 §4, §7 (S12): 503 BACKORDER_RETRY_REQUIRED = transient serialisation conflict, nothing changed.
  describe('503 BACKORDER_RETRY_REQUIRED (S12)', () => {
    const retryRequired = () => ({
      response: { status: 503, data: { statusCode: 503, error: 'BACKORDER_RETRY_REQUIRED', message: 'BACKORDER_RETRY_REQUIRED' } },
    })

    it('retries the same request once, automatically, and succeeds', async () => {
      cancel.mockRejectedValueOnce(retryRequired())
      cancel.mockResolvedValueOnce(makeBackorder({ status: 'CANCELLED', version: 4 }))
      const { result } = withQuery(() => useCancelBackorder(() => 'b1'))

      const outcome = await result.cancel({ version: 3, reason: 'Sin proveedor' })

      expect(outcome).toMatchObject({ status: 'cancelled' })
      expect(cancel).toHaveBeenCalledTimes(2)
      expect(cancel).toHaveBeenNthCalledWith(1, 'b1', { version: 3, reason: 'Sin proveedor' })
      expect(cancel).toHaveBeenNthCalledWith(2, 'b1', { version: 3, reason: 'Sin proveedor' })
    })

    it('after a second 503 it stops (no loop) and says it was a momentary conflict', async () => {
      cancel.mockRejectedValue(retryRequired())
      const { result } = withQuery(() => useCancelBackorder(() => 'b1'))

      const outcome = await result.cancel({ version: 3 })

      expect(cancel).toHaveBeenCalledTimes(2)
      expect(outcome).toMatchObject({
        status: 'failed',
        error: { code: 'BACKORDER_RETRY_REQUIRED', message: 'No se pudo cancelar por un conflicto momentáneo. Intenta de nuevo.' },
      })
    })

    it('a 409 on the retry is handled like any 409 (refetch)', async () => {
      cancel.mockRejectedValueOnce(retryRequired())
      cancel.mockRejectedValueOnce({ response: { status: 409, data: { error: 'BACKORDER_NOT_CANCELLABLE', status: 'CANCELLED' } } })
      const { result, client } = withQuery(() => useCancelBackorder(() => 'b1'))
      const invalidate = vi.spyOn(client, 'invalidateQueries')

      expect(await result.cancel({ version: 3 })).toMatchObject({ status: 'failed', error: { refetch: true } })
      expect(invalidate).toHaveBeenCalled()
      expect(cancel).toHaveBeenCalledTimes(2)
    })

    it('does not retry any other failure', async () => {
      cancel.mockRejectedValue({ response: { status: 500, data: {} } })
      const { result } = withQuery(() => useCancelBackorder(() => 'b1'))
      await result.cancel({ version: 3 })
      expect(cancel).toHaveBeenCalledTimes(1)
    })
  })

  it('on BACKORDER_NOT_CANCELLABLE refetches too; a generic failure does not', async () => {
    cancel.mockRejectedValueOnce({ response: { status: 409, data: { error: 'BACKORDER_NOT_CANCELLABLE', status: 'EXPIRED' } } })
    const { result, client } = withQuery(() => useCancelBackorder(() => 'b1'))
    const spy = vi.spyOn(client, 'invalidateQueries')
    expect(await result.cancel({ version: 3 })).toMatchObject({ status: 'failed', error: { refetch: true } })
    expect(spy).toHaveBeenCalledTimes(1)

    cancel.mockRejectedValueOnce({ response: { status: 500, data: {} } })
    expect(await result.cancel({ version: 3 })).toMatchObject({ status: 'failed', error: { refetch: false } })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('refuses without update:Backorder and ignores a second submit while one is in flight', async () => {
    auth.grants = new Set(['read:Backorder'])
    const denied = withQuery(() => useCancelBackorder(() => 'b1'))
    expect(await denied.result.cancel({ version: 1 })).toEqual({ status: 'ignored' })
    expect(cancel).not.toHaveBeenCalled()

    auth.grants = new Set(['read:Backorder', 'update:Backorder'])
    let release!: (value: ReturnType<typeof makeBackorder>) => void
    cancel.mockReturnValue(new Promise((resolve) => (release = resolve)))
    const { result } = withQuery(() => useCancelBackorder(() => 'b1'))
    const first = result.cancel({ version: 1 })
    expect(await result.cancel({ version: 1 })).toEqual({ status: 'ignored' })
    release(makeBackorder())
    await first
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})
