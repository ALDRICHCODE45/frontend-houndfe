/**
 * useCashSessions / useCashSessionDetail — scope, identity and tenant isolation.
 *
 * Security rules under test:
 *   - `cashierUserId` may only travel with `read:CashSessionAudit`; without it
 *     the filter is DROPPED (the backend applies the filter before visibility,
 *     so a foreign-cashier filter would silently return no rows).
 *   - A session detail is NOT the same document for two principals: the cashier
 *     gets a blind owner projection, an audit reader a wider one. Therefore the
 *     cache slot must be scoped by tenant + user + permission generation, and a
 *     same-tenant user switch (or a permission change) must NEVER reuse the
 *     previous principal's slot.
 *   - The detail query function reads the identity it CAPTURED, never the live
 *     selection, after the async boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'
import type { Mock } from 'vitest'

vi.mock('../../api/cash.api', () => ({
  cashApi: { listSessions: vi.fn(), getSession: vi.fn() },
}))

const auth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: ['read:CashSession'] as string[],
  permissionsLoaded: true,
  userCan: vi.fn(
    (action: string, subject: string) => action === 'read' && subject === 'CashSession',
  ),
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { authStorage } from '@/features/auth/services/auth-storage'
import { cashApi } from '../../api/cash.api'
import { useCashSessionDetail, useCashSessions } from '../useCashSessions'

const api = cashApi as unknown as { listSessions: Mock; getSession: Mock }

function mountWithQuery<T>(composable: () => T) {
  let result!: T
  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { result, queryClient, wrapper }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/**
 * Advance the REAL session lifecycle generation (login / logout / switch). The
 * mocked auth store only mirrors the reactive fields the app publishes.
 */
function beginNewSessionLifecycle(token: string) {
  auth.accessToken = token
  authStorage.setTokens({ accessToken: token, refreshToken: `${token}-refresh` })
}

function detailPayload(sessionId: string, marker = 'STALE') {
  return {
    marker,
    session: {
      id: sessionId,
      tenantId: 'tenant-1',
      registerId: 'r-1',
      status: 'OPEN',
      cashierUserId: 'user-1',
      openingCents: 0,
      frozenAt: null,
      drawerReleasedAt: null,
      blind: true,
    },
    register: null,
    movements: [],
    counts: [],
    handovers: [],
    closing: null,
    channelSnapshot: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.accessToken = 'token-1'
  auth.currentTenantId = 'tenant-1'
  auth.user = { id: 'user-1' }
  auth.permissionCodes = ['read:CashSession']
  auth.permissionsLoaded = true
  auth.userCan.mockImplementation(
    (action: string, subject: string) => action === 'read' && subject === 'CashSession',
  )
  api.listSessions.mockResolvedValue({ items: [], page: 1, limit: 25, total: 0 })
  api.getSession.mockImplementation((id: string) => Promise.resolve(detailPayload(id)))
})

// Every mounted test component is unmounted so its query observers cannot leak
// into the next test (the auth stub is a module-level reactive shared by all of them).
enableAutoUnmount(afterEach)

describe('useCashSessions · audit scope', () => {
  it('drops cashierUserId from the outbound params without read:CashSessionAudit', async () => {
    const { result } = mountWithQuery(() =>
      useCashSessions(() => ({ page: 1, limit: 25, cashierUserId: 'other-cashier' })),
    )
    await flush()

    expect(result.effectiveParams.value.cashierUserId).toBeUndefined()
    expect(api.listSessions.mock.calls[0]![0]).toEqual({ page: 1, limit: 25 })
    expect(result.canFilterByCashier.value).toBe(false)
  })

  it('keeps cashierUserId when read:CashSessionAudit is granted', async () => {
    auth.userCan.mockImplementation(() => true)
    const { result } = mountWithQuery(() =>
      useCashSessions(() => ({ page: 1, limit: 25, cashierUserId: 'other-cashier' })),
    )
    await flush()

    expect(result.effectiveParams.value.cashierUserId).toBe('other-cashier')
    expect(api.listSessions.mock.calls[0]![0]).toEqual({
      page: 1,
      limit: 25,
      cashierUserId: 'other-cashier',
    })
    expect(result.canFilterByCashier.value).toBe(true)
  })
})

describe('useCashSessions · principal-scoped cache slots', () => {
  it('does NOT reuse another user’s session list after a same-tenant user switch', async () => {
    mountWithQuery(() => useCashSessions(() => ({ page: 1, limit: 25 })))
    await flush()
    expect(api.listSessions).toHaveBeenCalledTimes(1)

    auth.user = { id: 'user-2' }
    await flush()
    await flush()

    expect(api.listSessions).toHaveBeenCalledTimes(2)
  })

  it('does NOT reuse the previous slot after a permission-generation change', async () => {
    mountWithQuery(() => useCashSessions(() => ({ page: 1, limit: 25 })))
    await flush()

    auth.permissionCodes = ['read:CashSession', 'read:CashSessionAudit']
    await flush()
    await flush()

    expect(api.listSessions).toHaveBeenCalledTimes(2)
  })

  it('does not query without an active user, even with a tenant', async () => {
    auth.user = null
    mountWithQuery(() => useCashSessions(() => ({ page: 1, limit: 25 })))
    await flush()

    expect(api.listSessions).not.toHaveBeenCalled()
  })
})

describe('useCashSessionDetail · captures the identity it queried', () => {
  it('does not fetch until a session id is set', async () => {
    const id = ref<string | null>(null)
    mountWithQuery(() => useCashSessionDetail(id))
    await flush()
    expect(api.getSession).not.toHaveBeenCalled()

    id.value = 's-1'
    await flush()
    await flush()
    expect(api.getSession).toHaveBeenCalledWith('s-1')
  })

  it('never fires for an empty tenant or without a user', async () => {
    auth.currentTenantId = ''
    mountWithQuery(() => useCashSessionDetail(ref('s-1')))
    await flush()
    expect(api.getSession).not.toHaveBeenCalled()
  })

  it('queries the captured id and keeps each slot’s payload separate', async () => {
    const id = ref<string | null>('s-1')
    const { result } = mountWithQuery(() => useCashSessionDetail(id))
    await flush()
    await flush()

    expect(result.detail.value?.session.id).toBe('s-1')

    id.value = 's-2'
    await flush()
    await flush()

    // The second read must be for the NEW selection only; the first slot is not
    // returned for it, and no re-read of a stale id happens.
    expect(api.getSession.mock.calls.map((call) => call[0])).toEqual(['s-1', 's-2'])
    expect(result.detail.value?.session.id).toBe('s-2')
  })

  it('does NOT reuse the previous session slot after a same-identity logout/login', async () => {
    mountWithQuery(() => useCashSessions(() => ({ page: 1, limit: 25 })))
    await flush()
    expect(api.listSessions).toHaveBeenCalledTimes(1)

    // Same user, same tenant, same permissions — a NEW session lifecycle.
    beginNewSessionLifecycle('token-2')
    await flush()
    await flush()

    expect(api.listSessions).toHaveBeenCalledTimes(2)
  })

  it('does not leak the previous session’s detail into the new lifecycle slot', async () => {
    const id = ref<string | null>('s-1')
    const stale = deferred<unknown>()
    const live = deferred<unknown>()
    api.getSession.mockReturnValueOnce(stale.promise).mockReturnValueOnce(live.promise)

    const { result } = mountWithQuery(() => useCashSessionDetail(id))
    await flush()
    await flush()
    expect(api.getSession).toHaveBeenCalledTimes(1)

    // Re-login with the SAME identity while the first read is still pending. The
    // new lifecycle starts its OWN read, which stays pending for now.
    beginNewSessionLifecycle('token-2')
    await flush()
    await flush()
    expect(api.getSession).toHaveBeenCalledTimes(2)

    // The stale response belongs to the previous lifecycle: it must not populate
    // the slot the new lifecycle is reading (which is still pending).
    stale.resolve(detailPayload('s-1', 'STALE'))
    await flush()
    expect(result.detail.value).toBeUndefined()

    live.resolve(detailPayload('s-1', 'LIVE'))
    await flush()
    await flush()
    expect((result.detail.value as unknown as { marker?: string } | undefined)?.marker).toBe('LIVE')
  })

  it('does not leak the previous user’s detail slot to the next user', async () => {
    const id = ref<string | null>('s-1')
    mountWithQuery(() => useCashSessionDetail(id))
    await flush()
    await flush()
    expect(api.getSession).toHaveBeenCalledTimes(1)

    auth.user = { id: 'user-2' }
    await flush()
    await flush()

    expect(api.getSession).toHaveBeenCalledTimes(2)
  })
})
