import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { REALTIME_OPEN_REFETCH_MS, useRealtimeOpen, whileStreamOpen } from '../polling'
import type { RealtimeService } from '../realtime-service'
import { setRealtimeServiceForTests } from '../useRealtime'
import type { RealtimeStatus } from '../types'

function fakeService(initial: RealtimeStatus = { state: 'idle', role: 'none' }) {
  const handlers = new Set<(s: RealtimeStatus) => void>()
  let status = initial
  const service = {
    getStatus: vi.fn(() => status),
    onStatus: vi.fn((h: (s: RealtimeStatus) => void) => {
      handlers.add(h)
      return () => handlers.delete(h)
    }),
    on: vi.fn(() => () => {}),
    onAny: vi.fn(() => () => {}),
    start: vi.fn(),
    stop: vi.fn(),
    reconnect: vi.fn(),
  } as unknown as RealtimeService
  return {
    service,
    set(next: RealtimeStatus) {
      status = next
      for (const h of handlers) h(next)
    },
  }
}

afterEach(() => {
  setRealtimeServiceForTests(null)
  vi.unstubAllEnvs()
})

describe('whileStreamOpen', () => {
  it('keeps the base interval while the stream is not open', () => {
    expect(whileStreamOpen(30_000, false)).toBe(30_000)
  })

  it('stretches to the safety-net interval while the stream is open', () => {
    expect(whileStreamOpen(30_000, true)).toBe(REALTIME_OPEN_REFETCH_MS)
    expect(whileStreamOpen(4_000, true, 60_000)).toBe(60_000)
  })

  it('never shortens a longer base, and keeps «no polling» as no polling', () => {
    expect(whileStreamOpen(900_000, true)).toBe(900_000)
    expect(whileStreamOpen(false, true)).toBe(false)
    expect(whileStreamOpen(false, false)).toBe(false)
  })
})

describe('useRealtimeOpen', () => {
  it('is false with the flag off, and never touches the realtime service', () => {
    const { service } = fakeService({ state: 'open', role: 'leader' })
    setRealtimeServiceForTests(service)
    const scope = effectScope()
    const open = scope.run(() => useRealtimeOpen())!
    expect(open.value).toBe(false)
    expect(service.onStatus).not.toHaveBeenCalled()
    scope.stop()
  })

  it('follows the stream status with the flag on and unsubscribes with the scope', () => {
    vi.stubEnv('VITE_REALTIME_SSE', 'true')
    const fake = fakeService()
    setRealtimeServiceForTests(fake.service)
    const scope = effectScope()
    const open = scope.run(() => useRealtimeOpen())!
    expect(open.value).toBe(false)

    fake.set({ state: 'connecting', role: 'leader' })
    expect(open.value).toBe(false)
    fake.set({ state: 'open', role: 'follower' })
    expect(open.value).toBe(true)
    fake.set({ state: 'reconnecting', role: 'leader' })
    expect(open.value).toBe(false)
    fake.set({ state: 'stopped', role: 'leader', reason: 'replaced' })
    expect(open.value).toBe(false)

    scope.stop()
    fake.set({ state: 'open', role: 'leader' })
    expect(open.value).toBe(false)
  })
})
