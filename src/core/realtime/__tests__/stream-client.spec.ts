import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStreamClient } from '../stream-client'
import type { RealtimeAuthPort, RealtimeEnvelope, RealtimeIdentity } from '../types'
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

function setup(
  over: {
    random?: () => number
    refresh?: (stale: string | null) => Promise<boolean>
    keepToken?: boolean
    identity?: RealtimeIdentity
    tokenMatches?: (token: string, identity: RealtimeIdentity) => boolean
  } = {},
): Setup {
  const f = createFetchMock()
  const events: RealtimeEnvelope[] = []
  const statuses: Setup['statuses'] = []
  const auth = {
    token: 't1' as string | null,
    getAccessToken: () => auth.token,
    ...(over.tokenMatches ? { tokenMatches: over.tokenMatches } : {}),
    refresh: vi.fn(
      over.refresh ??
        (async () => {
          // `keepToken`: a refresh that finds the stored token still good (REST accepts it) and leaves it as is.
          if (!over.keepToken) auth.token = 't2'
          return true
        }),
    ),
  }
  const client = createStreamClient({
    baseUrl: 'http://api.test',
    fetch: f.fetch,
    auth,
    random: over.random ?? (() => 1),
    ...(over.identity ? { identity: over.identity } : {}),
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

    it('equal jitter above the 3 s floor: the first retry is never below 3 s, later ones wait between half the base and the base', async () => {
      // random 0: the first wait is spread to its top, 4.5 s (never one instant for all); then 6 s → 3 s.
      const low = setup({ random: () => 0 })
      low.f.enqueue(new Error('down'), new Error('down'))
      low.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(4_499)
      expect(low.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(low.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(2_999)
      expect(low.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(low.f.calls).toHaveLength(3)

      // random 0.5: the first retry 3.75 s, then three quarters of the base, 6 s → 4.5 s
      const mid = setup({ random: () => 0.5 })
      mid.f.enqueue(new Error('down'), new Error('down'), new Error('down'))
      mid.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(3_750)
      expect(mid.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(4_499)
      expect(mid.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(mid.f.calls).toHaveLength(3)
    })

    it('a `retry:` hint below 3 s does not lower the first wait under the 3 s floor', async () => {
      const s = setup({ random: () => 1 })
      const res = await open(s)
      res.stream.push('retry: 1000\n\n')
      await flush()
      s.f.enqueue(new Error('down'))
      res.stream.close()
      await flush()
      await vi.advanceTimersByTimeAsync(2_999)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(2)
    })

    it('equal jitter keeps the 30 s cap: base 30 s waits 15–30 s', async () => {
      const s = setup({ random: () => 1 })
      s.f.enqueue(...Array.from({ length: 7 }, () => new Error('down')))
      s.client.start()
      await flush()
      for (const delay of [3_000, 6_000, 12_000, 24_000, 30_000, 30_000]) {
        await vi.advanceTimersByTimeAsync(delay)
      }
      expect(s.f.calls).toHaveLength(7)
      const half = setup({ random: () => 0 })
      half.f.enqueue(...Array.from({ length: 8 }, () => new Error('down')))
      half.client.start()
      await flush()
      for (const delay of [4_500, 3_000, 6_000, 12_000, 15_000, 15_000]) {
        await vi.advanceTimersByTimeAsync(delay)
      }
      expect(half.f.calls).toHaveLength(7)
    })

    it('leaders that lose the stream at the same instant (a deploy) never return before 3 s and are spread already on the first retry', async () => {
      const waits: number[] = []
      for (const draw of [0, 0.25, 0.5, 0.75, 1]) {
        const s = setup({ random: () => draw })
        s.f.enqueue(new Error('down'), streamResponse().response)
        s.client.start()
        await flush()
        let waited = 0
        while (s.f.calls.length < 2 && waited < 20_000) {
          await vi.advanceTimersByTimeAsync(50)
          waited += 50
        }
        waits.push(waited)
        s.client.stop()
      }
      // jitter above the 3 s floor: the first retry is spread over 3–4.5 s instead of one instant
      expect(Math.min(...waits)).toBeGreaterThanOrEqual(3_000)
      expect(Math.max(...waits)).toBeLessThanOrEqual(4_550)
      expect(Math.max(...waits) - Math.min(...waits)).toBeGreaterThanOrEqual(1_400)
      expect(new Set(waits).size).toBe(5)
    })

    it('a floor from the server (Retry-After, server-unavailable) is spread upwards, never shortened', async () => {
      const s = setup({ random: () => 1 })
      const res = await open(s)
      res.stream.push(sse('server-unavailable', { reason: 'REALTIME_UNAVAILABLE' }))
      await flush()
      s.f.enqueue(streamResponse().response)
      // random 1 → the full spread: 5 s + 25 % = 6.25 s
      await vi.advanceTimersByTimeAsync(6_249)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(2)

      const none = setup({ random: () => 0 })
      const res2 = await open(none)
      res2.stream.push(sse('server-unavailable', { reason: 'REALTIME_UNAVAILABLE' }))
      await flush()
      none.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(4_999)
      expect(none.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(none.f.calls).toHaveLength(2)
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

  describe('connect (handshake) timeout', () => {
    const hang = () => new Promise<Response>(() => {})

    it('aborts a connect that gets no response headers within 15 s and retries with backoff', async () => {
      const s = setup()
      s.f.enqueue(hang)
      s.client.start()
      await flush()
      const signal = s.f.calls[0]!.signal
      expect(last(s)!.state).toBe('connecting')
      await vi.advanceTimersByTimeAsync(14_999)
      expect(signal.aborted).toBe(false)
      expect(last(s)!.state).toBe('connecting')
      s.f.enqueue(streamResponse().response)
      await vi.advanceTimersByTimeAsync(1)
      expect(signal.aborted).toBe(true)
      expect(last(s)!.state).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(2_999)
      expect(s.f.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(2)
      expect(last(s)!.state).toBe('open')
    })

    it('keeps backing off while connects keep stalling (3 s, then 6 s)', async () => {
      const s = setup()
      s.f.enqueue(hang, hang, streamResponse().response)
      s.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(15_000)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(15_000)
      await vi.advanceTimersByTimeAsync(5_999)
      expect(s.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(3)
    })

    it('is not armed once the headers arrive: an open stream is not cut at 15 s', async () => {
      const s = setup()
      const res = await open(s)
      const signal = s.f.calls[0]!.signal
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(10_000)
        res.stream.push(sse('heartbeat', { serverTime: 'x' }))
        await flush()
      }
      expect(signal.aborted).toBe(false)
      expect(s.f.calls).toHaveLength(1)
    })

    it('an error status inside 15 s does not leave a timer behind that cuts the next connection', async () => {
      const s = setup()
      const ok = streamResponse()
      s.f.enqueue(errorResponse(502), ok.response)
      s.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.f.calls).toHaveLength(2)
      const signal = s.f.calls[1]!.signal
      // the first attempt's 15 s mark passes while the second connection is open and healthy
      await vi.advanceTimersByTimeAsync(10_000)
      ok.stream.push(sse('heartbeat', { serverTime: 'x' }))
      await flush()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(signal.aborted).toBe(false)
      expect(s.f.calls).toHaveLength(2)
      expect(last(s)!.state).toBe('open')
    })

    it('stop() while connecting cancels the timer: no reconnecting status, no new call', async () => {
      const s = setup()
      s.f.enqueue(hang)
      s.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(5_000)
      s.client.stop()
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(1)
      expect(last(s)).toEqual({ state: 'idle' })
    })
  })

  describe('HTTP errors', () => {
    it('503 honours Retry-After when longer than the backoff', async () => {
      const s = setup({ random: () => 0 })
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

    it('a second 401 right after a refresh backs off and retries later (bounded), it does not stop for good', async () => {
      const s = setup({ random: () => 1 })
      s.f.enqueue(errorResponse(401), errorResponse(401), errorResponse(401), errorResponse(401))
      s.client.start()
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(last(s)).toEqual({ state: 'reconnecting' })
      expect(s.f.calls).toHaveLength(2)
      // same token that already failed after a refresh: no new refresh, a longer wait each time, capped at 30 s
      for (const delay of [3_000, 6_000, 12_000, 24_000, 30_000, 30_000]) {
        s.f.enqueue(errorResponse(401))
        const before = s.f.calls.length
        await vi.advanceTimersByTimeAsync(delay - 1)
        expect(s.f.calls).toHaveLength(before)
        await vi.advanceTimersByTimeAsync(1)
        expect(s.f.calls).toHaveLength(before + 1)
      }
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(last(s)!.state).toBe('reconnecting')
    })

    it('after backing off from a second 401, the stream opens as soon as the retry is accepted, and a later 401 may refresh again', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(401), errorResponse(401))
      const ok = streamResponse()
      s.f.enqueue(ok.response)
      s.client.start()
      await flush()
      await vi.advanceTimersByTimeAsync(3_000)
      await flush()
      expect(last(s)!.state).toBe('open')
      ok.stream.push(sse('request.created', { n: 1 }, 1))
      await flush()
      s.f.enqueue(errorResponse(401), streamResponse().response)
      ok.stream.close()
      await vi.advanceTimersByTimeAsync(3_000)
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(2)
      expect(last(s)!.state).toBe('open')
    })

    it('a new stored token (another tab refreshed) earns one new refresh after backing off', async () => {
      const s = setup()
      s.f.enqueue(errorResponse(401), errorResponse(401))
      s.client.start()
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(s.auth.token).toBe('t2')
      s.auth.token = 't3' // rotated elsewhere while we back off
      s.f.enqueue(errorResponse(401), streamResponse().response)
      await vi.advanceTimersByTimeAsync(3_000)
      await flush()
      expect(s.f.calls[2]!.headers.authorization).toBe('Bearer t3')
      expect(s.auth.refresh).toHaveBeenCalledTimes(2)
      expect(s.auth.refresh).toHaveBeenLastCalledWith('t3')
      expect(last(s)!.state).toBe('open')
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

  describe('session identity of the token (D1)', () => {
    const ME = { userId: 'u1', tenantId: 't1' }
    const owns = (token: string) => token === 'mine' || token === 'mine-2'

    it('connects with a token that belongs to the session', async () => {
      const s = setup({ identity: ME, tokenMatches: (token) => owns(token) })
      s.auth.token = 'mine'
      await open(s)
      expect(s.f.calls).toHaveLength(1)
      expect(s.f.calls[0]!.headers.authorization).toBe('Bearer mine')
      expect(last(s)!.state).toBe('open')
    })

    it('a token of another user or tenant is never sent: no fetch, halts with identity-mismatch', async () => {
      const asked: Array<[string, RealtimeIdentity]> = []
      const s = setup({
        identity: ME,
        tokenMatches: (token, identity) => {
          asked.push([token, identity])
          return owns(token)
        },
      })
      s.auth.token = 'someone-else'
      s.client.start()
      await flush()
      expect(asked).toEqual([['someone-else', ME]])
      expect(s.f.calls).toHaveLength(0)
      expect(last(s)).toEqual({ state: 'stopped', reason: 'identity-mismatch' })
      await vi.advanceTimersByTimeAsync(120_000)
      expect(s.f.calls).toHaveLength(0)
    })

    it('checks again after a refresh: a refreshed token of another session is not sent', async () => {
      const s = setup({
        identity: ME,
        tokenMatches: (token) => owns(token),
        refresh: async () => {
          s.auth.token = 'someone-else' // another tab signed in while we refreshed
          return true
        },
      })
      s.auth.token = 'mine'
      s.f.enqueue(errorResponse(401))
      s.client.start()
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(s.f.calls).toHaveLength(1)
      expect(s.f.calls.map((c) => c.headers.authorization)).toEqual(['Bearer mine'])
      expect(last(s)).toEqual({ state: 'stopped', reason: 'identity-mismatch' })
    })

    it('checks before every reconnect, not only the first connect', async () => {
      const s = setup({ identity: ME, tokenMatches: (token) => owns(token) })
      s.auth.token = 'mine'
      const res = await open(s)
      s.auth.token = 'someone-else'
      res.stream.close()
      await flush()
      await vi.advanceTimersByTimeAsync(3_000)
      await flush()
      expect(s.f.calls).toHaveLength(1)
      expect(last(s)).toEqual({ state: 'stopped', reason: 'identity-mismatch' })
    })

    it('«reconnect» checks the stored token again and resumes once it is the session\'s', async () => {
      const s = setup({ identity: ME, tokenMatches: (token) => owns(token) })
      s.auth.token = 'someone-else'
      s.client.start()
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'identity-mismatch' })
      s.auth.token = 'mine-2'
      s.f.enqueue(streamResponse().response)
      s.client.reconnect()
      await flush()
      expect(s.f.calls[0]!.headers.authorization).toBe('Bearer mine-2')
      expect(last(s)!.state).toBe('open')
    })

    it('a missing token still stops as unauthorized, not as a mismatch', async () => {
      const s = setup({ identity: ME, tokenMatches: () => false })
      s.auth.token = null
      s.client.start()
      await flush()
      expect(last(s)).toEqual({ state: 'stopped', reason: 'unauthorized' })
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

    it('a repeated auth-expired for the same token backs off instead of refreshing and reconnecting at once', async () => {
      // REST still accepts the token, so the refresh leaves it as it was and the stream says it again.
      const s = setup({ keepToken: true })
      const first = await open(s)
      const second = streamResponse()
      s.f.enqueue(second.response)
      first.stream.push(sse('auth-expired', {}))
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(s.f.calls).toHaveLength(2)

      // the second connection says auth-expired again for the very same token
      const third = streamResponse()
      s.f.enqueue(third.response)
      second.stream.push(sse('auth-expired', {}))
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
      expect(s.f.calls).toHaveLength(2)
      expect(last(s)!.state).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(2_999)
      expect(s.f.calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(3)

      // and again: the wait grows (3 s → 6 s) with no refresh probe in between
      const fourth = streamResponse()
      s.f.enqueue(fourth.response)
      third.stream.push(sse('auth-expired', {}))
      await flush()
      await vi.advanceTimersByTimeAsync(5_999)
      expect(s.f.calls).toHaveLength(3)
      await vi.advanceTimersByTimeAsync(1)
      expect(s.f.calls).toHaveLength(4)
      expect(s.auth.refresh).toHaveBeenCalledTimes(1)
    })

    it('an auth-expired after the token changed refreshes at once (once per token)', async () => {
      let rotation = 1
      const s = setup({
        refresh: async () => {
          rotation++
          s.auth.token = `t${rotation}`
          return true
        },
      })
      const first = await open(s)
      const second = streamResponse()
      s.f.enqueue(second.response)
      first.stream.push(sse('auth-expired', {}))
      await flush()
      expect(s.f.calls[1]!.headers.authorization).toBe('Bearer t2')

      const third = streamResponse()
      s.f.enqueue(third.response)
      second.stream.push(sse('auth-expired', {}))
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(2)
      expect(s.f.calls).toHaveLength(3)
      expect(s.f.calls[2]!.headers.authorization).toBe('Bearer t3')
    })

    it('reconnect() forgets the once-per-token guard', async () => {
      const s = setup({ keepToken: true })
      const first = await open(s)
      const second = streamResponse()
      s.f.enqueue(second.response)
      first.stream.push(sse('auth-expired', {}))
      await flush()
      const third = streamResponse()
      s.f.enqueue(third.response)
      s.client.reconnect()
      await flush()
      const fourth = streamResponse()
      s.f.enqueue(fourth.response)
      third.stream.push(sse('auth-expired', {}))
      await flush()
      expect(s.auth.refresh).toHaveBeenCalledTimes(2)
      expect(s.f.calls).toHaveLength(4)
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
      const s = setup({ random: () => 0 })
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
