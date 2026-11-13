import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStreamClient } from '../stream-client'
import type { RealtimeAuthPort, RealtimeEnvelope } from '../types'
import {
  createFetchMock,
  errorResponse,
  flush,
  sse,
  streamResponse,
  type FakeResponse,
} from './helpers'

interface Setup {
  f: ReturnType<typeof createFetchMock>
  events: RealtimeEnvelope[]
  statuses: Array<{ state: string; reason?: string }>
  auth: RealtimeAuthPort & { token: string | null; refresh: ReturnType<typeof vi.fn> }
  client: ReturnType<typeof createStreamClient>
}

function setup(over: { random?: () => number; refresh?: (stale: string | null) => Promise<boolean> } = {}): Setup {
  const f = createFetchMock()
  const events: RealtimeEnvelope[] = []
  const statuses: Setup['statuses'] = []
  const auth = {
    token: 't1' as string | null,
    getAccessToken: () => auth.token,
    refresh: vi.fn(
      over.refresh ??
        (async () => {
          auth.token = 't2'
          return true
        }),
    ),
  }
  const client = createStreamClient({
    baseUrl: 'http://api.test',
    fetch: f.fetch,
    auth,
    random: over.random ?? (() => 0),
    onEvent: (e) => events.push(e),
    onStatus: (s) => statuses.push(s),
  })
  return { f, events, statuses, auth, client }
}

async function open(s: Setup, res: FakeResponse = streamResponse()) {
  s.f.enqueue(res.response)
  s.client.start()
  await flush()
  return res
}

const last = (s: Setup) => s.statuses[s.statuses.length - 1]

describe('stream client', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('connect', () => {
    it('GETs /realtime/stream with the Bearer token, no Last-Event-ID, no EventSource', async () => {
      const s = setup()
      await open(s)
      expect(s.f.calls).toHaveLength(1)
      expect(s.f.calls[0]!.url).toBe('http://api.test/realtime/stream')
      expect(s.f.calls[0]!.headers.authorization).toBe('Bearer t1')
      expect(s.f.calls[0]!.headers['last-event-id']).toBeUndefined()
      expect(s.f.calls[0]!.headers.accept).toBe('text/event-stream')
      expect(last(s)!.state).toBe('open')
    })

    it('dispatches parsed events with their id and does not forward heartbeats', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push('retry: 3000\n\n')
      res.stream.push(sse('ready', { serverTime: 'x', heartbeatSeconds: 15 }, 10))
      res.stream.push(sse('heartbeat', { serverTime: 'x' }))
      res.stream.push(sse('request.claimed', { request: { id: 'r1' } }, 11))
      await flush()
      expect(s.events).toEqual([
        { type: 'ready', id: '10', data: { serverTime: 'x', heartbeatSeconds: 15 } },
        { type: 'request.claimed', id: '11', data: { request: { id: 'r1' } } },
      ])
      expect(s.client.getCursor()).toBe('11')
    })

    it('drops messages whose data is not valid JSON', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push('id: 3\nevent: request.created\ndata: {oops\n\n')
      res.stream.push(sse('request.created', { ok: true }, 4))
      await flush()
      expect(s.events.map((e) => e.id)).toEqual(['4'])
    })

    it('dedupes an id it already processed', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.updated', { n: 1 }, 7))
      res.stream.push(sse('request.updated', { n: 1 }, 7))
      await flush()
      expect(s.events).toHaveLength(1)
    })

    it('control events without an id never move the cursor', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.created', { n: 1 }, 20))
      res.stream.push(sse('heartbeat', {}))
      await flush()
      expect(s.client.getCursor()).toBe('20')
    })

    it('stop() aborts the request and never retries', async () => {
      const s = setup()
      await open(s)
      const signal = s.f.calls[0]!.signal
      s.client.stop()
      expect(signal.aborted).toBe(true)
      expect(last(s)!.state).toBe('idle')
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(1)
    })
  })

  describe('reconnect and backoff', () => {
    it('reconnects after the stream ends, with Last-Event-ID, 3 s later', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.created', { n: 1 }, 42))
      await flush()
      const second = streamResponse()
      s.f.enqueue(second.response)
      res.stream.close()
      await flush()
      expect(last(s)!.state).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(2_999)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(2)
      expect(s.f.calls[1]!.headers['last-event-id']).toBe('42')
      expect(last(s)!.state).toBe('open')
    })

    it('doubles the delay 3 → 6 → 12 → 24 → 30 (cap) while attempts fail', async () => {
      const s = setup()
      s.f.enqueue(new Error('down'), new Error('down'), new Error('down'), new Error('down'), new Error('down'), new Error('down'))
      s.client.start()
      await flush()
      const delays = [3_000, 6_000, 12_000, 24_000, 30_000, 30_000]
      for (let i = 0; i < delays.length; i++) {
        expect(s.f.calls).toHaveLength(i + 1)
        await vi.advanceTimersByTimeAsync(delays[i]! - 1)
        expect(s.f.calls).toHaveLength(i + 1)
        await vi.advanceTimersByTimeAsync(1)
        expect(s.f.calls).toHaveLength(i + 2)
      }
    })

    it('adds jitter on top of the base delay but never exceeds 30 s', async () => {
      const s = setup({ random: () => 1 })
      s.f.enqueue(new Error('down'), new Error('down'))
      s.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(750)
      expect(s.f.calls).toHaveLength(2)
      // second delay: 6 s base + 25 % = 7.5 s
      await vi.advanceTimersByTimeAsync(7_499)
      expect(s.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(3)
    })

    it('resets the backoff once a message arrives', async () => {
      const s = setup()
      const ok = streamResponse()
      s.f.enqueue(new Error('down'), new Error('down'), ok.response)
      s.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(3_000) // call 2 fails
      await vi.advanceTimersByTimeAsync(6_000) // call 3 opens
      expect(s.f.calls).toHaveLength(3)
      ok.stream.push(sse('request.created', { n: 1 }, 1))
      await flush()
      s.f.enqueue(streamResponse().response)
      ok.stream.close()
      await flush()
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(4)
    })

    it('uses the retry: hint as the first delay', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push('retry: 5000\n\n')
      await flush()
      s.f.enqueue(streamResponse().response)
      res.stream.close()
      await flush()
      await vi.advanceTimersByTimeAsync(4_999)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(2)
    })

    it('reconnects after a mid-stream network error', async () => {
      const s = setup()
      const res = await open(s)
      s.f.enqueue(streamResponse().response)
      res.stream.error()
      await flush()
      expect(last(s)!.state).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
    })
  })

  describe('heartbeat watchdog', () => {
    it('treats 45 s of silence as dead, aborts and reconnects with Last-Event-ID', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.created', { n: 1 }, 5))
      await flush()
      const signal = s.f.calls[0]!.signal
      s.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(44_999)
      expect(signal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(signal.aborted).toBe(true)
      expect(last(s)!.state).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
      expect(s.f.calls[1]!.headers['last-event-id']).toBe('5')
    })

    it('any chunk (a heartbeat every 15 s) keeps the connection alive', async () => {
      const s = setup()
      const res = await open(s)
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(15_000)
        res.stream.push(sse('heartbeat', { serverTime: 'x' }))
        await flush()
      }
      expect(s.f.calls).toHaveLength(1)
      expect(last(s)!.state).toBe('open')
    })

    it('a comment chunk also counts as activity', async () => {
      const s = setup()
      const res = await open(s)
      await vi.advanceTimersByTimeAsync(40_000)
      res.stream.push(': ping\n\n')
      await flush()
      await vi.advanceTimersByTimeAsync(40_000)
      expect(s.f.calls).toHaveLength(1)
    })
  })

  describe('HTTP errors', () => {
    it('503 honours Retry-After when longer than the backoff', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(503, { 'Retry-After': '5' }, { code: 'STREAM_CAPACITY' }))
      s.client.start()
      await flush()
      s.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(4_999)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(2)
    })

    it('503 REALTIME_UNAVAILABLE without a usable Retry-After falls back to the backoff', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(503, { 'Retry-After': 'soon' }, { code: 'REALTIME_UNAVAILABLE' }))
      s.client.start()
      await flush()
      s.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
    })

    it('401 refreshes once and reconnects with the new token, keeping Last-Event-ID', async () => {
      const s = setup()
      const first = await open(s)
      first.stream.push(sse('request.created', { n: 1 }, 9))
      await flush()
      first.stream.close()
      await flush()
      s.f.enqueue(errorResponse(401), streamResponse().response)
      await vi.advanceTimersByTimeAsync(3_000)
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(s.auth.refresh).toHaveBeenCalledWith('t1')
      expect(s.f.calls).toHaveLength(3)
      expect(s.f.calls[2]!.headers.authorization).toBe('Bearer t2')
      expect(s.f.calls[2]!.headers['last-event-id']).toBe('9')
      expect(last(s)!.state).toBe('open')
    })

    it('a second 401 right after a refresh stops with reason unauthorized', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(401), errorResponse(401))
      s.client.start()
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(last(s)).toEqual({ state: 'stopped', reason: 'unauthorized' })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(2)
    })

    it('stops with unauthorized when the refresh fails', async () => {
      const s = setup({ refresh: async () => false })
      s.f.enqueue(errorResponse(401))
      s.client.start()
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'unauthorized' })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(1)
    })

    it('allows a new refresh after a connection succeeded again', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(401))
      const ok = streamResponse()
      s.f.enqueue(ok.response)
      s.client.start()
      await flush()
      ok.stream.push(sse('request.created', { n: 1 }, 1))
      await flush()
      s.f.enqueue(errorResponse(401), streamResponse().response)
      ok.stream.close()
      await vi.advanceTimersByTimeAsync(3_000)
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(2)
      expect(last(s)!.state).toBe('open')
    })

    it('403 stops with reason forbidden and never retries', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(403))
      s.client.start()
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'forbidden' })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(1)
    })

    it('400 drops the cursor and retries once without it', async () => {
      const s = setup()
      const first = await open(s)
      first.stream.push(sse('request.created', { n: 1 }, 77))
      await flush()
      first.stream.close()
      await flush()
      s.f.enqueue(errorResponse(400, {}, { code: 'VALIDATION_ERROR' }), streamResponse().response)
      await vi.advanceTimersByTimeAsync(3_000)
      await flush()
      expect(s.f.calls[1]!.headers['last-event-id']).toBe('77')
      expect(s.f.calls[2]!.headers['last-event-id']).toBeUndefined()
      expect(s.client.getCursor()).toBeNull()
    })

    it('a 400 that persists without a cursor stops with reason error', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(400))
      s.client.start()
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'error' })
    })

    it('other statuses (502) retry with backoff', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(502), streamResponse().response)
      s.client.start()
      await flush()
      expect(last(s)!.state).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
    })
  })

  describe('control events', () => {
    it('resync is forwarded, the stream stays open and the cursor moves to its id', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('resync', { reason: 'CURSOR_EXPIRED' }, 500))
      await flush()
      expect(s.events).toEqual([{ type: 'resync', id: '500', data: { reason: 'CURSOR_EXPIRED' } }])
      expect(s.client.getCursor()).toBe('500')
      expect(last(s)!.state).toBe('open')
      expect(s.f.calls).toHaveLength(1)
    })

    it('auth-expired refreshes and reconnects at once with Last-Event-ID', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.created', { n: 1 }, 31))
      await flush()
      s.f.enqueue(streamResponse().response)
      res.stream.push(sse('auth-expired', {}))
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(s.f.calls).toHaveLength(2)
      expect(s.f.calls[1]!.headers.authorization).toBe('Bearer t2')
      expect(s.f.calls[1]!.headers['last-event-id']).toBe('31')
      expect(s.events.map((e) => e.type)).toEqual(['request.created'])
    })

    it('auth-expired with a failed refresh stops with unauthorized', async () => {
      const s = setup({ refresh: async () => false })
      const res = await open(s)
      res.stream.push(sse('auth-expired', {}))
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'unauthorized' })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(1)
    })

    it('access-revoked stops without reconnecting', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('access-revoked', { reason: 'PERMISSION_REVOKED' }))
      res.stream.close()
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'revoked' })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(1)
    })

    it('connection-replaced stops without auto reconnect; reconnect() restarts it', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.created', { n: 1 }, 8))
      res.stream.push(sse('connection-replaced', {}))
      res.stream.close()
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'replaced' })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(1)
      s.f.enqueue(streamResponse().response)
      s.client.reconnect()
      await flush()
      expect(s.f.calls).toHaveLength(2)
      expect(s.f.calls[1]!.headers['last-event-id']).toBe('8')
      expect(last(s)!.state).toBe('open')
    })

    it('slow-consumer reconnects with Last-Event-ID and backs off when it repeats', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.created', { n: 1 }, 2))
      res.stream.push(sse('slow-consumer', { reason: 'BUFFER_FULL' }))
      await flush()
      const second = streamResponse()
      s.f.enqueue(second.response)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
      expect(s.f.calls[1]!.headers['last-event-id']).toBe('2')
      // it repeats right after reconnecting: the next wait must be longer
      second.stream.push(sse('request.created', { n: 2 }, 3))
      second.stream.push(sse('slow-consumer', { reason: 'BACKLOG' }))
      await flush()
      s.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(3)
    })

    it('server-shutdown reconnects with Last-Event-ID after the backoff', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('request.created', { n: 1 }, 12))
      res.stream.push(sse('server-shutdown', { reason: 'SHUTDOWN' }))
      await flush()
      s.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
      expect(s.f.calls[1]!.headers['last-event-id']).toBe('12')
    })

    it('server-unavailable reconnects no sooner than 5 s', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('server-unavailable', { reason: 'REALTIME_UNAVAILABLE' }))
      await flush()
      s.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(4_999)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(2)
    })

    it('forwards unknown event names untouched (the bus filters them) and keeps going', async () => {
      const s = setup()
      const res = await open(s)
      res.stream.push(sse('who-knows', {}, 3))
      res.stream.push(sse('request.created', { n: 1 }, 4))
      await flush()
      expect(s.events.map((e) => e.type)).toEqual(['who-knows', 'request.created'])
    })
  })
})
