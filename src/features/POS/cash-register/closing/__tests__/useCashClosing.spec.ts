/**
 * useCashClosing — close command discipline (stable Idempotency-Key per attempt,
 * identity re-check, session caches invalidated, corte seeded) and the
 * principal-scoped closings reads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'
import type { Mock } from 'vitest'
import { CLOSING, cashError } from './closingFixtures'

vi.mock('../../api/cash.api', () => ({
  cashApi: {
    closeSession: vi.fn(),
    listClosings: vi.fn(),
    getClosing: vi.fn(),
    getClosingPdf: vi.fn(),
  },
}))

const auth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'super-1' } as { id: string } | null,
  isSuperAdmin: false,
  permissionCodes: ['create:CashClosing', 'read:CashClosing'] as string[],
  permissionsLoaded: true,
  userCan(action: string, subject: string) {
    return auth.permissionCodes.includes(`${action}:${subject}`)
  },
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { cashApi } from '../../api/cash.api'
import { cashQueryKeys } from '../../composables/cashQueryKeys'
import { useCashClose, useCashClosingDetail, useCashClosingsList } from '../useCashClosing'

const api = cashApi as unknown as Record<string, Mock>

function mountWithQuery<T>(composable: () => T) {
  let result!: T
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return { result, queryClient, wrapper }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

enableAutoUnmount(afterEach)
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  auth.user = { id: 'super-1' }
  auth.permissionCodes = ['create:CashClosing', 'read:CashClosing']
})

describe('useCashClose', () => {
  it('closes with an idempotency key, seeds the corte and invalidates the session caches', async () => {
    api.closeSession!.mockResolvedValue(CLOSING)
    const { result, queryClient } = mountWithQuery(() => useCashClose())
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    const closing = await result.close(CLOSING.sessionId, 'Cierre sin novedad')

    expect(closing).toEqual(CLOSING)
    const [id, body, key] = api.closeSession!.mock.calls[0]!
    expect(id).toBe(CLOSING.sessionId)
    expect(body).toEqual({ notes: 'Cierre sin novedad' })
    expect(typeof key).toBe('string')
    expect((key as string).length).toBeGreaterThan(0)

    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey))
    expect(keys.some((k) => k.includes('"sessions","list"'))).toBe(true)
    expect(keys.some((k) => k.includes(`"sessions","detail","${CLOSING.sessionId}"`))).toBe(true)
    expect(keys.some((k) => k.includes('"closings","list"'))).toBe(true)

    const scope = { tenantId: 'tenant-1', userId: 'super-1' }
    const seeded = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['cash', scope.tenantId, scope.userId] })
      .find((q) => q.queryKey.includes('closings') && q.queryKey.includes(CLOSING.id))
    expect(seeded?.state.data).toEqual(CLOSING)
  })

  it('replays the same key after a failure and uses a fresh one after success', async () => {
    api.closeSession!.mockRejectedValueOnce(cashError('CASH_DRAWER_NOT_RELEASED'))
    api.closeSession!.mockResolvedValue(CLOSING)
    const { result } = mountWithQuery(() => useCashClose())

    await expect(result.close('s-1')).rejects.toBeTruthy()
    await result.close('s-1')
    await result.close('s-1')

    const keys = api.closeSession!.mock.calls.map((call) => call[2])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('a different note is a different attempt (never reuses a key for another body)', async () => {
    api.closeSession!.mockRejectedValue(cashError('CASH_DRAWER_NOT_RELEASED'))
    const { result } = mountWithQuery(() => useCashClose())

    await expect(result.close('s-1', 'a')).rejects.toBeTruthy()
    await expect(result.close('s-1', 'b')).rejects.toBeTruthy()

    const keys = api.closeSession!.mock.calls.map((call) => call[2])
    expect(keys[0]).not.toBe(keys[1])
  })

  it('refuses a second close while one is in flight', async () => {
    let resolve!: (value: unknown) => void
    api.closeSession!.mockReturnValue(new Promise((res) => (resolve = res)))
    const { result } = mountWithQuery(() => useCashClose())

    const first = result.close('s-1')
    expect(result.isClosing.value).toBe(true)
    await expect(result.close('s-1')).rejects.toThrow(/en curso/)
    resolve(CLOSING)
    await first
    expect(result.isClosing.value).toBe(false)
    expect(api.closeSession).toHaveBeenCalledTimes(1)
  })

  it('never sends without an active principal', async () => {
    auth.user = null
    const { result } = mountWithQuery(() => useCashClose())

    await expect(result.close('s-1')).rejects.toThrow(/no está activa/)
    expect(api.closeSession).not.toHaveBeenCalled()
  })
})

describe('useCashClosingsList', () => {
  it('reads the page with the given filters', async () => {
    api.listClosings!.mockResolvedValue({ items: [], page: 2, limit: 10, total: 11 })
    const params = ref({ page: 2, limit: 10, registerId: 'r-1' })
    const { result } = mountWithQuery(() => useCashClosingsList(params))
    await flush()

    expect(api.listClosings).toHaveBeenCalledWith({ page: 2, limit: 10, registerId: 'r-1' })
    expect(result.total.value).toBe(11)
  })

  it('does not read without read:CashClosing', async () => {
    auth.permissionCodes = ['create:CashClosing']
    mountWithQuery(() => useCashClosingsList({ page: 1, limit: 10 }))
    await flush()
    expect(api.listClosings).not.toHaveBeenCalled()
  })
})

describe('useCashClosingDetail', () => {
  it('reads one corte under the principal-scoped key', async () => {
    api.getClosing!.mockResolvedValue(CLOSING)
    const { result, queryClient } = mountWithQuery(() => useCashClosingDetail(CLOSING.id))
    await flush()

    expect(api.getClosing).toHaveBeenCalledWith(CLOSING.id)
    expect(result.closing.value).toEqual(CLOSING)
    const key = cashQueryKeys.closingDetail(
      { tenantId: 'tenant-1', userId: 'super-1', permissionFingerprint: expect.any(String), generation: expect.any(Number) } as never,
      CLOSING.id,
    )
    expect(key).toContain('closings')
    expect(queryClient.getQueryCache().getAll().length).toBe(1)
  })
})
