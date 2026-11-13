import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { withQuery } from './withQuery'
import { useLiveClock } from '../useLiveClock'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-13T16:00:00.000Z'))
})
afterEach(() => vi.useRealTimers())

describe('useLiveClock', () => {
  it('ticks every second while active, so elapsed times and the 30 s «Pendiente de envío» move', async () => {
    const { result } = withQuery(() => useLiveClock(() => true))
    expect(result.value.toISOString()).toBe('2026-11-13T16:00:00.000Z')
    await vi.advanceTimersByTimeAsync(31_000)
    expect(result.value.toISOString()).toBe('2026-11-13T16:00:31.000Z')
  })

  it('does not tick while inactive, and catches up when it turns active', async () => {
    const active = ref(false)
    const { result } = withQuery(() => useLiveClock(active))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(vi.getTimerCount()).toBe(0)
    active.value = true
    await vi.advanceTimersByTimeAsync(1_000)
    expect(result.value.toISOString()).toBe('2026-11-13T16:00:11.000Z')
    active.value = false
    await vi.advanceTimersByTimeAsync(5_000)
    expect(result.value.toISOString()).toBe('2026-11-13T16:00:11.000Z')
  })

  it('clears its timer when the component unmounts', async () => {
    const { wrapper } = withQuery(() => useLiveClock(() => true))
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
