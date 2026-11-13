/**
 * fetch-based reader of `GET /realtime/stream` (handoff 17), no EventSource.
 *
 * Owns one connection at a time: SSE parsing, connect timeout (15 s to the response
 * headers), heartbeat watchdog (dead after 45 s of silence), reconnect with backoff
 * (3 s → 30 s, equal jitter, `Retry-After`), once-per-token `auth-expired` refresh,
 * `Last-Event-ID` cursor, dedupe by id, and every control event of §3.4.
 * It knows nothing about tabs or the app: the service wraps it.
 */
import { createSseParser, type SseMessage } from './sse-parser'
import type { RealtimeAuthPort, RealtimeEnvelope, StopReason } from './types'

export interface StreamStatus {
  state: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'stopped'
  reason?: StopReason
}

export interface StreamClientOptions {
  baseUrl: string
  fetch: typeof fetch
  auth: RealtimeAuthPort
  onEvent: (envelope: RealtimeEnvelope) => void
  onStatus: (status: StreamStatus) => void
  /** Cursor to resume from (the last id processed for this user + tenant). */
  initialCursor?: string | null
  /** For jitter; injectable so tests are deterministic. */
  random?: () => number
}

export interface StreamClient {
  start(): void
  /** Aborts the request and cancels every timer. The cursor is kept. */
  stop(): void
  /** Restart now (used after `connection-replaced` / `access-revoked`, or by a «Reconnect» button). */
  reconnect(): void
  getCursor(): string | null
}

/** No response headers within this long: abort the attempt and retry with backoff. */
const CONNECT_TIMEOUT_MS = 15_000
const HEARTBEAT_DEAD_MS = 45_000
const BACKOFF_START_MS = 3_000
const BACKOFF_MAX_MS = 30_000
/** A wait the server asks for (`Retry-After`, `server-unavailable`) is spread upwards by up to this share. */
const FLOOR_SPREAD_RATIO = 0.25
const SERVER_UNAVAILABLE_MIN_MS = 5_000
const RETRY_AFTER_MAX_MS = 120_000
/** A connection that lived this long counts as healthy again after `slow-consumer`. */
const STABLE_AFTER_MS = 60_000
const SEEN_IDS_LIMIT = 500

/** Control events that are never delivered to the bus (except `ready` / `resync`). */
const SILENT_CONTROL = new Set(['heartbeat'])

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  let ms: number
  if (/^\d+$/.test(trimmed)) ms = Number(trimmed) * 1000
  else {
    const date = Date.parse(trimmed)
    if (Number.isNaN(date)) return null
    ms = date - Date.now()
  }
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.min(ms, RETRY_AFTER_MAX_MS)
}

export function createStreamClient(options: StreamClientOptions): StreamClient {
  const random = options.random ?? Math.random

  let running = false
  let generation = 0
  let controller: AbortController | null = null
  let currentToken: string | null = null
  let cursor: string | null = options.initialCursor ?? null
  const seen = new Set<string>()
  const seenOrder: string[] = []
  let attempt = 0
  let retryHintMs = BACKOFF_START_MS
  let refreshedFor401 = false
  /** The token a stream last ended with `auth-expired`: a second one for the same token does not refresh again. */
  let authExpiredToken: string | null = null
  let slowStreak = 0
  let openedAt = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let watchdog: ReturnType<typeof setTimeout> | null = null
  let connectTimer: ReturnType<typeof setTimeout> | null = null
  let lastStatus: StreamStatus | null = null

  function setStatus(status: StreamStatus) {
    if (lastStatus && lastStatus.state === status.state && lastStatus.reason === status.reason) {
      return
    }
    lastStatus = status
    options.onStatus(status)
  }

  function remember(id: string): boolean {
    if (seen.has(id)) return false
    seen.add(id)
    seenOrder.push(id)
    if (seenOrder.length > SEEN_IDS_LIMIT) seen.delete(seenOrder.shift()!)
    return true
  }

  function clearTimers() {
    if (retryTimer) clearTimeout(retryTimer)
    if (watchdog) clearTimeout(watchdog)
    if (connectTimer) clearTimeout(connectTimer)
    retryTimer = watchdog = connectTimer = null
  }

  /** Invalidates the current connection (and any async work tied to it) and aborts it. */
  function endConnection() {
    generation++
    if (watchdog) clearTimeout(watchdog)
    watchdog = null
    if (connectTimer) clearTimeout(connectTimer)
    connectTimer = null
    controller?.abort()
    controller = null
  }

  function halt(reason: StopReason) {
    endConnection()
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    setStatus({ state: 'stopped', reason })
  }

  /**
   * Equal jitter over the base delay: half of it is fixed, the other half is random, so clients
   * that lost the stream together (a deploy) come back spread over [base / 2, base] instead of
   * one narrow window. Never above the 30 s cap.
   */
  function backoffDelay(): number {
    const base = Math.min(BACKOFF_MAX_MS, retryHintMs * 2 ** attempt)
    return Math.min(BACKOFF_MAX_MS, base / 2 + (base / 2) * random())
  }

  function scheduleRetry(minMs = 0) {
    if (!running) return
    setStatus({ state: 'reconnecting' })
    // A floor from the server is honoured, never shortened; it is spread upwards so the clients
    // it was given to do not all return at the same instant.
    const floor = minMs > 0 ? minMs + minMs * FLOOR_SPREAD_RATIO * random() : 0
    const delay = Math.max(floor, backoffDelay())
    attempt++
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      void connect()
    }, delay)
  }

  function armWatchdog(gen: number) {
    if (watchdog) clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      watchdog = null
      if (gen !== generation || !running) return
      endConnection()
      scheduleRetry()
    }, HEARTBEAT_DEAD_MS)
  }

  async function refreshThenReconnect(staleToken: string | null, gen: number) {
    let ok = false
    try {
      ok = await options.auth.refresh(staleToken)
    } catch {
      ok = false
    }
    if (gen !== generation || !running) return
    if (!ok) {
      halt('unauthorized')
      return
    }
    void connect()
  }

  function deliver(message: SseMessage, data: unknown) {
    try {
      options.onEvent({ type: message.event, id: message.id, data })
    } catch {
      /* a consumer bug must not break the stream */
    }
  }

  function handleMessage(gen: number, message: SseMessage) {
    if (gen !== generation) return

    // A second auth-expired for a token we already refreshed for does not prove the connection
    // works (REST may accept a token the stream keeps rejecting): it must not reset the backoff.
    const repeatedAuthExpired = message.event === 'auth-expired' && authExpiredToken === currentToken

    // Any message proves the connection works: reset the backoff, unless the
    // server just dropped us as a slow consumer (then only a stable connection resets it).
    if (slowStreak > 0 && Date.now() - openedAt >= STABLE_AFTER_MS) slowStreak = 0
    if (slowStreak === 0 && !repeatedAuthExpired) attempt = 0

    let data: unknown
    let parsed = true
    try {
      data = message.data === '' ? {} : JSON.parse(message.data)
    } catch {
      parsed = false
    }

    switch (message.event) {
      case 'auth-expired':
        endConnection()
        if (repeatedAuthExpired) {
          // Same token, same answer: treat it like a 401 after a refresh and back off.
          scheduleRetry()
          return
        }
        authExpiredToken = currentToken
        void refreshThenReconnect(currentToken, generation)
        return
      case 'access-revoked':
        halt('revoked')
        return
      case 'connection-replaced':
        halt('replaced')
        return
      case 'slow-consumer':
        slowStreak++
        endConnection()
        scheduleRetry()
        return
      case 'server-shutdown':
        endConnection()
        scheduleRetry()
        return
      case 'server-unavailable':
        endConnection()
        scheduleRetry(SERVER_UNAVAILABLE_MIN_MS)
        return
      default:
        break
    }

    if (SILENT_CONTROL.has(message.event) || !parsed) return

    if (message.event === 'ready' || message.event === 'resync') {
      // Control messages carry the current cursor: never dedupe them.
      if (message.id !== null) {
        cursor = message.id
        remember(message.id)
      }
      deliver(message, data)
      return
    }

    if (message.id !== null) {
      if (!remember(message.id)) return
      cursor = message.id
    }
    deliver(message, data)
  }

  async function pump(gen: number, response: Response) {
    const body = response.body
    if (!body) {
      if (gen === generation && running) {
        endConnection()
        scheduleRetry()
      }
      return
    }
    const reader = body.getReader()
    const decoder = new TextDecoder()
    const parser = createSseParser({
      onMessage: (m) => handleMessage(gen, m),
      onRetry: (ms) => {
        retryHintMs = Math.min(BACKOFF_MAX_MS, Math.max(1_000, ms))
      },
    })
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (gen !== generation) return
        if (done) break
        armWatchdog(gen)
        parser.feed(decoder.decode(value, { stream: true }))
        if (gen !== generation) return
      }
    } catch {
      if (gen !== generation) return
    }
    if (gen !== generation || !running) return
    endConnection()
    scheduleRetry()
  }

  async function connect() {
    if (!running) return
    endConnection()
    const gen = generation
    const token = options.auth.getAccessToken()
    if (!token) {
      halt('unauthorized')
      return
    }
    currentToken = token
    const abort = new AbortController()
    controller = abort
    setStatus({ state: lastStatus?.state === 'reconnecting' ? 'reconnecting' : 'connecting' })

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    }
    if (cursor !== null) headers['Last-Event-ID'] = cursor

    // The watchdog only arms once the response is open: without this a connect that never gets
    // headers would stay `connecting` for good (and keep the leader lock).
    connectTimer = setTimeout(() => {
      connectTimer = null
      if (gen !== generation || !running) return
      endConnection()
      scheduleRetry()
    }, CONNECT_TIMEOUT_MS)

    let response: Response
    try {
      response = await options.fetch(`${options.baseUrl}/realtime/stream`, {
        method: 'GET',
        headers,
        signal: abort.signal,
        cache: 'no-store',
      })
    } catch {
      if (gen !== generation || !running) return
      endConnection()
      scheduleRetry()
      return
    }
    if (gen !== generation || !running) {
      abort.abort()
      return
    }

    if (connectTimer) clearTimeout(connectTimer)
    connectTimer = null

    if (response.ok) {
      refreshedFor401 = false
      openedAt = Date.now()
      setStatus({ state: 'open' })
      armWatchdog(gen)
      await pump(gen, response)
      return
    }

    void response.body?.cancel().catch(() => {})
    switch (response.status) {
      case 401:
        if (refreshedFor401) {
          halt('unauthorized')
          return
        }
        refreshedFor401 = true
        endConnection()
        await refreshThenReconnect(token, generation)
        return
      case 403:
        halt('forbidden')
        return
      case 400:
        // A cursor the server rejects must not be sent again.
        if (cursor !== null) {
          cursor = null
          seen.clear()
          seenOrder.length = 0
          void connect()
        } else {
          halt('error')
        }
        return
      case 503: {
        endConnection()
        scheduleRetry(parseRetryAfter(response.headers.get('Retry-After')) ?? 0)
        return
      }
      default:
        endConnection()
        scheduleRetry()
    }
  }

  return {
    start() {
      if (running) return
      running = true
      void connect()
    },
    stop() {
      running = false
      endConnection()
      clearTimers()
      setStatus({ state: 'idle' })
    },
    reconnect() {
      running = true
      clearTimers()
      attempt = 0
      slowStreak = 0
      refreshedFor401 = false
      authExpiredToken = null
      void connect()
    },
    getCursor: () => cursor,
  }
}
