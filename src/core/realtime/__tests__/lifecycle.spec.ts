import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import { startRealtimeLifecycle, type RealtimeAuthState } from '../lifecycle'
import type { RealtimeService } from '../realtime-service'
import { setRealtimeServiceForTests, useRealtime } from '../useRealtime'
import type { RealtimeStatus } from '../types'

function fakeService() {
  const statusHandlers = new Set<(s: RealtimeStatus) => void>()
  const offs: Array<ReturnType<typeof vi.fn>> = []
  const service = {
    start: vi.fn(),
    stop: vi.fn(),
    reconnect: vi.fn(),
    getStatus: vi.fn(() => ({ state: 'idle', role: 'none' }) as RealtimeStatus),
    on: vi.fn(() => {
      const off = vi.fn()
      offs.push(off)
      return off
    }),
    onAny: vi.fn(() => vi.fn()),
    onStatus: vi.fn((h: (s: RealtimeStatus) => void) => {
      statusHandlers.add(h)
      return () => statusHandlers.delete(h)
    }),
  }
  return { service: service as unknown as RealtimeService, mocks: service, offs, statusHandlers }
}

describe('startRealtimeLifecycle', () => {
  it('starts on login with user + tenant, restarts on tenant switch, stops on logout', () => {
    const { service, mocks } = fakeService()
    const auth = reactive<RealtimeAuthState>({ isAuthenticated: false, user: null, currentTenantId: '' })
    const stop = startRealtimeLifecycle(auth, service)
    expect(mocks.start).not.toHaveBeenCalled()

    auth.isAuthenticated = true
    auth.user = { id: 'u1' }
    auth.currentTenantId = 't1'
    expect(mocks.start).toHaveBeenLastCalledWith({ userId: 'u1', tenantId: 't1' })

    auth.currentTenantId = 't2'
    expect(mocks.start).toHaveBeenLastCalledWith({ userId: 'u1', tenantId: 't2' })

    auth.isAuthenticated = false
    expect(mocks.stop).toHaveBeenCalled()

    stop()
  })

  it('does not start without a tenant (super admin outside a branch) or without a user id', () => {
    const { service, mocks } = fakeService()
    const auth = reactive<RealtimeAuthState>({ isAuthenticated: true, user: { id: 'u1' }, currentTenantId: '' })
    const stop = startRealtimeLifecycle(auth, service)
    expect(mocks.start).not.toHaveBeenCalled()
    auth.user = null
    auth.currentTenantId = 't1'
    expect(mocks.start).not.toHaveBeenCalled()
    stop()
  })

  it('the returned function stops watching and stops the stream', () => {
    const { service, mocks } = fakeService()
    const auth = reactive<RealtimeAuthState>({ isAuthenticated: false, user: null, currentTenantId: '' })
    const stop = startRealtimeLifecycle(auth, service)
    stop()
    auth.isAuthenticated = true
    auth.user = { id: 'u1' }
    auth.currentTenantId = 't1'
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.stop).toHaveBeenCalled()
  })
})

describe('startRealtimeLifecycle — read:ChatbotRequest gate', () => {
  it('opens no stream for a user without read:ChatbotRequest, starts when granted, stops when revoked', () => {
    const { service, mocks } = fakeService()
    const allowed = ref(false)
    const asked: Array<[string, string]> = []
    const auth = reactive<RealtimeAuthState>({
      isAuthenticated: true,
      user: { id: 'u1' },
      currentTenantId: 't1',
      userCan: (action: string, subject: string) => {
        asked.push([action, subject])
        return allowed.value
      },
    })
    const stop = startRealtimeLifecycle(auth, service)
    expect(mocks.start).not.toHaveBeenCalled()
    expect(asked[0]).toEqual(['read', 'ChatbotRequest'])

    allowed.value = true
    expect(mocks.start).toHaveBeenLastCalledWith({ userId: 'u1', tenantId: 't1' })

    mocks.stop.mockClear()
    allowed.value = false
    expect(mocks.stop).toHaveBeenCalledTimes(1)
    stop()
  })

  it('keeps starting for a state that carries no permission check (backwards compatible)', () => {
    const { service, mocks } = fakeService()
    const auth = reactive<RealtimeAuthState>({ isAuthenticated: true, user: { id: 'u1' }, currentTenantId: 't1' })
    const stop = startRealtimeLifecycle(auth, service)
    expect(mocks.start).toHaveBeenCalledWith({ userId: 'u1', tenantId: 't1' })
    stop()
  })
})

describe('startRealtimeLifecycle — access-revoked (handoff 17 §7)', () => {
  const revoked: RealtimeStatus = { state: 'stopped', role: 'leader', reason: 'revoked' }

  it('refetches the permissions/session when the stream stops as revoked, once per stop', async () => {
    const { service, statusHandlers } = fakeService()
    const fetchPermissions = vi.fn(async () => null)
    const auth = reactive<RealtimeAuthState>({
      isAuthenticated: true,
      user: { id: 'u1' },
      currentTenantId: 't1',
      fetchPermissions,
    })
    const stop = startRealtimeLifecycle(auth, service)
    expect(fetchPermissions).not.toHaveBeenCalled()
    for (const h of statusHandlers) h(revoked)
    expect(fetchPermissions).toHaveBeenCalledTimes(1)
    for (const h of statusHandlers) h({ state: 'stopped', role: 'follower', reason: 'revoked' })
    expect(fetchPermissions).toHaveBeenCalledTimes(2) // another tab's stop is another revoke for this tab's store
    stop()
  })

  it.each<RealtimeStatus>([
    { state: 'open', role: 'leader' },
    { state: 'stopped', role: 'leader', reason: 'replaced' },
    { state: 'stopped', role: 'leader', reason: 'identity-mismatch' },
    { state: 'stopped', role: 'leader', reason: 'forbidden' },
    { state: 'reconnecting', role: 'leader' },
  ])('does not refetch for status %o', (status) => {
    const { service, statusHandlers } = fakeService()
    const fetchPermissions = vi.fn(async () => null)
    const auth = reactive<RealtimeAuthState>({
      isAuthenticated: true,
      user: { id: 'u1' },
      currentTenantId: 't1',
      fetchPermissions,
    })
    const stop = startRealtimeLifecycle(auth, service)
    for (const h of statusHandlers) h(status)
    expect(fetchPermissions).not.toHaveBeenCalled()
    stop()
  })

  it('does not reconnect by itself (no loop); a failed refetch is swallowed', async () => {
    const { service, mocks, statusHandlers } = fakeService()
    const fetchPermissions = vi.fn(async () => {
      throw new Error('network')
    })
    const auth = reactive<RealtimeAuthState>({
      isAuthenticated: true,
      user: { id: 'u1' },
      currentTenantId: 't1',
      fetchPermissions,
    })
    const stop = startRealtimeLifecycle(auth, service)
    mocks.start.mockClear()
    for (const h of statusHandlers) h(revoked)
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchPermissions).toHaveBeenCalledTimes(1)
    expect(mocks.reconnect).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    stop()
  })

  it('works without a fetchPermissions port, and stops listening when the lifecycle stops', () => {
    const { service, statusHandlers } = fakeService()
    const fetchPermissions = vi.fn(async () => null)
    const bare = reactive<RealtimeAuthState>({ isAuthenticated: true, user: { id: 'u1' }, currentTenantId: 't1' })
    const stopBare = startRealtimeLifecycle(bare, service)
    expect(() => {
      for (const h of statusHandlers) h(revoked)
    }).not.toThrow()
    stopBare()

    const withPort = reactive<RealtimeAuthState>({
      isAuthenticated: true,
      user: { id: 'u1' },
      currentTenantId: 't1',
      fetchPermissions,
    })
    const stop = startRealtimeLifecycle(withPort, service)
    stop()
    expect(statusHandlers.size).toBe(0)
  })

  it('restarts through the normal watch when the refetched permissions drop read:ChatbotRequest', () => {
    const { service, mocks, statusHandlers } = fakeService()
    const allowed = ref(true)
    const auth = reactive<RealtimeAuthState>({
      isAuthenticated: true,
      user: { id: 'u1' },
      currentTenantId: 't1',
      userCan: () => allowed.value,
      fetchPermissions: async () => {
        allowed.value = false
        return null
      },
    })
    const stop = startRealtimeLifecycle(auth, service)
    mocks.stop.mockClear()
    for (const h of statusHandlers) h(revoked)
    return Promise.resolve().then(() => {
      expect(mocks.stop).toHaveBeenCalledTimes(1)
      stop()
    })
  })
})

describe('useRealtime', () => {
  afterEach(() => setRealtimeServiceForTests(null))

  it('unsubscribes everything when the calling scope is disposed and tracks status reactively', () => {
    const { service, offs, statusHandlers } = fakeService()
    setRealtimeServiceForTests(service)
    const scope = effectScope()
    const api = scope.run(() => {
      const rt = useRealtime()
      rt.on('request.updated', () => {})
      return rt
    })!
    expect(api.status.value.state).toBe('idle')
    for (const h of statusHandlers) h({ state: 'open', role: 'leader' })
    expect(api.status.value).toEqual({ state: 'open', role: 'leader' })

    scope.stop()
    expect(offs[0]).toHaveBeenCalledTimes(1)
    expect(statusHandlers.size).toBe(0)
  })

  it('reconnect delegates to the service', () => {
    const { service, mocks } = fakeService()
    setRealtimeServiceForTests(service)
    useRealtime().reconnect()
    expect(mocks.reconnect).toHaveBeenCalledTimes(1)
  })
})
