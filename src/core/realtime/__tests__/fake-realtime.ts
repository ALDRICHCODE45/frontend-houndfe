/**
 * Test double of the realtime service for the features that subscribe to it (T4b). Test-only: no
 * runtime module imports it. `emit` delivers an event to the handlers of that type; `setStatus`
 * moves the status the way the real stream would.
 */
import { vi } from 'vitest'
import type { RealtimeService } from '../realtime-service'
import type { RealtimeEnvelope, RealtimeStatus } from '../types'

export function createFakeRealtime(initial: RealtimeStatus = { state: 'idle', role: 'none' }) {
  const handlers = new Map<string, Set<(payload: unknown, meta: { id: string | null }) => void>>()
  const statusHandlers = new Set<(status: RealtimeStatus) => void>()
  const anyHandlers = new Set<(event: RealtimeEnvelope) => void>()
  let status = initial

  const service = {
    start: vi.fn(),
    stop: vi.fn(),
    reconnect: vi.fn(),
    getStatus: vi.fn(() => status),
    on: vi.fn((type: string, handler: (payload: unknown, meta: { id: string | null }) => void) => {
      let set = handlers.get(type)
      if (!set) handlers.set(type, (set = new Set()))
      set.add(handler)
      return () => set.delete(handler)
    }),
    onAny: vi.fn((handler: (event: RealtimeEnvelope) => void) => {
      anyHandlers.add(handler)
      return () => anyHandlers.delete(handler)
    }),
    onStatus: vi.fn((handler: (status: RealtimeStatus) => void) => {
      statusHandlers.add(handler)
      return () => statusHandlers.delete(handler)
    }),
  }

  return {
    // SAFETY: the fake implements the members the features call (on, onAny, onStatus, getStatus, start, stop, reconnect); the rest of RealtimeService is not reachable from them.
    service: service as unknown as RealtimeService,
    mocks: service,
    emit(type: string, payload: unknown, id: string | null = null) {
      for (const handler of [...(handlers.get(type) ?? [])]) handler(payload, { id })
      for (const handler of [...anyHandlers]) handler({ type, id, data: payload })
    },
    setStatus(next: RealtimeStatus) {
      status = next
      for (const handler of [...statusHandlers]) handler(next)
    },
    handlerCount(type: string): number {
      return handlers.get(type)?.size ?? 0
    },
    statusHandlerCount: () => statusHandlers.size,
  }
}
