import { vi } from 'vitest'
import type { ChannelLike, LockManagerLike } from '../leader'

/** A controllable streaming response body. */
export interface FakeStream {
  push(text: string): void
  close(): void
  error(err?: unknown): void
}

export interface FakeResponse {
  response: Response
  stream: FakeStream
}

export function sse(event: string, data: unknown, id?: string | number): string {
  return `${id !== undefined ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function streamResponse(init: { status?: number; headers?: Record<string, string> } = {}): FakeResponse {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  const response = new Response(body, {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'text/event-stream', ...init.headers },
  })
  return {
    response,
    stream: {
      push: (text) => controller.enqueue(encoder.encode(text)),
      close: () => controller.close(),
      error: (err) => controller.error(err ?? new Error('network')),
    },
  }
}

export function errorResponse(status: number, headers: Record<string, string> = {}, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export type FetchCall = { url: string; headers: Record<string, string>; signal: AbortSignal }

/** A fetch mock that serves queued responses and records every call. */
export function createFetchMock() {
  const queue: Array<Response | Error | ((call: FetchCall) => Response | Promise<Response>)> = []
  const calls: FetchCall[] = []
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v
    })
    const call: FetchCall = {
      url: String(input),
      headers,
      signal: init?.signal as AbortSignal,
    }
    calls.push(call)
    const next = queue.shift()
    if (!next) return Promise.reject(new Error('no queued response'))
    if (next instanceof Error) return Promise.reject(next)
    if (typeof next === 'function') return Promise.resolve(next(call))
    return Promise.resolve(next)
  })
  return {
    fetch: fn as unknown as typeof fetch,
    calls,
    enqueue: (...items: typeof queue) => queue.push(...items),
  }
}

/** Let pending microtasks (stream reads, promise chains) settle without moving fake timers. */
export async function flush(times = 12) {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

/** Shared Web Locks registry. Each tab gets a facade; closing a tab releases its locks. */
export function createLockRegistry() {
  const held = new Map<string, { release: () => void; owner: object }>()
  const waiting = new Map<
    string,
    Array<{ owner: object; grant: () => void; signal?: AbortSignal; callback: () => Promise<unknown> }>
  >()

  function grantNext(name: string) {
    const queue = waiting.get(name) ?? []
    while (queue.length) {
      const next = queue.shift()!
      if (next.signal?.aborted) continue
      next.grant()
      return
    }
  }

  function tab() {
    const owner = {}
    const facade: LockManagerLike = {
      request(name, options, callback) {
        return new Promise<void>((resolve, reject) => {
          const attempt = () => {
            let release!: () => void
            const done = new Promise<void>((r) => {
              release = r
            })
            held.set(name, { release, owner })
            callback().then(() => release())
            done.then(() => {
              if (held.get(name)?.owner === owner) held.delete(name)
              grantNext(name)
              resolve()
            })
          }
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
          if (!held.has(name)) attempt()
          else {
            const q = waiting.get(name) ?? []
            q.push({ owner, grant: attempt, signal: options.signal, callback })
            waiting.set(name, q)
          }
        })
      },
    }
    return {
      facade,
      /** Simulate the tab closing: its held lock is released, its waiters vanish. */
      close() {
        for (const [name, h] of [...held]) if (h.owner === owner) h.release()
        for (const [name, q] of waiting)
          waiting.set(
            name,
            q.filter((w) => w.owner !== owner),
          )
      },
    }
  }
  return { tab, held }
}

/** In-memory BroadcastChannel hub: delivers to every other channel with the same name. */
export function createChannelHub() {
  const channels = new Map<string, Set<ChannelFake>>()
  const hub = { partitioned: false }
  class ChannelFake implements ChannelLike {
    onmessage: ((e: { data: unknown }) => void) | null = null
    closed = false
    constructor(readonly name: string) {
      const set = channels.get(name) ?? new Set()
      set.add(this)
      channels.set(name, set)
    }
    postMessage(data: unknown) {
      if (this.closed || hub.partitioned) return
      for (const other of channels.get(this.name) ?? []) {
        if (other === this || other.closed) continue
        queueMicrotask(() => !other.closed && other.onmessage?.({ data: structuredClone(data) }))
      }
    }
    close() {
      this.closed = true
      channels.get(this.name)?.delete(this)
    }
  }
  return {
    create: (name: string) => new ChannelFake(name) as ChannelLike,
    channels,
    /** While true, messages are dropped (a network split between tabs). */
    get partitioned() {
      return hub.partitioned
    },
    set partitioned(v: boolean) {
      hub.partitioned = v
    },
  }
}

