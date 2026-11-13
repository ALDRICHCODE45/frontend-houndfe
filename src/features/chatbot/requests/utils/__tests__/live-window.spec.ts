import { describe, expect, it } from 'vitest'
import { makeMessage } from '../conversation-fixture'
import { WINDOW_MS, formatRemaining, isWindowClosed, windowClosesAt } from '../live-window'

const HOUR = 3_600_000
const T0 = Date.parse('2026-11-13T16:00:00.000Z')
const customer = (seq: number, atMs: number) =>
  makeMessage({ seq, direction: 'IN', author: 'CUSTOMER', providerTimestamp: new Date(atMs).toISOString() })
const staffMsg = (seq: number, status: 'DEFERRED' | 'SENT') =>
  makeMessage({ seq, direction: 'OUT', author: 'STAFF', deliveryStatus: status })

const base = { messages: [], lastCustomerMessageAt: null, rowClosesAt: null, forcedClosedAfterSeq: null }

describe('windowClosesAt — 24 h after the last customer message', () => {
  it('counts from the newest customer message of the thread', () => {
    const closes = windowClosesAt({ ...base, messages: [customer(1, T0 - 5 * HOUR), customer(3, T0 - HOUR)] })
    expect(closes).toBe(T0 - HOUR + WINDOW_MS)
  })

  it('takes the later of the thread and liveSession.lastCustomerMessageAt', () => {
    const closes = windowClosesAt({
      ...base,
      messages: [customer(1, T0 - 5 * HOUR)],
      lastCustomerMessageAt: new Date(T0 - HOUR).toISOString(),
    })
    expect(closes).toBe(T0 - HOUR + WINDOW_MS)
  })

  it('falls back to the row value, which can be stale (handoff 20 §6), only when nothing newer is known', () => {
    expect(windowClosesAt({ ...base, rowClosesAt: '2026-11-13T20:00:00.000Z' })).toBe(
      Date.parse('2026-11-13T20:00:00.000Z'),
    )
    expect(windowClosesAt(base)).toBeNull()
  })
})

describe('isWindowClosed', () => {
  it('is open before the 24 h and closed from then on', () => {
    const input = { ...base, messages: [customer(1, T0 - 23 * HOUR)] }
    expect(isWindowClosed(input, new Date(T0))).toBe(false)
    expect(isWindowClosed(input, new Date(T0 + HOUR))).toBe(true)
  })

  it('stays open when nothing is known (the server answers WINDOW_CLOSED if it is not)', () => {
    expect(isWindowClosed(base, new Date(T0))).toBe(false)
  })

  it('a 409 WINDOW_CLOSED keeps it closed until the customer writes something newer', () => {
    const messages = [customer(4, T0 - HOUR)]
    const forced = { ...base, messages, forcedClosedAfterSeq: 4 }
    expect(isWindowClosed(forced, new Date(T0))).toBe(true)
    expect(isWindowClosed({ ...forced, messages: [...messages, customer(5, T0)] }, new Date(T0))).toBe(false)
  })

  it('a DEFERRED staff message after the last customer message means the window is closed (handoff 20 §5b)', () => {
    const input = { ...base, messages: [customer(1, T0 - HOUR), staffMsg(2, 'DEFERRED')] }
    expect(isWindowClosed(input, new Date(T0))).toBe(true)
    expect(isWindowClosed({ ...input, messages: [...input.messages, customer(3, T0)] }, new Date(T0))).toBe(false)
  })

  it('a SENT staff message does not close it', () => {
    const input = { ...base, messages: [customer(1, T0 - HOUR), staffMsg(2, 'SENT')] }
    expect(isWindowClosed(input, new Date(T0))).toBe(false)
  })
})

describe('formatRemaining', () => {
  it('writes minutes under an hour and hours with minutes above', () => {
    expect(formatRemaining(45 * 60_000)).toBe('45 min')
    expect(formatRemaining(3 * HOUR)).toBe('3 h')
    expect(formatRemaining(3 * HOUR + 40 * 60_000)).toBe('3 h 40 min')
    expect(formatRemaining(-5)).toBe('0 min')
  })
})
