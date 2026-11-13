import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
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
