import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRealtimeService, type RealtimeService } from '../realtime-service'
import type { RealtimeAuthPort, RealtimeStatus } from '../types'
import {
  createChannelHub,
  createFetchMock,
  createLockRegistry,
  flush,
  sse,
  streamResponse,
} from './helpers'

const IDENTITY = { userId: 'u1', tenantId: 't1' }

function makeAuth(): RealtimeAuthPort {
  const auth = {
    token: 'tok' as string | null,
    getAccessToken: () => auth.token,
    refresh: async () => true,
  }
  return auth
}

function tab(
  env: {
    fetch: typeof fetch
    locks?: ReturnType<ReturnType<typeof createLockRegistry>['tab']>['facade'] | null
    hub?: ReturnType<typeof createChannelHub> | null
  },
  enabled = true,
) {
  const statuses: RealtimeStatus[] = []
  const service = createRealtimeService({
    enabled: () => enabled,
    baseUrl: 'http://api.test',
    fetch: env.fetch,
    auth: makeAuth(),
    locks: env.locks ?? null,
    createChannel: env.hub ? env.hub.create : null,
    random: () => 0,
  })
  service.onStatus((s) => statuses.push({ ...s }))
  return { service, statuses }
}

const lastStatus = (t: { statuses: RealtimeStatus[] }) => t.statuses[t.statuses.length - 1]

describe('realtime service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('feature flag', () => {
    it('does nothing when the flag is off: no fetch, no lock, status idle', async () => {
      const f = createFetchMock()
      const reg = createLockRegistry()
      const { service } = tab({ fetch: f.fetch, locks: reg.tab().facade }, false)
      service.start(IDENTITY)
      await flush()
      expect(f.calls).toHaveLength(0)
      expect(reg.held.size).toBe(0)
      expect(service.getStatus()).toEqual({ state: 'idle', role: 'none' })
    })

    it('reads VITE_REALTIME_SSE by default and treats anything but "true" as off', async () => {
      const { isRealtimeEnabled } = await import('../config')
      expect(isRealtimeEnabled({ VITE_REALTIME_SSE: 'true' })).toBe(true)
      expect(isRealtimeEnabled({ VITE_REALTIME_SSE: 'TRUE' })).toBe(true)
      expect(isRealtimeEnabled({ VITE_REALTIME_SSE: '1' })).toBe(true)
      expect(isRealtimeEnabled({ VITE_REALTIME_SSE: 'false' })).toBe(false)
      expect(isRealtimeEnabled({ VITE_REALTIME_SSE: '' })).toBe(false)
      expect(isRealtimeEnabled({})).toBe(false)
    })
  })

  describe('single tab (no Web Locks, no BroadcastChannel)', () => {
    it('connects as leader and delivers typed events to subscribers', async () => {
      const f = createFetchMock()
      const res = streamResponse()
      f.enqueue(res.response)
      const t = tab({ fetch: f.fetch })
      const claimed = vi.fn()
      const created = vi.fn()
      t.service.on('request.claimed', claimed)
      t.service.on('notification.created', created)
      t.service.start(IDENTITY)
      await flush()
      expect(lastStatus(t)).toEqual({ state: 'open', role: 'leader' })

      const payload = { request: { id: 'r1', version: 3 }, customer: {}, previousCustomerKey: null }
      res.stream.push(sse('request.claimed', payload, 11))
      await flush()
      expect(claimed).toHaveBeenCalledWith(payload, { id: '11' })
      expect(created).not.toHaveBeenCalled()
    })

    it('forwards ready and resync, but not heartbeat or unknown event names', async () => {
      const f = createFetchMock()
      const res = streamResponse()
      f.enqueue(res.response)
      const t = tab({ fetch: f.fetch })
      const ready = vi.fn()
      const resync = vi.fn()
      const any = vi.fn()
      t.service.on('ready', ready)
      t.service.on('resync', resync)
      t.service.onAny(any)
      t.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('ready', { serverTime: 'x', heartbeatSeconds: 15 }, 1))
      res.stream.push(sse('heartbeat', {}))
      res.stream.push(sse('resync', { reason: 'CURSOR_EXPIRED' }, 2))
      res.stream.push(sse('something-new', {}, 3))
      await flush()
      expect(ready).toHaveBeenCalledTimes(1)
      expect(resync).toHaveBeenCalledWith({ reason: 'CURSOR_EXPIRED' }, { id: '2' })
      expect(any.mock.calls.map((c) => c[0].type)).toEqual(['ready', 'resync'])
    })

    it('delivers session.* events to session subscribers', async () => {
      const f = createFetchMock()
      const res = streamResponse()
      f.enqueue(res.response)
      const t = tab({ fetch: f.fetch })
      const handler = vi.fn()
      t.service.on('session.started', handler)
      t.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('session.started', { requestId: 'r' }, 5))
      res.stream.push(sse('session.ended', { requestId: 'r' }, 6))
      await flush()
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ requestId: 'r' }, { id: '5' })
    })

    it('unsubscribe stops delivery, and a throwing handler does not starve the others', async () => {
      const f = createFetchMock()
      const res = streamResponse()
      f.enqueue(res.response)
      const t = tab({ fetch: f.fetch })
      const bad = vi.fn(() => {
        throw new Error('boom')
      })
      const good = vi.fn()
      const gone = vi.fn()
      t.service.on('request.updated', bad)
      t.service.on('request.updated', good)
      t.service.on('request.updated', gone)()
      t.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('request.updated', { request: {} }, 1))
      await flush()
      expect(good).toHaveBeenCalledTimes(1)
      expect(gone).not.toHaveBeenCalled()
    })

    it('stop() closes the stream and goes idle; start() again connects with the stored cursor', async () => {
      const f = createFetchMock()
      const res = streamResponse()
      f.enqueue(res.response)
      const t = tab({ fetch: f.fetch })
      t.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('request.created', { request: {} }, 70))
      await flush()
      t.service.stop()
      expect(f.calls[0]!.signal.aborted).toBe(true)
      expect(t.service.getStatus()).toEqual({ state: 'idle', role: 'none' })
      await vi.advanceTimersByTimeAsync(60_000)
      expect(f.calls).toHaveLength(1)
    })

    it('calling start() twice with the same identity does not open a second stream', async () => {
      const f = createFetchMock()
      f.enqueue(streamResponse().response)
      const t = tab({ fetch: f.fetch })
      t.service.start(IDENTITY)
      t.service.start(IDENTITY)
      await flush()
      expect(f.calls).toHaveLength(1)
    })

    it('a tenant switch tears the old stream down and connects fresh without the old cursor', async () => {
      const f = createFetchMock()
      const first = streamResponse()
      f.enqueue(first.response, streamResponse().response)
      const t = tab({ fetch: f.fetch })
      t.service.start(IDENTITY)
      await flush()
      first.stream.push(sse('request.created', { request: {} }, 99))
      await flush()
      t.service.start({ userId: 'u1', tenantId: 't2' })
      await flush()
      expect(f.calls[0]!.signal.aborted).toBe(true)
      expect(f.calls).toHaveLength(2)
      expect(f.calls[1]!.headers['last-event-id']).toBeUndefined()
    })

    it('exposes a stop reason through status (connection-replaced) and reconnect() restarts', async () => {
      const f = createFetchMock()
      const res = streamResponse()
      f.enqueue(res.response)
      const t = tab({ fetch: f.fetch })
      t.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('connection-replaced', {}))
      res.stream.close()
      await flush()
      expect(lastStatus(t)).toEqual({ state: 'stopped', role: 'leader', reason: 'replaced' })
      f.enqueue(streamResponse().response)
      t.service.reconnect()
      await flush()
      expect(f.calls).toHaveLength(2)
      expect(lastStatus(t)).toEqual({ state: 'open', role: 'leader' })
    })
  })

  describe('several tabs', () => {
    function twoTabs() {
      const f = createFetchMock()
      const reg = createLockRegistry()
      const hub = createChannelHub()
      const lockA = reg.tab()
      const a = tab({ fetch: f.fetch, locks: lockA.facade, hub })
      const b = tab({ fetch: f.fetch, locks: reg.tab().facade, hub })
      return { f, reg, hub, a, b, lockA }
    }

    it('only the leader opens a connection; the follower gets every event by rebroadcast', async () => {
      const { f, a, b } = twoTabs()
      const res = streamResponse()
      f.enqueue(res.response)
      const onA = vi.fn()
      const onB = vi.fn()
      a.service.on('request.created', onA)
      b.service.on('request.created', onB)
      a.service.start(IDENTITY)
      await flush()
      b.service.start(IDENTITY)
      await flush()
      expect(f.calls).toHaveLength(1)
      expect(a.service.getStatus().role).toBe('leader')
      expect(b.service.getStatus()).toEqual({ state: 'open', role: 'follower' })

      res.stream.push(sse('request.created', { request: { id: 'r' } }, 4))
      await flush()
      expect(onA).toHaveBeenCalledTimes(1)
      expect(onB).toHaveBeenCalledTimes(1)
      expect(onB).toHaveBeenCalledWith({ request: { id: 'r' } }, { id: '4' })
    })

    it('a follower that opens later learns the current status from the leader', async () => {
      const { f, a, b } = twoTabs()
      f.enqueue(streamResponse().response)
      a.service.start(IDENTITY)
      await flush()
      b.service.start(IDENTITY)
      await flush()
      expect(b.service.getStatus()).toEqual({ state: 'open', role: 'follower' })
    })

    it('mirrors a stop reason to followers', async () => {
      const { f, a, b } = twoTabs()
      const res = streamResponse()
      f.enqueue(res.response)
      a.service.start(IDENTITY)
      await flush()
      b.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('access-revoked', { reason: 'PERMISSION_REVOKED' }))
      await flush()
      expect(b.service.getStatus()).toEqual({ state: 'stopped', role: 'follower', reason: 'revoked' })
    })

    it('a follower asking to reconnect makes the leader reconnect', async () => {
      const { f, a, b } = twoTabs()
      const res = streamResponse()
      f.enqueue(res.response)
      a.service.start(IDENTITY)
      await flush()
      b.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('connection-replaced', {}))
      res.stream.close()
      await flush()
      f.enqueue(streamResponse().response)
      b.service.reconnect()
      await flush()
      expect(f.calls).toHaveLength(2)
      expect(b.service.getStatus()).toEqual({ state: 'open', role: 'follower' })
    })

    it('when the leader tab closes the follower takes over and resumes from the last id it saw', async () => {
      const { f, a, b, lockA } = twoTabs()
      const res = streamResponse()
      f.enqueue(res.response)
      a.service.start(IDENTITY)
      await flush()
      b.service.start(IDENTITY)
      await flush()
      res.stream.push(sse('request.created', { request: {} }, 123))
      await flush()
      f.enqueue(streamResponse().response)
      a.service.stop() // tab A goes away
      lockA.close()
      await flush()
      expect(b.service.getStatus().role).toBe('leader')
      expect(f.calls).toHaveLength(2)
      expect(f.calls[1]!.headers['last-event-id']).toBe('123')
    })

    it('tabs of another tenant or user are not mixed up', async () => {
      const f = createFetchMock()
      const reg = createLockRegistry()
      const hub = createChannelHub()
      f.enqueue(streamResponse().response, streamResponse().response)
      const a = tab({ fetch: f.fetch, locks: reg.tab().facade, hub })
      const b = tab({ fetch: f.fetch, locks: reg.tab().facade, hub })
      a.service.start(IDENTITY)
      b.service.start({ userId: 'u1', tenantId: 't2' })
      await flush()
      expect(f.calls).toHaveLength(2)
      expect(a.service.getStatus().role).toBe('leader')
      expect(b.service.getStatus().role).toBe('leader')
    })
  })

  it('exposes the public API surface', () => {
    const f = createFetchMock()
    const { service } = tab({ fetch: f.fetch })
    const api: RealtimeService = service
    expect(Object.keys(api).sort()).toEqual(
      ['getStatus', 'on', 'onAny', 'onStatus', 'reconnect', 'start', 'stop'].sort(),
    )
  })
})
